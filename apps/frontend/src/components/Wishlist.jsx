import React, { useState, useEffect, useRef } from 'react';
import API_URL from '../config';

function getCoverSrc(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http:') || url.startsWith('https:')) return url.replace('t_thumb', 't_cover_big');
  return `https:${url.replace('t_thumb', 't_cover_big')}`;
}

function Wishlist({ getHeaders }) {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [onlineSearching, setOnlineSearching] = useState(false);
  const [onlineResults, setOnlineResults] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    loadWishlist();
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const loadWishlist = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch(`${API_URL}/wishlist`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Error al cargar próximos juegos');
      const data = await response.json();
      setWishlist(data.games || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerSearch = (query) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query || query.length < 2) {
      setSearchResults([]);
      setOnlineAvailable(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        if (!response.ok) {
          setSearchResults([]);
          setOnlineAvailable(false);
          return;
        }
        const data = await response.json();
        setSearchResults(data.results || []);
        setOnlineAvailable(data.online_available || false);
      } catch {
        setSearchResults([]);
      }
    }, 400);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setOnlineResults([]);
    triggerSearch(value);
  };

  const handleOnlineSearch = async () => {
    setOnlineSearching(true);
    setFeedback(null);
    try {
      const response = await fetch(`${API_URL}/search/online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al buscar en IGDB');
      }
      const data = await response.json();
      setOnlineResults(data.results || []);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setOnlineSearching(false);
    }
  };

  const addToWishlist = async (game) => {
    setFeedback(null);
    try {
      const body = game.catalog_id
        ? { game_catalog_id: game.catalog_id }
        : {
            igdb_id: game.id,
            title: game.name,
            console_name: game.console_name || null,
            cover_url: game.cover?.url || null
          };
      const response = await fetch(`${API_URL}/wishlist`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al agregar');
      setFeedback({ type: 'success', text: 'Agregado a próximos juegos' });
      setSearchQuery('');
      setSearchResults([]);
      setOnlineResults([]);
      loadWishlist();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const removeFromWishlist = async (id) => {
    if (!window.confirm('¿Quitar de la lista?')) return;
    try {
      const response = await fetch(`${API_URL}/wishlist/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Error al quitar');
      loadWishlist();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const moveItem = async (id, direction) => {
    const idx = wishlist.findIndex(g => g.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === wishlist.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const items = wishlist.map((g, i) => ({
      id: g.id,
      sort_order: i === idx ? wishlist[targetIdx].sort_order
               : i === targetIdx ? wishlist[idx].sort_order
               : g.sort_order
    }));

    try {
      const response = await fetch(`${API_URL}/wishlist/reorder`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ items }),
      });
      if (!response.ok) throw new Error('Error al reordenar');
      loadWishlist();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="wishlist">
      <div className="wishlist-header">
        <h2>Próximos Juegos</h2>
      </div>

      {feedback && (
        <div className={`feedback feedback-${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <div className="wishlist-search">
        <input
          type="text"
          className="wishlist-search-input"
          placeholder="Buscá un juego del catálogo para agregar..."
          value={searchQuery}
          onChange={handleSearchChange}
        />

        {searchResults.length > 0 && (
          <ul className="wishlist-search-results">
            {searchResults.map(result => (
              <li key={result.id} className="wishlist-search-item">
                {result.cover && (
                  <img
                    src={getCoverSrc(result.cover.url)}
                    alt=""
                    className="wishlist-search-cover"
                  />
                )}
                <div className="wishlist-search-info">
                  <span className="wishlist-search-name">{result.name}</span>
                  {result.console_name && (
                    <span className="wishlist-search-console">{result.console_name}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="wishlist-add-btn"
                  onClick={() => addToWishlist(result)}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        )}

        {searchQuery.length >= 2 && onlineAvailable && !onlineSearching && (
          <button type="button" className="btn-online-search" onClick={handleOnlineSearch}>
            Buscar en IGDB
          </button>
        )}

        {onlineSearching && (
          <div className="online-searching">
            <span className="spinner" /> Buscando en IGDB...
          </div>
        )}

        {onlineResults.length > 0 && (
          <ul className="wishlist-search-results wishlist-search-results-online">
            <li className="wishlist-search-header">Resultados de IGDB:</li>
            {onlineResults.map(result => (
              <li key={result.id} className="wishlist-search-item">
                {result.cover && (
                  <img
                    src={getCoverSrc(result.cover.url)}
                    alt=""
                    className="wishlist-search-cover"
                  />
                )}
                <div className="wishlist-search-info">
                  <span className="wishlist-search-name">{result.name}</span>
                  <div className="search-result-meta">
                    {result.console_name && (
                      <span className="wishlist-search-console">{result.console_name}</span>
                    )}
                    <span className="search-result-online-tag">IGDB</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="wishlist-add-btn"
                  onClick={() => addToWishlist(result)}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && <p className="status-message">Cargando próximos juegos...</p>}

      {error && (
        <div className="wishlist-error">
          <p>Error: {error}</p>
          <button onClick={loadWishlist} className="btn btn-secondary">Reintentar</button>
        </div>
      )}

      {!loading && !error && wishlist.length === 0 && (
        <p className="status-message empty">
          No hay juegos en tu lista. Buscá arriba para agregar.
        </p>
      )}

      {wishlist.length > 0 && (
        <div className="wishlist-items">
          {wishlist.map((game, idx) => (
            <div key={game.id} className="wishlist-item">
              <div className="wishlist-item-order">
                <button
                  type="button"
                  className="wishlist-move-btn"
                  onClick={() => moveItem(game.id, 'up')}
                  disabled={idx === 0}
                  title="Subir"
                >
                  ↑
                </button>
                <span className="wishlist-item-num">{idx + 1}</span>
                <button
                  type="button"
                  className="wishlist-move-btn"
                  onClick={() => moveItem(game.id, 'down')}
                  disabled={idx === wishlist.length - 1}
                  title="Bajar"
                >
                  ↓
                </button>
              </div>
              <div className="wishlist-item-cover">
                {game.cover_url ? (
                  <img
                    src={getCoverSrc(game.cover_url)}
                    alt={game.title}
                  />
                ) : (
                  <div className="game-card-no-image">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="wishlist-item-info">
                <span className="wishlist-item-title">{game.title}</span>
                {game.console_name && (
                  <span className="wishlist-item-console">{game.console_name}</span>
                )}
              </div>
              <button
                type="button"
                className="wishlist-remove-btn"
                onClick={() => removeFromWishlist(game.id)}
                title="Quitar de la lista"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Wishlist;
