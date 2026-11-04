import React, { useState, useEffect } from 'react';
import API_URL from '../../config';
import { apiFetch, isSessionExpired } from '../../api';

const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const label = (g) => `${g.name} · ${g.release_year ?? 'Sin fecha'}`;

// Panel para unir versiones de un mismo juego de la saga (p. ej. el III original y el 3D).
// Las unidas cuentan como jugadas; la principal es la que se marca con ⭐.
export default function LinkPanel({ game, detail, getHeaders, onClose, onSaved }) {
  const all = detail.groups.flatMap((group) => group.games);
  const groupMain = game.link?.main_igdb_id ?? null;
  const groupIds = groupMain == null
    ? []
    : all.filter((g) => g.link?.main_igdb_id === groupMain && g.igdb_id !== game.igdb_id).map((g) => g.igdb_id);

  const [selected, setSelected] = useState(() => new Set(groupIds));
  const [chosenMain, setChosenMain] = useState(groupMain);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const base = normalize(game.name);
  const others = all
    .filter((g) => g.igdb_id !== game.igdb_id)
    .sort((a, b) => (normalize(b.name) === base) - (normalize(a.name) === base)
      || a.name.localeCompare(b.name)
      || (a.release_year ?? 9999) - (b.release_year ?? 9999));
  const q = normalize(query);
  const shown = q ? others.filter((g) => normalize(g.name).includes(q)) : others;

  const members = [game, ...others.filter((g) => selected.has(g.igdb_id))];
  // Principal: la elegida; si no, la primera registrada del grupo; si no, este juego.
  const main = members.find((g) => g.igdb_id === chosenMain)
    ?? members.find((g) => g.registered)
    ?? game;

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const send = async (method, path, body) => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/sagas/${detail.id}/links${path}`, {
        method,
        headers: getHeaders(),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'No se pudieron unir las versiones');
      onSaved(json);
    } catch (err) {
      if (!isSessionExpired(err)) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const save = () => send('PUT', '', {
    main_igdb_id: main.igdb_id,
    igdb_ids: members.filter((g) => g.igdb_id !== main.igdb_id).map((g) => g.igdb_id),
  });

  const mainRadio = (g) => (
    <label className="saga-link-main">
      <input type="radio" name="saga-link-main" checked={main.igdb_id === g.igdb_id}
        onChange={() => setChosenMain(g.igdb_id)} aria-label={`Principal: ${label(g)}`} />
      ⭐ principal
    </label>
  );

  return (
    <div className="saga-panel-backdrop" onClick={onClose}>
      <div className="saga-panel" role="dialog" aria-label="Unir versiones" onClick={(e) => e.stopPropagation()}>
        <h4 className="saga-panel-title">Unir con otras versiones</h4>
        <p className="saga-muted">
          Marcá las versiones que para vos son el mismo juego: van a contar como jugadas.
        </p>

        <div className="saga-link-current">
          <span>{label(game)}{game.registered && <span className="saga-muted"> · registrado</span>}</span>
          {selected.size > 0 && mainRadio(game)}
        </div>

        <input type="search" className="saga-link-search" placeholder="Buscar en la saga"
          aria-label="Buscar en la saga" value={query} onChange={(e) => setQuery(e.target.value)} />

        <ul className="saga-link-list">
          {shown.map((g) => (
            <li key={g.igdb_id}>
              <label>
                <input type="checkbox" checked={selected.has(g.igdb_id)} onChange={() => toggle(g.igdb_id)} />
                {' '}{label(g)}{g.registered && <span className="saga-muted"> · registrado</span>}
              </label>
              {selected.has(g.igdb_id) && mainRadio(g)}
            </li>
          ))}
        </ul>

        {error && <p className="saga-error">{error}</p>}

        <div className="saga-link-actions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || selected.size === 0}>
            Guardar
          </button>
          {groupMain != null && (
            <button type="button" className="btn btn-secondary" onClick={() => send('DELETE', `/${groupMain}`)} disabled={saving}>
              Separar
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
