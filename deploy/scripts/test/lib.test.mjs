import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVersion,
  backupFileName,
  selectBackupsToDelete,
  checkDeployPreconditions,
  composeArgs,
  confirmWord,
  isOwnerStatement,
} from '../lib.mjs';

describe('parseVersion', () => {
  it('acepta con y sin v', () => {
    assert.equal(parseVersion('v1.5.0'), '1.5.0');
    assert.equal(parseVersion('1.5.0'), '1.5.0');
  });
  it('rechaza lo que no es SemVer', () => {
    assert.throws(() => parseVersion('1.5'), /SemVer/);
    assert.throws(() => parseVersion('latest'), /SemVer/);
    assert.throws(() => parseVersion(''), /SemVer/);
    assert.throws(() => parseVersion(undefined), /SemVer/);
  });
});

describe('backupFileName', () => {
  it('usa fecha y hora local y la versión', () => {
    assert.equal(
      backupFileName('1.5.0', new Date(2026, 10, 1, 9, 5, 7)),
      'gt-prod-20261101-090507-v1.5.0.sql.gz',
    );
  });
});

describe('selectBackupsToDelete', () => {
  const make = (i) => backupFileName('1.5.0', new Date(2026, 0, 1 + i, 12, 0, 0));

  it('devuelve los más viejos que exceden keep e ignora otros archivos', () => {
    const files = Array.from({ length: 32 }, (_, i) => make(i)).reverse();
    files.push('notas.txt', 'gt-qa-x.sql.gz');
    assert.deepEqual(selectBackupsToDelete(files, 30).sort(), [make(0), make(1)].sort());
  });
  it('ordena por la fecha del nombre, no por la versión', () => {
    const old = backupFileName('9.9.9', new Date(2025, 0, 1));
    const recent = backupFileName('1.0.0', new Date(2026, 0, 1));
    assert.deepEqual(selectBackupsToDelete([recent, old], 1), [old]);
  });
  it('no borra nada si hay menos que keep', () => {
    assert.deepEqual(selectBackupsToDelete([make(0), make(1)], 30), []);
  });
  it('keep por defecto es 30', () => {
    const files = Array.from({ length: 31 }, (_, i) => make(i));
    assert.deepEqual(selectBackupsToDelete(files), [make(0)]);
  });
});

describe('checkDeployPreconditions', () => {
  const base = { version: '1.5.0', releaseExists: true, imagesExist: true, qaVersion: '1.5.0' };

  it('aborta si el release no existe', () => {
    const r = checkDeployPreconditions({ ...base, releaseExists: false });
    assert.equal(r.ok, false);
    assert.match(r.reason, /release/i);
  });
  it('aborta si las imágenes no existen', () => {
    const r = checkDeployPreconditions({ ...base, imagesExist: false });
    assert.equal(r.ok, false);
    assert.match(r.reason, /im[aá]gen/i);
  });
  it('pide confirmar si QA probó otra versión', () => {
    const r = checkDeployPreconditions({ ...base, qaVersion: '1.4.1' });
    assert.equal(r.ok, true);
    assert.equal(r.needsConfirm, true);
  });
  it('pide confirmar si QA nunca se levantó', () => {
    const r = checkDeployPreconditions({ ...base, qaVersion: null });
    assert.equal(r.ok, true);
    assert.equal(r.needsConfirm, true);
  });
  it('no pide confirmar si QA probó la misma versión', () => {
    const r = checkDeployPreconditions(base);
    assert.equal(r.ok, true);
    assert.equal(r.needsConfirm, false);
  });
});

describe('composeArgs', () => {
  it('arma el comando de prod con proyecto, env y override', () => {
    assert.deepEqual(composeArgs('prod', 'up', '-d'), [
      'compose', '-p', 'gt-prod', '--env-file', 'deploy/prod.env',
      '-f', 'deploy/compose.yaml', '-f', 'deploy/compose.prod.yaml', 'up', '-d',
    ]);
  });
  it('arma el comando de qa', () => {
    assert.deepEqual(composeArgs('qa', 'down').slice(0, 3), ['compose', '-p', 'gt-qa']);
  });
  it('rechaza ambientes desconocidos', () => {
    assert.throws(() => composeArgs('dev', 'up'), /ambiente/i);
  });
});

describe('confirmWord', () => {
  it('compara exacto, sin tolerar espacios ni mayúsculas', () => {
    assert.equal(confirmWord('prod', 'prod'), true);
    assert.equal(confirmWord('prod ', 'prod'), false);
    assert.equal(confirmWord('PROD', 'prod'), false);
    assert.equal(confirmWord('', 'qa'), false);
    assert.equal(confirmWord(undefined, 'qa'), false);
  });
});

describe('isOwnerStatement', () => {
  it('detecta los ALTER ... OWNER TO de pg_dump', () => {
    assert.equal(isOwnerStatement('ALTER TABLE public.games OWNER TO postgres;'), true);
    assert.equal(isOwnerStatement('ALTER SEQUENCE public.games_id_seq OWNER TO postgres;'), true);
    assert.equal(isOwnerStatement('ALTER VIEW public.v OWNER TO "postgres";'), true);
  });
  it('no toca el resto del dump', () => {
    assert.equal(isOwnerStatement('ALTER TABLE ONLY public.games ADD CONSTRAINT games_pkey PRIMARY KEY (id);'), false);
    assert.equal(isOwnerStatement('1\tALTER TABLE x OWNER TO y;\t2020'), false);
    assert.equal(isOwnerStatement('CREATE TABLE public.games ('), false);
  });
});
