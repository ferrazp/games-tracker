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
import { basename, join, resolve } from 'node:path';
import {
  backupFileName, checkDeployPreconditions, composeArgs, formatHistoryEntry, historyState,
  parseHistory, parseVersion, rollbackPlan, selectBackupsToDelete,
} from './lib.mjs';
import {
  askWord, compose, composeOut, counts, die, docker, dockerOut, dumpTo, readEnvFile, restoreFrom,
  verifyDump,
} from './common.mjs';

const ENV = 'prod';
const REPO = 'ferrazp/games-tracker';
const IMAGES = ['backend', 'frontend'].map((a) => `ghcr.io/ferrazp/games-tracker-${a}`);
const VERSION_FILE = 'deploy/.prod-version';
const cfg = readEnvFile(ENV);
const BACKUP_DIR = resolve(cfg.BACKUP_DIR || join(homedir(), 'games-tracker-backups'));
const VOLUME = cfg.DB_VOLUME;
const LOGS_CMD = `docker ${composeArgs(ENV, 'logs', 'backend').join(' ')}`;

/** Historial de deploys (ver formato en lib.mjs). */
const history = () => (existsSync(VERSION_FILE) ? parseHistory(readFileSync(VERSION_FILE, 'utf8')) : []);
const record = (entry) => appendFileSync(VERSION_FILE, formatHistoryEntry(entry));
const currentVersion = () => historyState(history()).current;
const envFor = (version) => ({ IMAGE_TAG: version || 'none' });

function dbRunning() {
  const r = composeOut(ENV, ['ps', '--status', 'running', '--services'], { env: envFor(currentVersion()) });
  return r.stdout.split('\n').includes('db');
}

/** Backup con retención. Devuelve la ruta del archivo, o null solo si la base está vacía con certeza. */
function backup(version, env) {
  const c = counts(ENV, env);
  if (c !== null && Object.values(c).every((n) => n === 0)) {
    console.log('ℹ La base de prod está vacía: no hace falta backup.');
    return null;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = join(BACKUP_DIR, backupFileName(version || 'unknown'));
  dumpTo(ENV, file, env);
  console.log(`✔ Backup: ${file}`);
  const referenced = history().map((e) => e.backup).filter(Boolean).map((b) => basename(b));
  for (const old of selectBackupsToDelete(readdirSync(BACKUP_DIR), 30, referenced)) {
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

const upAll = (env) => compose(ENV, ['up', '-d', '--wait', '--wait-timeout', '90'], { env }) === 0;

function pull(env) {
  if (compose(ENV, ['pull', 'backend', 'frontend'], { env }) !== 0) die('No se pudieron bajar las imágenes');
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
  pull(env);
  startDb(env);
  const backupFile = backup(currentVersion(), env);
  if (!upAll(env)) {
    record({ version, status: 'failed', backup: backupFile });
    die(`Prod no quedó healthy en 90 s con v${version}.\n  Logs:   ${LOGS_CMD}\n  Volver: npm run prod:rollback`
      + (backupFile ? ` (restaura ${backupFile})` : ''));
  }
  record({ version, status: 'ok', backup: backupFile });
  console.log(`✔ Prod en v${version}: http://localhost:${cfg.FRONT_PORT}`);
}

async function restore(file) {
  const version = currentVersion();
  if (!version) die('Prod nunca se desplegó: primero npm run prod:deploy -- X.Y.Z');
  await verifyDump(file);
  if (!(await askWord(`Se van a REEMPLAZAR todos los datos de prod con ${file}.`, 'prod'))) die('Cancelado.');
  const env = envFor(version);
  startDb(env);
  const safety = backup(version, env);
  if (safety) console.log(`ℹ Backup de seguridad previo: ${safety}`);
  compose(ENV, ['stop', 'backend'], { env });
  await restoreFrom(ENV, resolve(file), env);
  if (!upAll(env)) die(`Prod no quedó healthy después de restaurar. Logs: ${LOGS_CMD}`);
  console.log('✔ Restaurado. Conteos:', counts(ENV, env));
}

async function rollback() {
  const plan = rollbackPlan(history());
  if (!plan) die('No hay una versión anterior a la que volver (ver deploy/.prod-version)');
  if (plan.restore) await verifyDump(plan.restore);
  const msg = `Rollback de prod: v${plan.from}${plan.kind === 'failed' ? ' (deploy fallido)' : ''} → v${plan.to}`
    + (plan.restore ? `, restaurando los datos de antes de ese deploy (${plan.restore}).` : ' (solo imágenes).');
  if (!(await askWord(msg, 'prod'))) die('Cancelado.');
  const env = envFor(plan.to);
  pull(env);
  startDb(env);
  const safety = backup(plan.from, env);
  if (safety) console.log(`ℹ Backup de seguridad de v${plan.from}: ${safety}`);
  compose(ENV, ['stop', 'backend', 'frontend'], { env });
  if (plan.restore) await restoreFrom(ENV, plan.restore, env);
  if (!upAll(env)) die(`Prod no quedó healthy con v${plan.to}. Logs: ${LOGS_CMD}`);
  record({ version: plan.to, status: 'rollback', backup: null, note: plan.kind });
  console.log(`✔ Prod volvió a v${plan.to}`);
}

async function status() {
  const { current, failed } = historyState(history());
  console.log(`Versión desplegada: ${current ? `v${current}` : '(ninguna)'}${failed ? ' — ⚠ el último deploy FALLÓ (npm run prod:rollback)' : ''}`);
  compose(ENV, ['ps'], { env: envFor(current) });
  try {
    const res = await fetch(`http://localhost:${cfg.FRONT_PORT}/api/version`);
    console.log(`API /version: ${res.ok ? JSON.stringify(await res.json()) : res.status}`);
  } catch {
    console.log('API /version: sin respuesta');
  }
  if (dbRunning()) console.log('Datos:', counts(ENV, envFor(current)));
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
  case 'start': {
    // Levanta la versión ya desplegada (sin bajar imágenes ni tocar datos).
    const version = currentVersion();
    if (!version) die('Prod nunca se desplegó: primero npm run prod:deploy -- X.Y.Z');
    const env = envFor(version);
    startDb(env);
    if (!upAll(env)) die(`Prod no quedó healthy. Logs: ${LOGS_CMD}`);
    console.log(`✔ Prod v${version} arriba: http://localhost:${cfg.FRONT_PORT}`);
    break;
  }
  case 'stop': {
    // Baja los contenedores; el volumen external de datos no se toca.
    if (compose(ENV, ['down', '--remove-orphans'], { env: envFor(currentVersion()) }) !== 0) die('No se pudo bajar prod');
    console.log('✔ Prod abajo (los datos quedan en el volumen)');
    break;
  }
  default: die('Uso: prod.mjs deploy <X.Y.Z> | start | stop | backup | restore <archivo> | rollback | status');
}
