import React from 'react';

// Stub: la revisión de juegos sin identificar se implementa en la Task 8.
export default function UnresolvedGames({ onDone }) {
  return (
    <div className="saga-unresolved">
      <button type="button" className="btn btn-secondary" onClick={onDone}>Volver</button>
    </div>
  );
}
