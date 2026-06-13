const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
import pkg from '../package.json';
const FRONTEND_VERSION = pkg.version;

async function fetchBackendVersion() {
  try {
    const res = await fetch(`${API_URL}/version`);
    if (!res.ok) throw new Error('Failed to fetch backend version');
    const data = await res.json();
    return data.version;
  } catch {
    return null;
  }
}

export { API_URL as default, FRONTEND_VERSION, fetchBackendVersion };
