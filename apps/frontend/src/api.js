// fetch para llamadas autenticadas. Si el backend responde 401 (token vencido o inválido),
// avisa a la app (que cierra la sesión y muestra el login) y corta el flujo del componente
// con un SessionExpiredError, para que no muestre su propio mensaje de error.
export const SESSION_EXPIRED_EVENT = 'gt:session-expired';

export class SessionExpiredError extends Error {
  constructor() {
    super('Tu sesión expiró');
    this.name = 'SessionExpiredError';
  }
}

export const isSessionExpired = (err) => err?.name === 'SessionExpiredError';

export async function apiFetch(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new SessionExpiredError();
  }
  return response;
}
