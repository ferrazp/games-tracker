import React, { useState, useEffect, useCallback, useRef } from 'react';
import API_URL from '../../config';
import { apiFetch, isSessionExpired } from '../../api';
import { countsLabel } from './sagasText';
import SuggestPanel from './SuggestPanel';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'completed', label: 'Completados', empty: 'Todavía no completaste ninguno.' },
  { key: 'pending', label: 'Pendientes', empty: 'No tenés ninguno pendiente.' },
  { key: 'missing', label: 'Te faltan', empty: 'No te falta ninguno.' },
];

const BADGES = { completed: '✓', pending: '…' };

function Cover({ game, onSuggest }) {
  const [broken, setBroken] = useState(false);
  const missing = game.status === 'missing';
  const showImage = game.cover_url && !broken;

  const interactive = missing
    ? {
      role: 'button',
      tabIndex: 0,
      onClick: () => onSuggest(game.igdb_id),
      onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); onSuggest(game.igdb_id); } },
    }
    : {};

  return (
    <div className={`saga-cover ${game.status}${showImage ? '' : ' no-image'}`} title={game.name} {...interactive}>
      {showImage && <img src={game.cover_url} alt={game.name} loading="lazy" onError={() => setBroken(true)} />}
      <span className="saga-cover-name">{game.name}</span>
      {BADGES[game.status] && <span className={`saga-badge ${game.status}`}>{BADGES[game.status]}</span>}
      {missing && <span className="saga-cover-search" aria-hidden="true">🔍</span>}
      {missing && <span className="saga-cover-hint">Sugerir</span>}
    </div>
  );
}

export default function SagaDetail({ sagaId, onBack, getHeaders, isAuthenticated }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [suggestId, setSuggestId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  const latestLoad = useRef(0);

  // Solo la última carga puede escribir el estado.
  const load = useCallback(async () => {
    const id = ++latestLoad.current;
    try {
      setError(null);
      const response = await apiFetch(`${API_URL}/sagas/${sagaId}`, { headers: getHeaders() });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Error al cargar la saga');
      if (id === latestLoad.current) setDetail(json);
    } catch (err) {
      if (isSessionExpired(err) || id !== latestLoad.current) return;
      setError(err.message);
    }
  }, [sagaId, getHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await apiFetch(`${API_URL}/sagas/${sagaId}/refresh`, { method: 'POST', headers: getHeaders() });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'No se pudo actualizar la saga');
      latestLoad.current++; // una carga en vuelo no debe pisar el resultado
      setDetail(json);
    } catch (err) {
      if (!isSessionExpired(err)) setRefreshError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (!detail) {
    return (
      <div className="saga-detail">
        <button type="button" className="btn btn-secondary" onClick={onBack}>← Volver</button>
        {error
          ? (
            <div className="wishlist-error">
              <p>Error: {error}</p>
              <button onClick={load} className="btn btn-secondary">Reintentar</button>
            </div>
          )
          : <p className="status-message">Cargando saga...</p>}
      </div>
    );
  }

  const groups = detail.groups
    .map((g) => ({ ...g, games: g.games.filter((game) => filter === 'all' || game.status === filter) }))
    .filter((g) => g.games.length > 0);
  const emptyText = groups.length === 0 ? FILTERS.find((f) => f.key === filter)?.empty : null;

  return (
    <div className="saga-detail">
      <div className="saga-detail-header">
        <button type="button" className="btn btn-secondary" onClick={onBack}>← {detail.name}</button>
        <span className="saga-muted">{countsLabel(detail.counts)}</span>
        {isAuthenticated && (
          <button type="button" className="btn btn-secondary saga-refresh" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Actualizar saga'}
          </button>
        )}
      </div>
      {refreshError && <p className="saga-error">{refreshError}</p>}

      <div className="saga-filters">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={`saga-filter${filter === f.key ? ' active' : ''}`}
            aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {emptyText && <p className="status-message empty">{emptyText}</p>}

      {groups.map((g) => (
        <section key={g.year ?? 'sin-fecha'} className="saga-year-group">
          <h3 className="saga-year">{g.year ?? 'Sin fecha'}</h3>
          <div className="saga-covers">
            {g.games.map((game) => <Cover key={game.igdb_id} game={game} onSuggest={setSuggestId} />)}
          </div>
        </section>
      ))}

      {suggestId !== null && <SuggestPanel igdbId={suggestId} onClose={() => setSuggestId(null)} />}
    </div>
  );
}
