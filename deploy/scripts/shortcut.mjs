#!/usr/bin/env node
// Crea (o recrea) el acceso directo "Games Tracker" en el escritorio de Windows,
// apuntando a games-tracker.cmd de esta copia del repo.  Uso: npm run shortcut
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.error('✖ El acceso directo es solo para Windows.');
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = join(ROOT, 'games-tracker.cmd');
const icon = join(ROOT, 'apps', 'frontend', 'public', 'favicon.ico');
const q = (s) => `'${s.replace(/'/g, "''")}'`;

const ps = `
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Games Tracker.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = ${q(target)}
$s.WorkingDirectory = ${q(ROOT)}
$s.IconLocation = ${q(icon)}
$s.Description = 'Games Tracker: levantar y bajar Prod, QA y Dev'
$s.Save()
Write-Output $lnk
`;
const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
if (r.status !== 0) {
  console.error(`✖ No se pudo crear el acceso directo:\n${r.stderr}`);
  process.exit(1);
}
console.log(`✔ Acceso directo creado: ${r.stdout.trim()} → ${target}`);
