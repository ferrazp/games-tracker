#!/usr/bin/env node
// Menú para operar Games Tracker desde el acceso directo del escritorio (games-tracker.cmd).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.chdir(ROOT);

const DOCKER_DESKTOP = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';

function envValue(env, key, fallback) {
  const file = `deploy/${env}.env`;
  if (!existsSync(file)) return fallback;
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'));
  return m ? m[1].trim() : fallback;
}

const URLS = {
  prod: `http://localhost:${envValue('prod', 'FRONT_PORT', '8090')}`,
  qa: `http://localhost:${envValue('qa', 'FRONT_PORT', '8081')}`,
  dev: 'http://localhost:3000',
};

const run = (script, ...args) => spawnSync(process.execPath, [`deploy/scripts/${script}`, ...args], { stdio: 'inherit' }).status;
const open = (url) => spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dockerUp = () => spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;

async function ensureDocker() {
  if (dockerUp()) return true;
  if (!existsSync(DOCKER_DESKTOP)) {
    console.log('✖ Docker no está corriendo y no encontré Docker Desktop. Abrilo a mano y reintentá.');
    return false;
  }
  console.log('▶ Iniciando Docker Desktop (puede tardar un minuto)…');
  spawn(DOCKER_DESKTOP, [], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    if (dockerUp()) {
      console.log('✔ Docker listo');
      return true;
    }
  }
  console.log('✖ Docker no respondió en 3 minutos.');
  return false;
}

const qaTag = () => {
  const v = existsSync('deploy/.qa-version') ? readFileSync('deploy/.qa-version', 'utf8').trim() : '';
  return v || 'main';
};

function startDev() {
  // Ventana aparte: cerrarla (o Ctrl+C) baja dev.
  spawn('cmd', ['/c', 'start', 'Games Tracker - DEV', 'cmd', '/k', 'npm run dev'], {
    cwd: ROOT, detached: true, stdio: 'ignore',
  }).unref();
  console.log(`✔ Dev arrancando en otra ventana (cerrala para bajarlo). Front: ${URLS.dev}  API: http://localhost:4000`);
}

const OPTIONS = [
  { group: `PRODUCCIÓN  ${URLS.prod}  — tus datos reales` },
  { key: '1', label: 'Levantar prod y abrir la web', docker: true, action: () => run('prod.mjs', 'start') === 0 && open(URLS.prod) },
  { key: '2', label: 'Bajar prod (los datos quedan guardados)', docker: true, action: () => run('prod.mjs', 'stop') },
  { key: '3', label: 'Estado de prod', docker: true, action: () => run('prod.mjs', 'status') },
  { key: '4', label: 'Backup de prod ahora', docker: true, action: () => run('prod.mjs', 'backup') },
  { group: `QA  ${URLS.qa}  — para probar una versión antes de prod` },
  { key: '5', label: () => `Levantar QA (imagen :${qaTag()}) y abrir la web`, docker: true, action: () => run('qa.mjs', 'up', '--tag', qaTag()) === 0 && open(URLS.qa) },
  { key: '6', label: 'Levantar QA con la última versión de main y abrir la web', docker: true, action: () => run('qa.mjs', 'up', '--tag', 'main') === 0 && open(URLS.qa) },
  { key: '7', label: 'Bajar QA', docker: true, action: () => run('qa.mjs', 'down') },
  { key: '8', label: 'Borrar QA y todos sus datos', docker: true, action: () => run('qa.mjs', 'reset') },
  { group: `DEV  ${URLS.dev}  — código local con SQLite` },
  { key: '9', label: 'Levantar dev (ventana aparte) y abrir la web', action: async () => { startDev(); await sleep(6000); open(URLS.dev); } },
  { group: '' },
  { key: 'b', label: 'Bajar prod y QA', docker: true, action: () => { run('prod.mjs', 'stop'); run('qa.mjs', 'down'); } },
  { key: '0', label: 'Salir' },
];

async function ask(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(q);
  } finally {
    rl.close();
  }
}

for (;;) {
  console.log('\n══════════════  GAMES TRACKER  ══════════════');
  for (const o of OPTIONS) {
    if ('group' in o) console.log(o.group ? `\n ${o.group}` : '');
    else console.log(`   ${o.key}) ${typeof o.label === 'function' ? o.label() : o.label}`);
  }
  const answer = (await ask('\nOpción: ')).trim().toLowerCase();
  if (answer === '0' || answer === 'q') break;
  const opt = OPTIONS.find((o) => o.key === answer);
  if (!opt) {
    console.log('Opción inválida');
    continue;
  }
  if (opt.docker && !(await ensureDocker())) continue;
  await opt.action();
}
