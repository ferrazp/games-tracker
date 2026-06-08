import React, { useState, useEffect, useCallback } from 'react';
import GameForm from './components/GameForm';
import GameList from './components/GameList';
import Login from './components/Login';
import VersionBadge from './components/VersionBadge';
import API_URL from './config';
import './App.css';

function App() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const getHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  const loadGames = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/games`);
      if (!response.ok) throw new Error('Error al cargar juegos');
      const data = await response.json();
      setGames(data.games || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

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

  const handleGameDeleted = () => loadGames();
  const handleGameUpdated = () => loadGames();
  const handleGameAdded = () => loadGames();

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
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
      <GameForm onGameAdded={handleGameAdded} getHeaders={getHeaders} />
      <GameList
        games={games}
        loading={loading}
        error={error}
        onRefresh={loadGames}
        onGameDeleted={handleGameDeleted}
        onGameUpdated={handleGameUpdated}
        getHeaders={getHeaders}
        isAuthenticated={!!token}
      />
    </div>
  );
}

export default App;
