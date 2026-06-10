import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import API_URL from '../config';

function GameForm({ onGameAdded, getHeaders }) {
  const searchTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const CURRENT_YEAR = new Date().getFullYear();
  const [game, setGame] = useState({
    title: '',
    consoleId: '',
    playedAt: null,
    completed: false,
    completedAt: null,
    hoursPlayed: '',
    image: '',
    releaseYear: ''
  });
  const [consoles, setConsoles] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [titleLocked, setTitleLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [onlineSearching, setOnlineSearching] = useState(false);
  const [onlineResults, setOnlineResults] = useState([]);

  useEffect(() => {
    const fetchConsoles = async () => {
      try {
        const response = await fetch(`${API_URL}/consoles`);
        if (!response.ok) throw new Error('Error al cargar consolas');
        const data = await response.json();
        setConsoles(data.consoles || []);
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    };
    fetchConsoles();

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setGame(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleConsoleChange = (e) => {
    const value = e.target.value;
    setGame(prev => ({ ...prev, consoleId: value, playedAt: null }));
    if (game.title.length > 0) {
      triggerSearch(game.title, value);
    }
  };

  const triggerSearch = (title, consoleId) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const body = { query: title };
        if (consoleId && consoleId !== '') {
          body.console_id = parseInt(consoleId, 10);
        }
        const response = await fetch(`${API_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          setSearchResults([]);
          setOnlineAvailable(false);
          return;
        }
        const data = await response.json();
        setSearchResults(data.results || []);
        setOnlineAvailable(data.online_available || false);
      } catch (err) {
        setSearchResults([]);
      }
    }, 400);
  };

  const handleTitleChange = (e) => {
    const value = e.target.value;
    setGame(prev => ({ ...prev, title: value }));
    if (titleLocked) setTitleLocked(false);

    if (value.length > 0) {
      triggerSearch(value, game.consoleId);
      setOnlineResults([]);
    } else {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      setSearchResults([]);
      setOnlineAvailable(false);
      setOnlineResults([]);
    }
  };

  const handleOnlineSearch = async () => {
    setOnlineSearching(true);
    setFeedback(null);
    try {
      const response = await fetch(`${API_URL}/search/online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: game.title }),
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

  const convertImageToBase64 = async (imageUrl) => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleGameSelection = async (selectedGame) => {
    const cover = selectedGame.cover?.url || '';
    let image = '';

    if (cover.startsWith('data:')) {
      image = cover;
    } else if (cover) {
      try {
        const url = cover.startsWith('http')
          ? cover.replace('/t_thumb/', '/t_cover_big/')
          : `https:${cover.replace('/t_thumb/', '/t_cover_big/')}`;
        image = await convertImageToBase64(url);
      } catch (err) {
        setFeedback({ type: 'error', text: 'Error al cargar imagen' });
      }
    }

    let consoleId = game.consoleId;
    if (!consoleId && selectedGame.console_name) {
      const match = consoles.find(c =>
        c.name.toLowerCase() === selectedGame.console_name.toLowerCase()
      );
      if (match) consoleId = match.id.toString();
    }

    if (!consoleId && selectedGame.platform_name) {
      try {
        const response = await fetch(`${API_URL}/consoles`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ name: selectedGame.platform_name }),
        });
        if (response.ok) {
          const data = await response.json();
          consoleId = data.console.id.toString();
          setConsoles(prev => [...prev, data.console]);
        }
      } catch (err) {
        // ignore — user can select manually
      }
    }

    const releaseTs = selectedGame.first_release_date || selectedGame.release_date;
    const releaseYear = releaseTs ? new Date(releaseTs * 1000).getFullYear().toString() : '';

    setGame(prev => ({
      ...prev,
      title: selectedGame.name,
      consoleId,
      image,
      releaseYear
    }));
    setTitleLocked(true);
    setSearchResults([]);
    setOnlineResults([]);
    setOnlineAvailable(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'Solo se permiten imágenes' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'La imagen no debe superar 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setGame(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    setGame(prev => ({ ...prev, image: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!titleLocked) {
      setFeedback({ type: 'error', text: 'Seleccioná un juego del catálogo desde los resultados de búsqueda' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_URL}/games`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: game.title,
          console_id: game.consoleId,
          year_played: game.playedAt ? game.playedAt.getFullYear() : null,
          month_played: game.playedAt ? game.playedAt.getMonth() + 1 : null,
          year_completed: game.completedAt ? game.completedAt.getFullYear() : null,
          month_completed: game.completedAt ? game.completedAt.getMonth() + 1 : null,
          hours_played: game.hoursPlayed !== '' ? parseFloat(game.hoursPlayed) : null,
          completed: game.completed,
          image: game.image,
          release_year: game.releaseYear !== '' ? parseInt(game.releaseYear, 10) : null
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al guardar');

      setFeedback({ type: 'success', text: 'Juego agregado correctamente' });
      setGame({
        title: '',
        consoleId: '',
        playedAt: null,
        completed: false,
        completedAt: null,
        hoursPlayed: '',
        image: '',
        releaseYear: ''
      });
      setTitleLocked(false);
      onGameAdded();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="game-form">
      {feedback && (
        <div className={`feedback feedback-${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <div className="game-form-console-row">
        <div className="game-form-field">
          <label htmlFor="consoleId">Consola</label>
          <select
            id="consoleId"
            name="consoleId"
            value={game.consoleId}
            onChange={handleConsoleChange}
          >
            <option value="">Todas las consolas</option>
            {consoles.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="game-form-title-row">
        <div className="game-form-title-field">
          <label htmlFor="title">Título</label>
          <input
            type="text"
            id="title"
            name="title"
            value={game.title}
            onChange={handleTitleChange}
            placeholder="Buscá un juego del catálogo..."
            required
          />
          {!titleLocked && game.title.length > 0 && (
            <span className="game-form-hint">Seleccioná un juego de la lista de resultados</span>
          )}
        </div>

        <div className="game-form-image-preview">
          {game.image ? (
            <div className="game-form-preview-wrapper">
              <img src={game.image} alt="Preview" />
              <button type="button" className="game-form-remove-img" onClick={removeImage} title="Quitar imagen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ) : (
            <button type="button" className="game-form-upload-btn" onClick={() => fileInputRef.current?.click()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Imagen
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {searchResults.length > 0 && (
        <ul className="search-results">
          {searchResults.map(result => (
            <li key={result.id} onClick={() => handleGameSelection(result)} className="search-result-item">
              {result.cover && (
                <img
                  src={result.cover.url.startsWith('data:') ? result.cover.url : `https:${result.cover.url.replace('t_thumb', 't_cover_big')}`}
                  alt=""
                  className="search-result-cover"
                />
              )}
              <div className="search-result-info">
                <span className="search-result-name">{result.name}</span>
                <div className="search-result-meta">
                  {result.console_name && (
                    <span className="search-result-console">{result.console_name}</span>
                  )}
                  {result.release_date && (
                    <span className="search-result-year">{new Date(result.release_date * 1000).getFullYear()}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {searchResults.length === 0 && !titleLocked && onlineAvailable && !onlineSearching && (
        <button type="button" className="btn-online-search" onClick={handleOnlineSearch}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10.5" cy="10.5" r="7.5"/>
            <line x1="21" y1="21" x2="15.8" y2="15.8"/>
          </svg>
          Buscar en IGDB
        </button>
      )}

      {onlineSearching && (
        <div className="online-searching">
          <span className="spinner" /> Buscando en IGDB...
        </div>
      )}

      {onlineResults.length > 0 && (
        <ul className="search-results search-results-online">
          <li className="search-results-header">Resultados de IGDB:</li>
          {onlineResults.map(result => (
            <li key={result.id} onClick={() => handleGameSelection(result)} className="search-result-item">
              {result.cover && (
                <img
                  src={`https:${result.cover.url.replace('t_thumb', 't_cover_big')}`}
                  alt=""
                  className="search-result-cover"
                />
              )}
              <div className="search-result-info">
                <span className="search-result-name">{result.name}</span>
                <div className="search-result-meta">
                  {result.console_name && (
                    <span className="search-result-console">{result.console_name}</span>
                  )}
                  {result.first_release_date && (
                    <span className="search-result-year">{new Date(result.first_release_date * 1000).getFullYear()}</span>
                  )}
                  <span className="search-result-online-tag">IGDB</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="game-form-fields">
        <div className="game-form-field">
          <label htmlFor="playedAt">Fecha jugado</label>
          <DatePicker
            selected={game.playedAt}
            onChange={(date) => setGame(prev => ({ ...prev, playedAt: date }))}
            showMonthYearPicker
            dateFormat="MM/yyyy"
            placeholderText={game.consoleId ? "Mes y año" : "Primero seleccioná una consola"}
            disabled={!game.consoleId}
            minDate={(() => {
              const c = consoles.find(c => c.id === parseInt(game.consoleId));
              return c?.launch_year ? new Date(c.launch_year, 0, 1) : undefined;
            })()}
            maxDate={new Date(CURRENT_YEAR, 11, 31)}
          />
        </div>

        <div className="game-form-field game-form-field-checkbox">
          <label htmlFor="completed">Completado</label>
          <input type="checkbox" id="completed" name="completed" checked={game.completed} onChange={handleChange} />
        </div>
      </div>

      {game.completed && (
        <div className="game-form-fields">
          <div className="game-form-field">
            <label htmlFor="completedAt">Fecha completado</label>
            <DatePicker
              selected={game.completedAt}
              onChange={(date) => setGame(prev => ({ ...prev, completedAt: date }))}
              showMonthYearPicker
              dateFormat="MM/yyyy"
              placeholderText="Mes y año"
              maxDate={new Date(CURRENT_YEAR, 11, 31)}
            />
          </div>

          <div className="game-form-field">
            <label htmlFor="hoursPlayed">Horas jugadas</label>
            <input
              type="number"
              id="hoursPlayed"
              name="hoursPlayed"
              value={game.hoursPlayed}
              onChange={handleChange}
              placeholder="Opcional"
              min="0"
              step="0.1"
            />
          </div>
        </div>
      )}

      <button type="submit" className="game-form-submit" disabled={submitting || !titleLocked}>
        {submitting ? 'Guardando...' : titleLocked ? 'Agregar juego' : 'Seleccioná un juego del catálogo'}
      </button>
    </form>
  );
}

export default GameForm;
