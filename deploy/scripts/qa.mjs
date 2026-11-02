#!/usr/bin/env node
// QA: ambiente descartable (proyecto compose gt-qa).
//   npm run qa:up [-- --tag main|sha-abc1234|1.5.0] [--no-pull]
//   npm run qa:down
//   npm run qa:reset      (borra contenedores Y datos de QA; pide escribir "qa")
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { askWord, compose, counts, die, readEnvFile, restoreFrom } from './common.mjs';
import { composeArgs } from './lib.mjs';

const ENV = 'qa';
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    tag: { type: 'string' },
    'no-pull': { type: 'boolean', default: false },
    restore: { type: 'string' },
  },
});
const [cmd] = positionals;
const cfg = readEnvFile(ENV);

async function up() {
  const tag = (values.tag || cfg.IMAGE_TAG || 'main').replace(/^v(?=\d)/, '');
  const env = { IMAGE_TAG: tag };
  console.log(`▶ QA con imágenes :${tag}`);
  if (!values['no-pull'] && compose(ENV, ['pull', 'backend', 'frontend'], { env }) !== 0) {
    die(`No se pudieron bajar las imágenes :${tag} (¿existe el tag? ¿docker login ghcr.io?)`);
  }
  if (compose(ENV, ['up', '-d', '--wait', '--wait-timeout', '120'], { env }) !== 0) {
    die(`QA no quedó healthy. Logs: docker ${composeArgs(ENV, 'logs').join(' ')}`);
  }
  writeFileSync('deploy/.qa-version', `${tag}\n`);
  console.log(`✔ QA arriba en http://localhost:${cfg.FRONT_PORT} (versión ${tag})`);
  if (values.restore) {
    await restoreFrom(ENV, values.restore, env);
    compose(ENV, ['restart', 'backend'], { env });
    console.log('✔ Datos restaurados en QA:', counts(ENV, env));
  }
}

async function reset() {
  const ok = await askWord('Se van a borrar los contenedores y TODOS los datos de QA (volumen gt-qa_db_data).', 'qa');
  if (!ok) die('Cancelado.');
  if (compose(ENV, ['down', '-v', '--remove-orphans'], { env: { IMAGE_TAG: 'none' } }) !== 0) die('Falló el reset');
  writeFileSync('deploy/.qa-version', '');
  console.log('✔ QA borrado');
}

switch (cmd) {
  case 'up': await up(); break;
  case 'down':
    process.exit(compose(ENV, ['down', '--remove-orphans'], { env: { IMAGE_TAG: 'none' } }));
    break;
  case 'reset': await reset(); break;
  default: die('Uso: qa.mjs up [--tag X] [--no-pull] [--restore archivo.sql.gz] | down | reset');
}
