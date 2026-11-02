import React, { useState, useEffect } from 'react';
import API_URL from '../../config';
import { apiFetch, isSessionExpired } from '../../api';

const candidateLabel = (c) => {
  const year = c.year ? ` (${c.year})` : '';
  const platforms = c.platforms && c.platforms.length > 0 ? ` · ${c.platforms.join(', ')}` : '';
  return `${c.name}${year}${platforms}`;
};

function UnresolvedGames({ getHeaders, onDone }) {
  const [games, setGames] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiFetch(`${API_URL}/sagas/unresolved`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Error al cargar los juegos sin identificar');
        const json = await response.json();
        if (active) setGames(json);
      } catch (err) {
        if (isSessionExpired(err) || !active) return;
        setLoadError(err.message);
      }
    })();
    return () => { active = false; };
  }, [getHeaders]);

  const resolve = async (game, igdbId) => {
    setSavingId(game.id);
    setRowErrors((prev) => ({ ...prev, [game.id]: null }));
    try {
      const response = await apiFetch(`${API_URL}/games/${game.id}/igdb`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ igdb_id: igdbId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'No se pudo guardar');
      }
      const remaining = games.filter((g) => g.id !== game.id);
      setGames(remaining);
      if (remaining.length === 0) onDone();
    } catch (err) {
      if (isSessionExpired(err)) return;
      setRowErrors((prev) => ({ ...prev, [game.id]: err.message }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="saga-unresolved">
      <button type="button" className="btn btn-secondary" onClick={onDone}>Volver</button>

      {games === null && !loadError && <p className="status-message">Cargando...</p>}
      {loadError && <p className="wishlist-error">Error: {loadError}</p>}
      {games && games.length === 0 && (
        <p className="status-message empty">No hay juegos sin identificar.</p>
      )}

      {games && games.map((game) => {
        const busy = savingId === game.id;
        return (
          <div key={game.id} className="saga-unresolved-game">
            <h3>{game.title}</h3>
            <span className="saga-unresolved-console">{game.console_name}</span>
            <div className="saga-unresolved-candidates">
              {game.candidates.map((c) => (
                <button key={c.igdb_id} type="button" className="saga-candidate" disabled={busy}
                  onClick={() => resolve(game, c.igdb_id)}>
                  {c.cover_url && <img src={c.cover_url} alt="" loading="lazy" />}
                  <span>{candidateLabel(c)}</span>
                </button>
              ))}
              <button type="button" className="btn btn-secondary" disabled={busy}
                onClick={() => resolve(game, null)}>
                No es de ninguna saga
              </button>
            </div>
            {rowErrors[game.id] && <p className="saga-unresolved-error">{rowErrors[game.id]}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default UnresolvedGames;
