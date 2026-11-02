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
  parseHistory,
  formatHistoryEntry,
  historyState,
  rollbackPlan,
  createLineFilter,
  checkVolumeName,
  parseEnvFile,
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

describe('historial de deploys', () => {
  const B1 = 'C:\Users\Juan Perez\backups\gt-prod-20260101-000000-v1.5.0.sql.gz';
  const line = (version, status, backup = null, note = '') => formatHistoryEntry({ version, status, backup, note });
  const hist = (...lines) => parseHistory(lines.join(''));

  it('ida y vuelta, con rutas con espacios', () => {
    const [e] = parseHistory(line('1.6.0', 'ok', B1));
    assert.deepEqual(e, { version: '1.6.0', status: 'ok', backup: B1, note: '' });
  });
  it('ignora líneas vacías', () => {
    assert.equal(parseHistory(`\n${line('1.5.0', 'ok')}\n\n`).length, 1);
  });
  it('estado: la versión corriendo es la del deploy fallido si lo hubo', () => {
    const s = historyState(hist(line('1.5.0', 'ok'), line('1.6.0', 'failed', B1)));
    assert.equal(s.current, '1.6.0');
    assert.equal(s.failed.version, '1.6.0');
    assert.deepEqual(s.stack.map((e) => e.version), ['1.5.0']);
  });

  describe('rollbackPlan', () => {
    it('tras un deploy fallido vuelve a la última ok y restaura el backup de ese intento', () => {
      const p = rollbackPlan(hist(
        line('1.5.0', 'ok'), line('1.6.0', 'ok', 'B1'), line('1.7.0', 'failed', 'B2'),
      ));
      assert.deepEqual(p, { from: '1.7.0', to: '1.6.0', restore: 'B2', kind: 'failed' });
    });
    it('tras un deploy ok vuelve a la anterior y restaura el backup previo a ese deploy', () => {
      const p = rollbackPlan(hist(line('1.5.0', 'ok'), line('1.6.0', 'ok', 'B1')));
      assert.deepEqual(p, { from: '1.6.0', to: '1.5.0', restore: 'B1', kind: 'ok' });
    });
    it('un segundo rollback sigue hacia atrás, no vuelve a la versión rota', () => {
      const p = rollbackPlan(hist(
        line('1.4.1', 'ok'), line('1.5.0', 'ok', 'B0'), line('1.6.0', 'ok', 'B1'),
        line('1.5.0', 'rollback', null, 'ok'),
      ));
      assert.deepEqual(p, { from: '1.5.0', to: '1.4.1', restore: 'B0', kind: 'ok' });
    });
    it('después de revertir un fallido, el siguiente rollback usa las ok', () => {
      const p = rollbackPlan(hist(
        line('1.5.0', 'ok'), line('1.6.0', 'ok', 'B1'), line('1.7.0', 'failed', 'B2'),
        line('1.6.0', 'rollback', null, 'failed'),
      ));
      assert.deepEqual(p, { from: '1.6.0', to: '1.5.0', restore: 'B1', kind: 'ok' });
    });
    it('redesplegar la misma versión no cuenta como versión anterior', () => {
      const p = rollbackPlan(hist(line('1.5.0', 'ok'), line('1.6.0', 'ok', 'B1'), line('1.6.0', 'ok', 'B2')));
      assert.equal(p.to, '1.5.0');
    });
    it('sin versión anterior devuelve null', () => {
      assert.equal(rollbackPlan(hist(line('1.5.0', 'ok'))), null);
      assert.equal(rollbackPlan([]), null);
      assert.equal(rollbackPlan(hist(line('1.5.0', 'failed'))), null);
    });
  });
});

describe('selectBackupsToDelete con protegidos', () => {
  it('no borra backups referenciados por el historial', () => {
    const files = Array.from({ length: 3 }, (_, i) => backupFileName('1.5.0', new Date(2026, 0, 1 + i)));
    assert.deepEqual(selectBackupsToDelete(files, 1, [files[0]]), [files[1]]);
  });
});

describe('createLineFilter', () => {
  const run = async (chunks, predicate) => {
    const f = createLineFilter(predicate);
    let out = '';
    f.on('data', (d) => { out += d; });
    const end = new Promise((res) => f.on('end', res));
    for (const c of chunks) f.write(c);
    f.end();
    await end;
    return out;
  };
  it('no corrompe caracteres multibyte partidos entre chunks', async () => {
    const buf = Buffer.from('Pokémon ñandú\nFinal Fantasy\n', 'utf8');
    const cut = buf.indexOf(Buffer.from('é')) + 1; // parte la é al medio
    const out = await run([buf.subarray(0, cut), buf.subarray(cut)], () => false);
    assert.equal(out, 'Pokémon ñandú\nFinal Fantasy\n');
  });
  it('saca las líneas que cumplen el predicado, incluida la última sin \n', async () => {
    const out = await run([Buffer.from('a\nDROP\nb\nDROP')], (l) => l === 'DROP');
    assert.equal(out, 'a\nb\n');
  });
});

describe('checkVolumeName', () => {
  it('exige el prefijo del ambiente', () => {
    assert.doesNotThrow(() => checkVolumeName('qa', 'gt-qa_db_data'));
    assert.doesNotThrow(() => checkVolumeName('prod', 'gt-prod_db_data'));
    assert.throws(() => checkVolumeName('qa', 'gt-prod_db_data'), /gt-qa/);
    assert.throws(() => checkVolumeName('prod', 'gt-qa_db_data'), /gt-prod/);
    assert.throws(() => checkVolumeName('qa', undefined), /gt-qa/);
  });
});

describe('parseEnvFile', () => {
  it('lee claves simples e ignora comentarios y líneas vacías', () => {
    assert.deepEqual(parseEnvFile('# comentario\nA=1\n\nB=dos\r\n'), { A: '1', B: 'dos' });
  });
  it('saca comillas dobles y simples, como docker compose', () => {
    const env = parseEnvFile('BACKUP_DIR="C:\Users\Juan Perez\backups"\nX=\'con espacios\'');
    assert.equal(env.BACKUP_DIR, 'C:\Users\Juan Perez\backups');
    assert.equal(env.X, 'con espacios');
  });
  it('mantiene el = dentro del valor y no toca comillas internas', () => {
    assert.deepEqual(parseEnvFile('JWT_SECRET=abc=def\nY=a"b'), { JWT_SECRET: 'abc=def', Y: 'a"b' });
  });
});
