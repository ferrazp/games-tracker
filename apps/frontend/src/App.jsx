import React, { useState, useEffect, useCallback } from 'react';
import GameForm from './components/GameForm';
import GameList from './components/GameList';
import Wishlist from './components/Wishlist';
import Login from './components/Login';
import VersionBadge from './components/VersionBadge';
import SidePanels from './components/SidePanels';
import API_URL from './config';
import { SESSION_EXPIRED_EVENT } from './api';
import './App.css';

const DEFAULT_FILTERS = {
  q: '',
  console_id: '',
  year_played_from: '',
  year_played_to: '',
  year_completed_from: '',
  year_completed_to: '',
  completed: '',
  sort_by: 'created_at',
  sort_order: 'desc'
};

function App() {
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedConsoleId, setSelectedConsoleId] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showWishlist, setShowWishlist] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');

  const getHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  const buildQueryString = useCallback((f) => {
    const params = new URLSearchParams();
    if (f) {
      Object.entries(f).forEach(([key, val]) => {
        if (val !== '' && val !== null && val !== undefined) {
          params.set(key, val);
        }
      });
    }
    return params.toString();
  }, []);

  const loadGames = useCallback(async (filtersToUse) => {
    try {
      setError(null);
      setLoading(true);
      const qs = buildQueryString(filtersToUse);
      const url = `${API_URL}/games${qs ? '?' + qs : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al cargar juegos');
      const data = await response.json();
      const list = data.games || [];
      setGames(list);
      setTotal(data.total ?? list.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  const loadMoreGames = useCallback(async () => {
    try {
      setLoadingMore(true);
      const qs = buildQueryString({ ...filters, offset: games.length });
      const response = await fetch(`${API_URL}/games?${qs}`);
      if (!response.ok) throw new Error('Error al cargar más juegos');
      const data = await response.json();
      const more = data.games || [];
      setGames(prev => {
        const seen = new Set(prev.map(g => g.id));
        return [...prev, ...more.filter(g => !seen.has(g.id))];
      });
      if (data.total !== undefined) setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [buildQueryString, filters, games.length]);

  useEffect(() => {
    loadGames(filters);
  }, [filters, loadGames]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleLogin = (newToken, newUser) => {
    setSessionNotice('');
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = useCallback(() => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  // Token vencido: cualquier llamada autenticada que reciba 401 vuelve al login con un aviso.
  useEffect(() => {
    const onExpired = () => {
      handleLogout();
      setSessionNotice('Tu sesión expiró. Ingresá de nuevo para seguir.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [handleLogout]);

  const reloadGames = () => loadGames(filters);
  const handleGameDeleted = () => loadGames(filters);
  const handleGameUpdated = () => loadGames(filters);
  const handleGameAdded = () => loadGames(filters);

  if (!token) {
    return (
      <>
        <SidePanels consoleId={selectedConsoleId} />
        <Login onLogin={handleLogin} notice={sessionNotice} />
      </>
    );
  }

  return (
    <div className="App">
      <SidePanels consoleId={selectedConsoleId} />
      <div className="app-header">
        <h1>Registro de Juegos</h1>
        <div className="app-header-right">
          <VersionBadge />
          <div className="app-user">
          <span className="app-user-name">{user?.username}</span>
          <button onClick={handleLogout} className="btn btn-logout">Salir</button>
        </div>
        </div>
      </div>
      <div className="app-tabs">
        <button
          type="button"
          className={`app-tab ${!showWishlist ? 'active' : ''}`}
          onClick={() => setShowWishlist(false)}
        >
          Lista de Juegos
        </button>
        <button
          type="button"
          className={`app-tab ${showWishlist ? 'active' : ''}`}
          onClick={() => setShowWishlist(true)}
        >
          Próximos Juegos
        </button>
      </div>
      {showWishlist ? (
        <Wishlist getHeaders={getHeaders} />
      ) : (
        <>
          <GameForm onGameAdded={handleGameAdded} getHeaders={getHeaders} onConsoleSelect={setSelectedConsoleId} />
          <GameList
            games={games}
            loading={loading}
            error={error}
            onRefresh={reloadGames}
            total={total}
            onLoadMore={loadMoreGames}
            loadingMore={loadingMore}
            onGameDeleted={handleGameDeleted}
            onGameUpdated={handleGameUpdated}
            getHeaders={getHeaders}
            isAuthenticated={!!token}
            onConsoleSelect={setSelectedConsoleId}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </>
      )}
    </div>
  );
}

export default App;
