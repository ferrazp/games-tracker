const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const FRONTEND_VERSION = process.env.REACT_APP_VERSION || '0.1.0';

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
