// Lógica pura de los scripts de operación (sin I/O): se testea con node --test.

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

/** Backups de prod que sobran: los más viejos (por la fecha del nombre) más allá de `keep`. */
export function selectBackupsToDelete(files, keep = 30) {
  const backups = files
    .map((f) => ({ f, m: BACKUP_RE.exec(f) }))
    .filter((x) => x.m)
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
