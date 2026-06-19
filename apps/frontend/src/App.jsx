import React, { useState, useEffect, useCallback } from 'react';
import GameForm from './components/GameForm';
import GameList from './components/GameList';
import Login from './components/Login';
import VersionBadge from './components/VersionBadge';
import SidePanels from './components/SidePanels';
import API_URL from './config';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedConsoleId, setSelectedConsoleId] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

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
      setGames(data.games || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    loadGames(filters);
  }, [filters, loadGames]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const handleGameDeleted = () => loadGames(filters);
  const handleGameUpdated = () => loadGames(filters);
  const handleGameAdded = () => loadGames(filters);

  if (!token) {
    return (
      <>
        <SidePanels consoleId={selectedConsoleId} />
        <Login onLogin={handleLogin} />
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
      <GameForm onGameAdded={handleGameAdded} getHeaders={getHeaders} onConsoleSelect={setSelectedConsoleId} />
      <GameList
        games={games}
        loading={loading}
        error={error}
        onRefresh={loadGames}
        onGameDeleted={handleGameDeleted}
        onGameUpdated={handleGameUpdated}
        getHeaders={getHeaders}
        isAuthenticated={!!token}
        onConsoleSelect={setSelectedConsoleId}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
}

export default App;
