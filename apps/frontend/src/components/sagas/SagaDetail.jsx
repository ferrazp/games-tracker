import React from 'react';

// Stub: el detalle real se implementa en la Task 7.
export default function SagaDetail({ sagaId, onBack }) {
  return (
    <div className="saga-detail">
      <button type="button" className="btn btn-secondary" onClick={onBack}>← Volver</button>
      <p>Saga {sagaId}</p>
    </div>
  );
}
