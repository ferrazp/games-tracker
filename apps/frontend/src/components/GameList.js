import React, { useState, useEffect, useRef } from 'react';
import API_URL from '../config';

function GameList({ games, loading, error, onRefresh, onGameDeleted, onGameUpdated, getHeaders, isAuthenticated }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(null);
  const [consoles, setConsoles] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${API_URL}/consoles`)
        .then(r => r.json())
        .then(data => setConsoles(data.consoles || []))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const startEdit = (game) => {
    setEditingId(game.id);
    setEditForm({
      title: game.title,
      console_id: game.console_id,
      year_played: game.year_played || '',
      completed: game.completed,
      image: game.image || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'console_id' ? { year_played: '' } : {})
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

  const saveEdit = async (id) => {
    try {
      setSaving(id);
      const response = await fetch(`${API_URL}/games/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          title: editForm.title,
          console_id: editForm.console_id ? parseInt(editForm.console_id, 10) : null,
          year_played: editForm.year_played ? parseInt(editForm.year_played, 10) : null,
          completed: editForm.completed,
          image: editForm.image || null
        })
      });
      if (!response.ok) throw new Error('Error al actualizar');
      setEditingId(null);
      setEditForm({});
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
                  <select name="console_id" value={editForm.console_id} onChange={handleEditChange}>
                    <option value="">Consola</option>
                    {consoles.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input name="year_played" type="number" value={editForm.year_played} onChange={handleEditChange} placeholder={editForm.console_id ? "Año" : "Primero consola"} disabled={!editForm.console_id} min={(() => { const c = consoles.find(c => c.id === parseInt(editForm.console_id)); return c?.launch_year || 1950; })()} max={new Date().getFullYear()} className="game-edit-year" />
                  <label className="game-edit-completed">
                    <input name="completed" type="checkbox" checked={editForm.completed} onChange={handleEditChange} />
                    Completado
                  </label>
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
                <div className="game-meta">
                  <span>{game.year_played || '?'}</span>
                  <span className={`game-status ${game.completed ? 'completed' : 'pending'}`}>
                    {game.completed ? 'Completado' : 'Pendiente'}
                  </span>
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
