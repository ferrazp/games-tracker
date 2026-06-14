import React, { useState, useEffect, useRef } from 'react';
import API_URL from '../config';
import ConsoleImage from './ConsoleImage';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function GameList({ games, loading, error, onRefresh, onGameDeleted, onGameUpdated, getHeaders, isAuthenticated, onConsoleSelect }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(null);
  const [consoles, setConsoles] = useState([]);
  const [consoleDropdownOpen, setConsoleDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  const consoleRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${API_URL}/consoles`)
        .then(r => r.json())
        .then(data => setConsoles(data.consoles || []))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (consoleRef.current && !consoleRef.current.contains(e.target)) {
        setConsoleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const startEdit = (game) => {
    setEditingId(game.id);
    setEditForm({
      title: game.title,
      console_id: game.console_id,
      year_played: game.year_played || '',
      month_played: game.month_played || '',
      year_completed: game.year_completed || '',
      month_completed: game.month_completed || '',
      hours_played: game.hours_played || '',
      completed: game.completed,
      image: game.image || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    if (onConsoleSelect) onConsoleSelect(null);
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'console_id' ? { year_played: '', month_played: '' } : {})
    }));
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditForm(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeEditImage = () => {
    setEditForm(prev => ({ ...prev, image: '' }));
  };

  const buildEditPayload = () => ({
    title: editForm.title,
    console_id: editForm.console_id ? parseInt(editForm.console_id, 10) : null,
    year_played: editForm.year_played ? parseInt(editForm.year_played, 10) : null,
    month_played: editForm.month_played ? parseInt(editForm.month_played, 10) : null,
    year_completed: editForm.year_completed ? parseInt(editForm.year_completed, 10) : null,
    month_completed: editForm.month_completed ? parseInt(editForm.month_completed, 10) : null,
    hours_played: editForm.hours_played ? parseFloat(editForm.hours_played) : null,
    completed: editForm.completed,
    image: editForm.image || null
  });

  const saveEdit = async (id) => {
    const payload = buildEditPayload();
    if (payload.completed && payload.year_completed !== null && payload.year_played !== null) {
      if (payload.year_completed < payload.year_played) {
        alert('El año de completado no puede ser anterior al año de inicio');
        return;
      }
      if (payload.year_completed === payload.year_played && payload.month_completed !== null && payload.month_played !== null && payload.month_completed < payload.month_played) {
        alert('El mes de completado no puede ser anterior al mes de inicio en el mismo año');
        return;
      }
    }
    try {
      setSaving(id);
      const response = await fetch(`${API_URL}/games/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Error al actualizar');
      setEditingId(null);
      setEditForm({});
      if (onConsoleSelect) onConsoleSelect(null);
      onGameUpdated();
    } catch (err) {
      alert('Error al guardar cambios: ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  const deleteGame = async (id) => {
    if (!window.confirm('¿Eliminar este juego?')) return;
    try {
      setDeleting(id);
      const response = await fetch(`${API_URL}/games/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!response.ok) throw new Error('Error al eliminar');
      onGameDeleted();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const formatPlayed = (g) => {
    if (g.month_played && g.year_played) return `${MONTHS[g.month_played - 1]} ${g.year_played}`;
    if (g.year_played) return String(g.year_played);
    return '—';
  };

  const formatCompleted = (g) => {
    if (g.month_completed && g.year_completed) return `${MONTHS[g.month_completed - 1]} ${g.year_completed}`;
    if (g.year_completed) return String(g.year_completed);
    return null;
  };

  const formatHours = (g) => {
    if (g.hours_played == null) return null;
    const h = Number(g.hours_played);
    return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
  };

  if (loading) {
    return (
      <div className="game-list">
        <h2>Lista de Juegos</h2>
        <p className="status-message">Cargando juegos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-list">
        <h2>Lista de Juegos</h2>
        <p className="status-message error">Error: {error}</p>
        <button onClick={onRefresh} className="btn btn-secondary">Reintentar</button>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="game-list">
        <h2>Lista de Juegos</h2>
        <p className="status-message empty">No hay juegos registrados aún. Agregá uno arriba.</p>
      </div>
    );
  }

  return (
    <div className="game-list">
      <h2>Lista de Juegos ({games.length})</h2>
      {games.map(game => (
        <div key={game.id} className="game-card">
          {editingId === game.id ? (
            <div className="game-edit-form">
              <div className="game-edit-image">
                {editForm.image ? (
                  <div className="game-edit-preview-wrapper">
                    <img src={editForm.image} alt="Preview" />
                    <button type="button" className="game-form-remove-img" onClick={removeEditImage}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button type="button" className="game-form-upload-btn" onClick={() => fileInputRef.current?.click()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <div className="game-edit-fields">
                <input name="title" value={editForm.title} onChange={handleEditChange} placeholder="Título" />
                <div className="game-edit-row">
                  <div className="console-edit-wrapper" ref={consoleRef}>
                    <button
                      type="button"
                      className="console-edit-trigger"
                      onClick={() => setConsoleDropdownOpen(!consoleDropdownOpen)}
                    >
                      {editForm.console_id ? (() => {
                        const c = consoles.find(c => String(c.id) === editForm.console_id);
                        return c?.image
                          ? <ConsoleImage console={c} className="console-edit-trigger-img" />
                          : <span className="console-edit-trigger-text">?</span>;
                      })() : <span className="console-edit-trigger-text">?</span>}
                      <span className="console-dropdown-arrow">{consoleDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {consoleDropdownOpen && (
                      <div className="console-dropdown-panel console-dropdown-panel-compact">
                        {consoles.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className={`console-dropdown-item${editForm.console_id === String(c.id) ? ' selected' : ''}`}
                            onClick={() => {
                              handleEditChange({ target: { name: 'console_id', value: String(c.id) } });
                              setConsoleDropdownOpen(false);
                              if (onConsoleSelect) onConsoleSelect(c.id);
                            }}
                          >
                            <ConsoleImage console={c} className="console-dropdown-item-img" />
                            <span>{c.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    name="year_played"
                    type="number"
                    value={editForm.year_played}
                    onChange={handleEditChange}
                    placeholder={editForm.console_id ? "Año" : "Primero consola"}
                    disabled={!editForm.console_id}
                    min={(() => { const c = consoles.find(c => c.id === parseInt(editForm.console_id)); return c?.launch_year || 1950; })()}
                    max={new Date().getFullYear()}
                    className="game-edit-year"
                  />
                  <input
                    name="month_played"
                    type="number"
                    value={editForm.month_played}
                    onChange={handleEditChange}
                    placeholder="Mes"
                    disabled={!editForm.console_id}
                    min="1"
                    max="12"
                    className="game-edit-year"
                  />
                </div>
                <div className="game-edit-row">
                  <label className="game-edit-completed">
                    <input name="completed" type="checkbox" checked={editForm.completed} onChange={handleEditChange} />
                    Completado
                  </label>
                  {editForm.completed && (
                    <>
                      <input
                        name="year_completed"
                        type="number"
                        value={editForm.year_completed}
                        onChange={handleEditChange}
                        placeholder="Año fin"
                        min="1950"
                        max={new Date().getFullYear()}
                        className="game-edit-year"
                      />
                      <input
                        name="month_completed"
                        type="number"
                        value={editForm.month_completed}
                        onChange={handleEditChange}
                        placeholder="Mes"
                        min="1"
                        max="12"
                        className="game-edit-year"
                      />
                    </>
                  )}
                </div>
                <div className="game-edit-row">
                  <input
                    name="hours_played"
                    type="number"
                    value={editForm.hours_played}
                    onChange={handleEditChange}
                    placeholder="Horas (opcional)"
                    min="0"
                    step="0.1"
                    className="game-edit-year"
                    style={{ width: '140px' }}
                  />
                </div>
                <div className="game-actions">
                  <button onClick={() => saveEdit(game.id)} disabled={saving === game.id} className="btn btn-save">
                    {saving === game.id ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={cancelEdit} className="btn btn-secondary">Cancelar</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="game-card-image">
                {game.image ? (
                  <img src={game.image} alt={game.title} />
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
              <div className="game-info">
                <h3>{game.title}</h3>
                <p>{game.console_name || '—'}</p>
                {game.release_year && (
                  <div className="game-card-year">{game.release_year}</div>
                )}
                <div className="game-meta">
                  <span>Empecé a jugar: {formatPlayed(game)}</span>
                  <span className={`game-status ${game.completed ? 'completed' : 'pending'}`}>
                    {game.completed ? 'Completado' : 'Pendiente'}
                  </span>
                  {game.completed && formatCompleted(game) && (
                    <span className="game-meta-completed">{formatCompleted(game)}</span>
                  )}
                  {formatHours(game) && (
                    <span className="game-meta-hours">{formatHours(game)}</span>
                  )}
                </div>
              </div>
              {isAuthenticated && (
                <div className="game-actions">
                  <button onClick={() => startEdit(game)} className="btn btn-edit">Editar</button>
                  <button onClick={() => deleteGame(game.id)} disabled={deleting === game.id} className="btn btn-delete">
                    {deleting === game.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default GameList;
