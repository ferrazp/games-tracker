import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendPkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/version', (req, res) => {
  res.json({ version: backendPkg.version, name: backendPkg.name });
});

export default router;
