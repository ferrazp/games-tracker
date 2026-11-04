import React, { useState, useEffect, useCallback, useRef } from 'react';
import API_URL from '../../config';
import { apiFetch, isSessionExpired } from '../../api';
import { countsLabel } from './sagasText';
import SuggestPanel from './SuggestPanel';
import LinkPanel from './LinkPanel';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'completed', label: 'Completados', empty: 'Todavía no completaste ninguno.' },
  { key: 'pending', label: 'Pendientes', empty: 'No tenés ninguno pendiente.' },
  { key: 'missing', label: 'Te faltan', empty: 'No te falta ninguno.' },
];

const BADGES = { completed: '✓', pending: '…' };

// Un color por grupo de versiones unidas, para ver cuáles van juntas.
const LINK_COLORS = ['#a29bfe', '#fd79a8', '#00cec9', '#fdcb6e', '#e17055', '#74b9ff', '#55efc4', '#ff7675'];

function coverTitle(game) {
  const link = game.link;
  if (!link || link.is_main || !link.main_name) return game.name;
  const year = link.main_year ? ` (${link.main_year})` : '';
  return `${game.name} — jugado en otra versión: ${link.main_name}${year}`;
}

function Cover({ game, color, onSuggest, onLink, onArchive }) {
  const [broken, setBroken] = useState(false);
  const missing = game.status === 'missing';
  const showImage = game.cover_url && !broken;

  const action = onArchive ? null
    : missing ? () => onSuggest(game.igdb_id)
      : onLink ? () => onLink(game.igdb_id)
        : null;
  const interactive = action
    ? {
      role: 'button',
      tabIndex: 0,
      onClick: action,
      onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); action(); } },
    }
    : {};

  return (
    <div className={`saga-cover ${game.status}${game.link ? ' linked' : ''}${showImage ? '' : ' no-image'}`}
      title={coverTitle(game)} style={color ? { '--link-color': color } : undefined} {...interactive}>
      {showImage && <img src={game.cover_url} alt={game.name} loading="lazy" onError={() => setBroken(true)} />}
      <span className="saga-cover-name">{game.name}</span>
      {BADGES[game.status] && (
        <span className={`saga-badge ${game.status}`}>
          {game.link?.is_main && <span className="saga-main-star" aria-label="principal">⭐</span>}
          {BADGES[game.status]}
        </span>
      )}
      {missing && !onArchive && <span className="saga-cover-search" aria-hidden="true">🔍</span>}
      {missing && !onArchive && <span className="saga-cover-hint">Sugerir</span>}
      {onArchive && (
        <button type="button" className="saga-cover-archive" aria-label={`Archivar ${game.name}`}
          onClick={(e) => { e.stopPropagation(); onArchive(game.igdb_id); }}>✕</button>
      )}
    </div>
  );
}

const MAX_SIDE_COVERS = 16;

// Portadas de los juegos de la saga, mezcladas, para los paneles de los costados.
function sideCoversOf(detail) {
  const urls = detail.groups.flatMap((g) => g.games.map((game) => game.cover_url)).filter(Boolean);
  for (let i = urls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [urls[i], urls[j]] = [urls[j], urls[i]];
  }
  return urls.slice(0, MAX_SIDE_COVERS);
}

export default function SagaDetail({ sagaId, onBack, getHeaders, isAuthenticated, onCovers }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [suggestId, setSuggestId] = useState(null);
  const [linkId, setLinkId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveError, setArchiveError] = useState(null);

  const latestLoad = useRef(0);
  const menuRef = useRef(null);

  // El menú se cierra al tocar afuera o con Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

  const onCoversRef = useRef(onCovers);
  onCoversRef.current = onCovers;
  useEffect(() => {
    if (detail) onCoversRef.current?.(sideCoversOf(detail));
  }, [detail]);

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

  // Archiva (PUT) o restaura (DELETE) un juego; el backend devuelve el detalle actualizado.
  const setArchived = async (igdbId, archive) => {
    setArchiveError(null);
    try {
      const response = await apiFetch(`${API_URL}/sagas/games/${igdbId}/archive`, {
        method: archive ? 'PUT' : 'DELETE',
        headers: getHeaders(),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'No se pudo archivar el juego');
      latestLoad.current++;
      setDetail(json);
    } catch (err) {
      if (!isSessionExpired(err)) setArchiveError(err.message);
    }
  };

  const chooseMenu = (action) => {
    setMenuOpen(false);
    if (action === 'archive') setArchiving(true);
    else setShowArchived((v) => !v);
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
  const archived = detail.archived ?? [];
  const allGames = detail.groups.flatMap((g) => g.games);
  const linkColors = new Map();
  for (const game of allGames) {
    const main = game.link?.main_igdb_id;
    if (main != null && !linkColors.has(main)) linkColors.set(main, LINK_COLORS[linkColors.size % LINK_COLORS.length]);
  }
  const linkGame = linkId !== null ? allGames.find((g) => g.igdb_id === linkId) : null;

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
        {isAuthenticated && (
          <div className="saga-menu" ref={menuRef}>
            <button type="button" className="saga-menu-toggle" aria-label="Más opciones"
              aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
            {menuOpen && (
              <div className="saga-menu-list" role="menu">
                <button type="button" role="menuitem" onClick={() => chooseMenu('archive')}>Archivar juegos</button>
                <button type="button" role="menuitem" onClick={() => chooseMenu('list')}>Archivados ({archived.length})</button>
              </div>
            )}
          </div>
        )}
      </div>
      {refreshError && <p className="saga-error">{refreshError}</p>}
      {archiveError && <p className="saga-error">{archiveError}</p>}

      {archiving && (
        <div className="saga-archive-bar">
          <span>Tocá la ✕ de los juegos que no quieras ver en esta saga.</span>
          <button type="button" className="btn btn-secondary" onClick={() => setArchiving(false)}>Listo</button>
        </div>
      )}

      {showArchived && (
        <section className="saga-archived">
          <h3 className="saga-year">Archivados</h3>
          {archived.length === 0
            ? <p className="saga-muted">No hay juegos archivados.</p>
            : (
              <ul>
                {archived.map((g) => (
                  <li key={g.igdb_id}>
                    <span>{g.name}{g.release_year && <span className="saga-muted"> · {g.release_year}</span>}</span>
                    <button type="button" className="btn btn-secondary" aria-label={`Restaurar ${g.name}`}
                      onClick={() => setArchived(g.igdb_id, false)}>Restaurar</button>
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}

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
            {g.games.map((game) => (
              <Cover key={game.igdb_id} game={game} onSuggest={setSuggestId}
                color={game.link ? linkColors.get(game.link.main_igdb_id) : null}
                onLink={isAuthenticated ? setLinkId : null}
                onArchive={archiving ? (id) => setArchived(id, true) : null} />
            ))}
          </div>
        </section>
      ))}

      {suggestId !== null && (
        <SuggestPanel igdbId={suggestId} onClose={() => setSuggestId(null)}
          onLinkOther={isAuthenticated ? () => { setLinkId(suggestId); setSuggestId(null); } : null} />
      )}
      {linkGame && (
        <LinkPanel game={linkGame} detail={detail} getHeaders={getHeaders} onClose={() => setLinkId(null)}
          onSaved={(json) => { latestLoad.current++; setDetail(json); setLinkId(null); }} />
      )}
    </div>
  );
}
