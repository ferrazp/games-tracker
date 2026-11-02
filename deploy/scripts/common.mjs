// Helpers con I/O compartidos por qa.mjs y prod.mjs.
import { spawnSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync, openSync, closeSync, createReadStream, statSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { composeArgs, confirmWord, isOwnerStatement } from './lib.mjs';

/** Raíz del monorepo: todos los comandos corren desde ahí. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.chdir(ROOT);

export function die(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

export function readEnvFile(env) {
  const file = `deploy/${env}.env`;
  if (!existsSync(file)) die(`Falta ${file}. Copiá deploy/${env}.env.example y completalo (ver docs/OPERACION.md).`);
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** docker <args>, mostrando la salida. Devuelve el código de salida. */
export function docker(args, { env = {}, quiet = false } = {}) {
  const r = spawnSync('docker', args, {
    stdio: quiet ? 'ignore' : 'inherit',
    env: { ...process.env, ...env },
  });
  return r.status ?? 1;
}

/** docker <args> capturando stdout como texto. */
export function dockerOut(args, { env = {} } = {}) {
  const r = spawnSync('docker', args, { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

export function compose(envName, args, opts = {}) {
  return docker(composeArgs(envName, ...args), opts);
}

export function composeOut(envName, args, opts = {}) {
  return dockerOut(composeArgs(envName, ...args), opts);
}

export async function askWord(question, expected) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question}\nEscribí "${expected}" para continuar: `);
  rl.close();
  return confirmWord(answer, expected);
}

/** pg_dump del servicio db -> archivo .sql.gz. */
export function dumpTo(envName, file, extraEnv = {}) {
  const fd = openSync(file, 'w');
  try {
    const r = spawnSync('docker', composeArgs(envName, 'exec', '-T', 'db', 'sh', '-c',
      'pg_dump --no-owner --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip'), {
      stdio: ['ignore', fd, 'inherit'],
      env: { ...process.env, ...extraEnv },
    });
    if (r.status !== 0) die(`pg_dump falló (código ${r.status})`);
  } finally {
    closeSync(fd);
  }
  if (statSync(file).size < 100) die(`El backup ${file} quedó vacío`);
}

/** Vacía el esquema public y carga un .sql.gz, salteando las sentencias de dueño. */
export async function restoreFrom(envName, file, extraEnv = {}) {
  const reset = compose(envName, ['exec', '-T', 'db', 'sh', '-c',
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'],
  { env: extraEnv });
  if (reset !== 0) die('No se pudo vaciar el esquema');

  const child = spawn('docker', composeArgs(envName, 'exec', '-T', 'db', 'sh', '-c',
    'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'), {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, ...extraEnv },
  });
  const done = new Promise((res) => child.on('close', res));

  let rest = '';
  const filter = new Transform({
    transform(chunk, _enc, cb) {
      const lines = (rest + chunk.toString('utf8')).split('\n');
      rest = lines.pop();
      cb(null, lines.filter((l) => !isOwnerStatement(l)).map((l) => `${l}\n`).join(''));
    },
    flush(cb) {
      cb(null, rest && !isOwnerStatement(rest) ? rest : '');
    },
  });
  await pipeline(createReadStream(file), createGunzip(), filter, child.stdin);
  const code = await done;
  if (code !== 0) die(`La restauración falló (código ${code})`);
}

/** Conteos de las tablas principales (para verificar una restauración). */
export function counts(envName, extraEnv = {}) {
  const psql = (sql) => composeOut(envName, ['exec', '-T', 'db', 'sh', '-c',
    `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "${sql}"`], { env: extraEnv });
  const out = {};
  for (const t of ['games', 'consoles', 'game_catalog', 'game_wishlist']) {
    const exists = psql(`select to_regclass('public.${t}') is not null`);
    if (exists.status !== 0) return null;
    out[t] = exists.stdout === 't' ? Number(psql(`select count(*) from ${t}`).stdout) : 0;
  }
  return out;
}
