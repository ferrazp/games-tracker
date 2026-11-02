#!/usr/bin/env node
// Prod: proyecto compose gt-prod, volumen external gt-prod_db_data (nunca se borra por comando).
//   npm run prod:deploy -- 1.5.0
//   npm run prod:backup
//   npm run prod:restore -- <archivo.sql.gz>      (pide escribir "prod")
//   npm run prod:rollback                         (pide escribir "prod")
//   npm run prod:status
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  backupFileName, checkDeployPreconditions, parseVersion, selectBackupsToDelete,
} from './lib.mjs';
import {
  askWord, compose, composeOut, counts, die, docker, dockerOut, dumpTo, readEnvFile, restoreFrom,
} from './common.mjs';

const ENV = 'prod';
const REPO = 'ferrazp/games-tracker';
const IMAGES = ['backend', 'frontend'].map((a) => `ghcr.io/ferrazp/games-tracker-${a}`);
const VERSION_FILE = 'deploy/.prod-version';
const cfg = readEnvFile(ENV);
const BACKUP_DIR = resolve(cfg.BACKUP_DIR || join(homedir(), 'games-tracker-backups'));
const VOLUME = cfg.DB_VOLUME || 'gt-prod_db_data';

/** Historial de deploys: líneas "<versión> <backup tomado antes de ese deploy | ->". */
function history() {
  if (!existsSync(VERSION_FILE)) return [];
  return readFileSync(VERSION_FILE, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => {
    const [version, backup] = l.split(' ');
    return { version, backup: backup && backup !== '-' ? backup : null };
  });
}
const currentVersion = () => history().at(-1)?.version ?? null;
const envFor = (version) => ({ IMAGE_TAG: version || 'none' });

function dbRunning() {
  const r = composeOut(ENV, ['ps', '--status', 'running', '--services'], { env: envFor(currentVersion()) });
  return r.stdout.split('\n').includes('db');
}

function hasData(env) {
  const c = counts(ENV, env);
  return c !== null && Object.values(c).some((n) => n > 0);
}

/** Backup con retención. Devuelve la ruta del archivo o null si no hay datos. */
function backup(version, env) {
  if (!hasData(env)) {
    console.log('ℹ La base de prod está vacía: no hace falta backup.');
    return null;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = join(BACKUP_DIR, backupFileName(version || 'unknown'));
  dumpTo(ENV, file, env);
  console.log(`✔ Backup: ${file}`);
  for (const old of selectBackupsToDelete(readdirSync(BACKUP_DIR), 30)) {
    rmSync(join(BACKUP_DIR, old));
    console.log(`  (retención) borrado ${old}`);
  }
  return file;
}

function startDb(env) {
  if (dockerOut(['volume', 'inspect', VOLUME]).status !== 0) {
    console.log(`▶ Creando el volumen de prod ${VOLUME} (external, solo esta vez)`);
    if (docker(['volume', 'create', VOLUME]) !== 0) die('No se pudo crear el volumen');
  }
  if (compose(ENV, ['up', '-d', '--wait', 'db'], { env }) !== 0) die('Postgres de prod no arrancó');
}

function upAll(env) {
  if (compose(ENV, ['up', '-d', '--wait', '--wait-timeout', '90'], { env }) !== 0) {
    die('Prod no quedó healthy en 90 s. Revisá: docker compose -p gt-prod logs backend');
  }
}

async function deploy(arg) {
  let version;
  try { version = parseVersion(arg); } catch (e) { die(e.message); }
  console.log(`▶ Verificando v${version}…`);
  const releaseExists = spawnSync('gh', ['release', 'view', `v${version}`, '--repo', REPO], { stdio: 'ignore' }).status === 0;
  const imagesExist = IMAGES.every((img) => dockerOut(['manifest', 'inspect', `${img}:${version}`]).status === 0);
  const qaVersion = existsSync('deploy/.qa-version') ? readFileSync('deploy/.qa-version', 'utf8').trim() || null : null;
  const pre = checkDeployPreconditions({ version, releaseExists, imagesExist, qaVersion });
  if (!pre.ok) die(pre.reason);
  if (pre.needsConfirm && !(await askWord(`⚠ ${pre.reason}. ¿Desplegar igual en PROD?`, 'prod'))) die('Cancelado.');

  const env = envFor(version);
  startDb(env);
  const backupFile = backup(currentVersion(), env);
  if (compose(ENV, ['pull', 'backend', 'frontend'], { env }) !== 0) die('No se pudieron bajar las imágenes');
  upAll(env);
  appendFileSync(VERSION_FILE, `${version} ${backupFile ?? '-'}\n`);
  console.log(`✔ Prod en v${version}: http://localhost:${cfg.FRONT_PORT}`);
}

async function restore(file) {
  if (!file || !existsSync(file)) die('Uso: npm run prod:restore -- <archivo.sql.gz existente>');
  const version = currentVersion();
  if (!version) die('Prod nunca se desplegó: primero npm run prod:deploy -- X.Y.Z');
  if (!(await askWord(`Se van a REEMPLAZAR todos los datos de prod con ${file}.`, 'prod'))) die('Cancelado.');
  const env = envFor(version);
  startDb(env);
  const safety = backup(version, env);
  if (safety) console.log(`ℹ Backup de seguridad previo: ${safety}`);
  compose(ENV, ['stop', 'backend'], { env });
  await restoreFrom(ENV, resolve(file), env);
  upAll(env);
  console.log('✔ Restaurado. Conteos:', counts(ENV, env));
}

async function rollback() {
  const h = history();
  if (h.length < 2) die('No hay una versión anterior registrada en deploy/.prod-version');
  const last = h.at(-1);
  const prev = h.at(-2);
  const msg = `Rollback de prod: v${last.version} → v${prev.version}`
    + (last.backup ? `, restaurando los datos de antes del deploy (${last.backup}).` : ' (solo imágenes).');
  if (!(await askWord(msg, 'prod'))) die('Cancelado.');
  const env = envFor(prev.version);
  startDb(env);
  const safety = backup(last.version, env);
  if (safety) console.log(`ℹ Backup de seguridad de v${last.version}: ${safety}`);
  compose(ENV, ['stop', 'backend', 'frontend'], { env });
  if (last.backup) await restoreFrom(ENV, last.backup, env);
  if (compose(ENV, ['pull', 'backend', 'frontend'], { env }) !== 0) die('No se pudieron bajar las imágenes');
  upAll(env);
  appendFileSync(VERSION_FILE, `${prev.version} -\n`);
  console.log(`✔ Prod volvió a v${prev.version}`);
}

async function status() {
  const version = currentVersion();
  console.log(`Versión desplegada: ${version ? `v${version}` : '(ninguna)'}`);
  compose(ENV, ['ps'], { env: envFor(version) });
  try {
    const res = await fetch(`http://localhost:${cfg.FRONT_PORT}/api/version`);
    console.log(`API /version: ${res.ok ? JSON.stringify(await res.json()) : res.status}`);
  } catch {
    console.log('API /version: sin respuesta');
  }
  if (dbRunning()) console.log('Datos:', counts(ENV, envFor(version)));
  const files = existsSync(BACKUP_DIR)
    ? readdirSync(BACKUP_DIR).filter((f) => f.startsWith('gt-prod-')).sort()
    : [];
  console.log(`Backups en ${BACKUP_DIR}: ${files.length}${files.length ? ` (último: ${files.at(-1)})` : ''}`);
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case 'deploy': await deploy(arg); break;
  case 'backup': {
    const version = currentVersion();
    if (!version || !dbRunning()) die('Prod no está corriendo');
    if (!backup(version, envFor(version))) console.log('Nada que respaldar.');
    break;
  }
  case 'restore': await restore(arg); break;
  case 'rollback': await rollback(); break;
  case 'status': await status(); break;
  default: die('Uso: prod.mjs deploy <X.Y.Z> | backup | restore <archivo> | rollback | status');
}
