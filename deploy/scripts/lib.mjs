// Lógica pura de los scripts de operación (sin I/O): se testea con node --test.
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

const SEMVER = /^v?(\d+\.\d+\.\d+)$/;
const BACKUP_RE = /^gt-prod-(\d{8}-\d{6})-v.+\.sql\.gz$/;
const ENVS = ['qa', 'prod'];

/** '1.5.0' | 'v1.5.0' -> '1.5.0'. Lanza si no es SemVer X.Y.Z. */
export function parseVersion(input) {
  const m = SEMVER.exec(String(input ?? '').trim());
  if (!m) throw new Error(`Versión inválida "${input}": se espera SemVer X.Y.Z (por ejemplo 1.5.0)`);
  return m[1];
}

const pad = (n) => String(n).padStart(2, '0');

/** gt-prod-YYYYMMDD-HHmmss-vX.Y.Z.sql.gz, con la hora local. */
export function backupFileName(version, date = new Date()) {
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `gt-prod-${d}-${t}-v${version}.sql.gz`;
}

/**
 * Backups de prod que sobran: los más viejos (por la fecha del nombre) más allá de `keep`.
 * Nunca devuelve los de `protect` (los que figuran en el historial de deploys).
 */
export function selectBackupsToDelete(files, keep = 30, protect = []) {
  const keepSet = new Set(protect);
  const backups = files
    .map((f) => ({ f, m: BACKUP_RE.exec(f) }))
    .filter((x) => x.m && !keepSet.has(x.f))
    .sort((a, b) => b.m[1].localeCompare(a.m[1]));
  return backups.slice(keep).map((x) => x.f);
}

/** Decide si un deploy a prod puede seguir, antes de tocar nada. */
export function checkDeployPreconditions({ version, releaseExists, imagesExist, qaVersion }) {
  if (!releaseExists) {
    return { ok: false, needsConfirm: false, reason: `No existe el release v${version} en GitHub` };
  }
  if (!imagesExist) {
    return { ok: false, needsConfirm: false, reason: `No existen las imágenes :${version} en GHCR` };
  }
  if (qaVersion !== version) {
    const probada = qaVersion ? `QA tiene probada la ${qaVersion}` : 'QA nunca se levantó';
    return { ok: true, needsConfirm: true, reason: `${probada}, no la ${version}` };
  }
  return { ok: true, needsConfirm: false };
}

/** Argumentos de `docker` para operar un ambiente. */
export function composeArgs(env, ...rest) {
  if (!ENVS.includes(env)) throw new Error(`Ambiente desconocido "${env}": usar qa o prod`);
  return [
    'compose', '-p', `gt-${env}`, '--env-file', `deploy/${env}.env`,
    '-f', 'deploy/compose.yaml', '-f', `deploy/compose.${env}.yaml`,
    ...rest,
  ];
}

/** Confirmación de acciones destructivas: la palabra exacta. */
export function confirmWord(answer, expected) {
  return answer === expected;
}

const OWNER_RE = /^ALTER [A-Z ]+ \S+ OWNER TO \S+;$/;

/** Sentencias de dueño de pg_dump; se saltean al restaurar con otro usuario de BD. */
export function isOwnerStatement(line) {
  return OWNER_RE.test(line);
}

// ---------------------------------------------------------------------------
// Historial de deploys de prod (deploy/.prod-version): una línea por evento,
// separada por TAB: <versión> <ok|failed|rollback> <backup tomado antes | -> <nota>
// En "rollback" la nota dice de qué se volvió: "ok" (un deploy bueno) o "failed".

export function formatHistoryEntry({ version, status, backup = null, note = '' }) {
  return `${[version, status, backup ?? '-', note].join('\t')}\n`;
}

export function parseHistory(text) {
  return String(text ?? '').split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const [version, status, backup = '-', note = ''] = l.split('\t');
    return { version, status, backup: backup === '-' ? null : backup, note };
  });
}

/** stack: deploys ok vigentes (el tope es lo que corre); failed: último deploy fallido sin revertir. */
export function historyState(entries) {
  const stack = [];
  let failed = null;
  for (const e of entries) {
    if (e.status === 'ok') {
      if (stack.at(-1)?.version === e.version) stack.pop();
      stack.push(e);
      failed = null;
    } else if (e.status === 'failed') {
      failed = e;
    } else if (e.status === 'rollback') {
      if (e.note === 'failed') failed = null;
      else stack.pop();
    }
  }
  return { stack, failed, current: failed?.version ?? stack.at(-1)?.version ?? null };
}

/** A qué versión vuelve prod:rollback y qué backup restaura; null si no hay a dónde volver. */
export function rollbackPlan(entries) {
  const { stack, failed } = historyState(entries);
  if (failed) {
    const to = stack.at(-1);
    return to ? { from: failed.version, to: to.version, restore: failed.backup, kind: 'failed' } : null;
  }
  if (stack.length < 2) return null;
  const current = stack.at(-1);
  return { from: current.version, to: stack.at(-2).version, restore: current.backup, kind: 'ok' };
}

/** Transform que saca las líneas para las que `drop(line)` es true, sin romper UTF-8 entre chunks. */
export function createLineFilter(drop) {
  const decoder = new StringDecoder('utf8');
  let rest = '';
  const keep = (lines) => lines.filter((l) => !drop(l)).map((l) => `${l}\n`).join('');
  return new Transform({
    transform(chunk, _enc, cb) {
      const lines = (rest + decoder.write(chunk)).split('\n');
      rest = lines.pop();
      cb(null, keep(lines));
    },
    flush(cb) {
      const last = rest + decoder.end();
      cb(null, last && !drop(last) ? `${last}\n` : '');
    },
  });
}

/** Evita que un .env copiado entre ambientes haga que QA opere sobre el volumen de prod (o al revés). */
export function checkVolumeName(env, volume) {
  if (!String(volume ?? '').startsWith(`gt-${env}`)) {
    throw new Error(`DB_VOLUME="${volume}" no corresponde al ambiente ${env}: tiene que empezar con gt-${env}`);
  }
}
