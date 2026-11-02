import React, { useState, useEffect } from 'react';
import API_URL from '../../config';

const versionText = (v) => (v.year ? `${v.label} (${v.year})` : v.label);

export default function SuggestPanel({ igdbId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`${API_URL}/sagas/games/${igdbId}/suggest`)
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar la sugerencia');
        return response.json();
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [igdbId]);

  return (
    <div className="saga-panel-backdrop" onClick={onClose}>
      <div className="saga-panel" role="dialog" aria-label="Sugerir" onClick={(e) => e.stopPropagation()}>
        {!data && !error && <p className="status-message">Cargando...</p>}
        {error && <p className="saga-error">{error}</p>}
        {data && (
          <>
            <h4 className="saga-panel-title">
              {data.name}
              {data.release_year && <span className="saga-muted"> · {data.release_year}</span>}
            </h4>

            <h5>Versiones que conoce IGDB</h5>
            <div className="saga-chips">
              {data.versions.map((v) => (
                v.label === data.suggested
                  ? <span key={v.label} className="saga-chip rec">★ {versionText(v)} · sugerida</span>
                  : <span key={v.label} className="saga-chip">{versionText(v)}</span>
              ))}
            </div>

            <h5>Seguí buscando</h5>
            <div className="saga-links">
              {data.links.map((l) => (
                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
              ))}
            </div>
          </>
        )}
        <button type="button" className="btn btn-secondary saga-panel-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
