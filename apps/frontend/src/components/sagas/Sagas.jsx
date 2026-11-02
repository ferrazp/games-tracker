import React, { useState, useEffect, useCallback, useRef } from 'react';
import API_URL from '../../config';
import { apiFetch, isSessionExpired } from '../../api';
import { countsLabel, unresolvedLabel } from './sagasText';
import SagaDetail from './SagaDetail';
import UnresolvedGames from './UnresolvedGames';
import './sagas.css';

const COLLAGE_SLOTS = 3;

function SagaCard({ saga, onOpen }) {
  const { counts } = saga;
  const pct = (n) => (counts.total > 0 ? (n / counts.total) * 100 : 0);
  const covers = saga.covers.slice(0, COLLAGE_SLOTS);

  return (
    <div className="saga-card" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>
      <div className="saga-collage">
        {Array.from({ length: COLLAGE_SLOTS }, (_, i) => (
          <div key={i} className="saga-collage-slot">
            {covers[i] && <img src={covers[i]} alt="" loading="lazy" />}
          </div>
        ))}
      </div>
      <div className="saga-card-body">
        <h3 className="saga-card-title">{saga.name}</h3>
        <div className="saga-bar">
          <div className="saga-bar-completed" style={{ width: `${pct(counts.completed)}%` }} />
          <div className="saga-bar-pending" style={{ width: `${pct(counts.pending)}%` }} />
        </div>
        <span className="saga-card-counts">{countsLabel(counts)}</span>
      </div>
    </div>
  );
}

function Sagas({ getHeaders, isAuthenticated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  const latestLoad = useRef(0);

  // Solo la última carga puede escribir el estado; las respuestas viejas se descartan.
  // Si un refresco falla, se muestra el error y se conserva la grilla anterior.
  const load = useCallback(async () => {
    const id = ++latestLoad.current;
    try {
      setError(null);
      setLoading(true);
      const response = await apiFetch(`${API_URL}/sagas`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Error al cargar sagas');
      const json = await response.json();
      if (id === latestLoad.current) setData(json);
    } catch (err) {
      if (isSessionExpired(err) || id !== latestLoad.current) return;
      setError(err.message);
    } finally {
      if (id === latestLoad.current) setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  if (selectedId !== null) {
    return (
      <SagaDetail
        sagaId={selectedId}
        onBack={() => { setSelectedId(null); load(); }}
        getHeaders={getHeaders}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  if (reviewing) {
    return <UnresolvedGames getHeaders={getHeaders} onDone={() => { setReviewing(false); load(); }} />;
  }

  const sagas = data?.sagas || [];

  return (
    <div className="sagas">
      <div className="wishlist-header">
        <h2>Sagas</h2>
      </div>

      {loading && !data && <p className="status-message">Cargando sagas...</p>}

      {error && (
        <div className="wishlist-error">
          <p>Error: {error}</p>
          <button onClick={load} className="btn btn-secondary">Reintentar</button>
        </div>
      )}

      {data && isAuthenticated && data.unresolved_count > 0 && (
        <button type="button" className="saga-unresolved-notice" onClick={() => setReviewing(true)}>
          {unresolvedLabel(data.unresolved_count)}
        </button>
      )}

      {data && !data.configured && (
        <p className="status-message empty">Para ver sagas hace falta configurar las credenciales de IGDB.</p>
      )}

      {data && data.configured && sagas.length === 0 && (
        <p className="status-message empty">
          Todavía no hay sagas: registrá un juego que pertenezca a una serie y aparece acá.
        </p>
      )}

      {sagas.length > 0 && (
        <div className="saga-grid">
          {sagas.map((saga) => (
            <SagaCard key={saga.id} saga={saga} onOpen={() => setSelectedId(saga.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Sagas;
