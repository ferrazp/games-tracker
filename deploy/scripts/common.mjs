// Helpers con I/O compartidos por qa.mjs y prod.mjs.
import { spawnSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import {
  existsSync, readFileSync, openSync, closeSync, createReadStream, statSync, rmSync,
} from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  checkVolumeName, composeArgs, confirmWord, createLineFilter, isOwnerStatement, parseEnvFile,
} from './lib.mjs';

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
  const out = parseEnvFile(readFileSync(file, 'utf8'));
  try {
    checkVolumeName(env, out.DB_VOLUME);
  } catch (e) {
    die(`${file}: ${e.message}`);
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

/**
 * pg_dump del servicio db -> archivo .sql.gz. Con pipefail, un pg_dump que corta
 * a mitad hace fallar el backup; el archivo parcial se borra.
 */
export function dumpTo(envName, file, extraEnv = {}) {
  const fd = openSync(file, 'w');
  let status;
  try {
    status = spawnSync('docker', composeArgs(envName, 'exec', '-T', 'db', 'sh', '-c',
      'set -o pipefail; pg_dump --no-owner --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip'), {
      stdio: ['ignore', fd, 'inherit'],
      env: { ...process.env, ...extraEnv },
    }).status;
  } finally {
    closeSync(fd);
  }
  if (status !== 0 || statSync(file).size < 100) {
    rmSync(file, { force: true });
    die(`El backup falló (código ${status}); no se generó ${file}`);
  }
}

/** Descomprime el archivo entero sin usarlo, para detectar un gzip truncado ANTES de tocar la base. */
export async function verifyDump(file) {
  if (!file || !existsSync(file)) die(`No existe el archivo ${file}`);
  try {
    await pipeline(createReadStream(file), createGunzip(), new Writable({ write: (_c, _e, cb) => cb() }));
  } catch (e) {
    die(`El archivo ${file} está dañado o no es un .sql.gz válido: ${e.message}`);
  }
}

/**
 * Reemplaza el esquema public por el contenido de un .sql.gz, en UNA transacción:
 * si algo falla, la base queda como estaba. Saltea las sentencias de dueño.
 */
export async function restoreFrom(envName, file, extraEnv = {}) {
  await verifyDump(file);
  const child = spawn('docker', composeArgs(envName, 'exec', '-T', 'db', 'sh', '-c',
    'psql -q -X --single-transaction -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'), {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, ...extraEnv },
  });
  const done = new Promise((res) => child.on('close', res));
  try {
    await pipeline(
      Readable.from([Buffer.from('DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n')]),
      child.stdin,
      { end: false },
    );
    await pipeline(createReadStream(file), createGunzip(), createLineFilter(isOwnerStatement), child.stdin);
  } catch (e) {
    child.stdin.destroy();
    await done;
    die(`La restauración se cortó (${e.message}); la base quedó como estaba`);
  }
  const code = await done;
  if (code !== 0) die(`La restauración falló (código ${code}); la base quedó como estaba`);
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
