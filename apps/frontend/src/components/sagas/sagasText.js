// Textos de sagas; replican countsLabel del backend (services/sagas-logic.js).
export function countsLabel({ completed, pending, missing, total }) {
  const c = `${completed} ${completed === 1 ? 'completado' : 'completados'}`;
  const p = `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`;
  return `${c} · ${p} · te faltan ${missing} de ${total}`;
}

export function unresolvedLabel(count) {
  return `${count} ${count === 1 ? 'juego sin identificar' : 'juegos sin identificar'} — revisar`;
}
