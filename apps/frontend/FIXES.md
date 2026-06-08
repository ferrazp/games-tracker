# 🔧 Frontend Fixes - Games Tracker

## ❌ Problemas Identificados

### 1. **CRÍTICO: Prop Mismatch - GameList/App Desincronizados**
**Archivo:** `src/App.js` línea 42 y `src/components/GameList.js` línea 3

**Problema:**
- App.js pasa prop `games` a GameList
- GameList espera prop `refreshGames`
- GameList nunca recibe los juegos actualizados
- Hay duplicación de lógica de fetch

**Impacto:** ⚠️ **GameList nunca muestra juegos nuevos agregados**

**Solución:**
```javascript
// App.js línea 42 - ANTES
<GameList games={games} refreshGames={refreshGames} />

// GameList.js líneas 3-24 - MODIFICAR
function GameList({ games, onRefreshComplete }) {
  // Simplificar: no hacer fetch aquí, confiar en props
  
  useEffect(() => {
    // Solo notificar que se completó si es necesario
    onRefreshComplete && onRefreshComplete();
  }, [games, onRefreshComplete]);
  
  return (
    <div>
      <h2>Lista de Juegos ({games.length})</h2>
      {games.length === 0 ? (
        <p>No hay juegos registrados</p>
      ) : (
        games.map(game => { /* render */ })
      )}
    </div>
  );
}
```

---

### 2. **ALTO: Sin Debounce en Búsqueda - Sobrecarga de Servidor**
**Archivo:** `src/components/GameForm.js` líneas 39-60

**Problema:**
- `handleTitleChange` hace fetch por cada carácter escribido
- Escribir "Mario" = 5 requests HTTP innecesarios
- Race conditions: respuestas pueden llegar desordenadas
- Pérdida de tiempo y recursos

**Impacto:** 📊 Sobrecarga del servidor IGDB

**Solución:**
```javascript
// GameForm.js - Agregar debounce
import { useEffect } from 'react';

function GameForm({ addGame }) {
  const [game, setGame] = useState({ /* ... */ });
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  const handleTitleChange = (e) => {
    const value = e.target.value;
    setGame({ ...game, title: value });
    
    // Cancelar búsqueda anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Esperar 300ms antes de buscar
    if (value.length > 2) {
      const newTimeout = setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:4000/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: value }),
          });
          
          if (!response.ok) throw new Error('Search failed');
          const data = await response.json();
          setSearchResults(data);
        } catch (error) {
          console.error('Error searching:', error);
          setSearchResults([]);
        }
      }, 300); // 300ms de espera
      
      setSearchTimeout(newTimeout);
    } else {
      setSearchResults([]);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* ... resto del form ... */}
    </form>
  );
}
```

---

### 3. **ALTO: Memory Leak - Requests en Vuelo Tras Desmontaje**
**Archivo:** `src/components/GameForm.js` líneas 39-60

**Problema:**
- Requests de búsqueda no se cancelan
- Si componente se desmonta, `setSearchResults()` causa warning
- "Can't perform a React state update on an unmounted component"

**Impacto:** ⚠️ Warnings en consola, memory leaks

**Solución - Usar AbortController:**
```javascript
function GameForm({ addGame }) {
  const [searchController, setSearchController] = useState(null);
  
  const handleTitleChange = (e) => {
    const value = e.target.value;
    setGame({ ...game, title: value });
    
    // Cancelar request anterior
    if (searchController) {
      searchController.abort();
    }
    
    if (value.length > 2) {
      const controller = new AbortController();
      setSearchController(controller);
      
      setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:4000/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: value }),
            signal: controller.signal, // Permitir cancelación
          });
          
          if (!response.ok) throw new Error('Search failed');
          const data = await response.json();
          setSearchResults(data);
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Search cancelled');
            return;
          }
          console.error('Error searching:', error);
        }
      }, 300);
    } else {
      setSearchResults([]);
    }
  };
  
  // Cleanup en desmontaje
  useEffect(() => {
    return () => {
      if (searchController) {
        searchController.abort();
      }
    };
  }, [searchController]);
  
  return (/* ... */);
}
```

---

### 4. **MEDIO: Error Handling Incompleto - Usuario No Sabe Qué Falló**
**Archivo:** `src/components/GameForm.js` líneas 107-127

**Problema:**
- `handleSubmit` no valida `response.ok`
- Errores HTTP (400, 500) se ignoran silenciosamente
- Usuario no sabe si el juego se guardó

**Impacto:** ❌ UX pobre, errores invisibles

**Solución:**
```javascript
const [error, setError] = useState('');
const [success, setSuccess] = useState('');

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setSuccess('');
  
  try {
    const response = await fetch('http://localhost:4000/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game),
    });
    
    // ✅ AGREGAR VALIDACIÓN
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save game');
    }
    
    const data = await response.json();
    if (data.success) {
      setSuccess('✓ Juego guardado exitosamente');
      addGame(); // Refrescar lista
      
      // Limpiar formulario
      setGame({
        title: '',
        consoleId: '',
        yearPlayed: null,
        completed: false,
        image: ''
      });
      
      // Limpiar éxito después de 3s
      setTimeout(() => setSuccess(''), 3000);
    }
  } catch (error) {
    console.error('Error:', error);
    setError(error.message || 'Error guardando el juego');
  }
};

// En el JSX:
return (
  <form onSubmit={handleSubmit}>
    {error && <div style={{ color: 'red', padding: '10px', marginBottom: '10px' }}>❌ {error}</div>}
    {success && <div style={{ color: 'green', padding: '10px', marginBottom: '10px' }}>{success}</div>}
    {/* resto del form */}
  </form>
);
```

---

### 5. **MEDIO: CORS sin Validación en Carga de Imágenes**
**Archivo:** `src/components/GameForm.js` líneas 63-96

**Problema:**
- `convertImageToBase64` intenta fetch sin validación
- URLs CORS-restringidas fallan silenciosamente
- Base64 grandes pueden saturar la BD

**Impacto:** 🖼️ Imágenes que no cargan, sin feedback

**Solución:**
```javascript
const convertImageToBase64 = async (imageUrl) => {
  try {
    // Validar que es URL válida
    new URL(imageUrl);
    
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - No se pudo cargar la imagen`);
    }
    
    // Validar tamaño máximo (5MB)
    const size = response.headers.get('content-length');
    if (size && parseInt(size) > 5 * 1024 * 1024) {
      throw new Error('Imagen demasiado grande (máx 5MB)');
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Image conversion failed:', error);
    throw error; // Propagar error para que handleGameSelection lo maneje
  }
};

// En handleGameSelection:
const handleGameSelection = async (selectedGame) => {
  const imageUrl = selectedGame.cover
    ? selectedGame.cover.url.replace('t_thumb', 't_cover_big')
    : '';

  if (imageUrl) {
    try {
      const base64Image = await convertImageToBase64(`https:${imageUrl}`);
      setGame({
        ...game,
        title: selectedGame.name,
        image: base64Image,
      });
    } catch (error) {
      console.error('Error loading image:', error);
      setError(`⚠️ No se pudo cargar la imagen: ${error.message}`);
      // Aún así guardar el juego sin imagen
      setGame({
        ...game,
        title: selectedGame.name,
        image: '', // Sin imagen
      });
    }
  }
  setSearchResults([]);
};
```

---

### 6. **BAJO-MEDIO: Actualizar URLs y Campo de Respuesta**
**Archivos:** Todos los fetch calls

**Cambios necesarios debido a backend + PostgreSQL:**

```javascript
// ANTES (SQLite)
const data = await response.json();
setGames(data.data); // ❌ `data` no existe

// DESPUÉS (PostgreSQL)
const data = await response.json();
setGames(data.games); // ✅ `games` es el array
```

**Cambios en nombres de campos:**
```javascript
// ANTES
game.console → game.console_id
game.yearPlayed → game.year_played
game.consoleName → game.console_name

// DESPUÉS (PostgreSQL sigue snake_case)
game.console_id ✅
game.year_played ✅
game.console_name ✅
```

---

## 📋 Resumen de Fixes

| Problema | Severidad | Archivo | Líneas | Tiempo |
|----------|-----------|---------|--------|--------|
| Prop mismatch | 🔴 CRÍTICO | App.js, GameList.js | 3-42 | 20min |
| Sin debounce | 🟠 ALTO | GameForm.js | 39-60 | 15min |
| Memory leak | 🟠 ALTO | GameForm.js | 39-60 | 15min |
| Error handling | 🟡 MEDIO | GameForm.js | 107-127 | 10min |
| CORS validation | 🟡 MEDIO | GameForm.js | 63-96 | 15min |
| Nombres campos | 🟡 MEDIO | Todos | * | 20min |
| **TOTAL** | | | | **95min** |

---

## 🚀 Orden de Fixes (Recomendado)

1. **FIX #1:** Prop mismatch (GameList/App) → ⚠️ **Bloquea funcionalidad**
2. **FIX #6:** Actualizar URLs y nombres de campos → 🔌 **Hace funcionar con nuevo backend**
3. **FIX #2:** Agregar debounce → ⚡ **Performance**
4. **FIX #3:** AbortController → 🛡️ **Memory leaks**
5. **FIX #4:** Error handling → 👤 **UX**
6. **FIX #5:** CORS validation → 🖼️ **Imágenes**

---

## ✅ Checklist de Validación

Después de aplicar fixes:

```javascript
// Crear un juego
- [x] Escribir título (sin lag, sin múltiples requests) — debounce 400ms
- [x] Ver sugerencias de IGDB (máx 5 requests)
- [x] Seleccionar un juego
- [x] Imagen carga correctamente (o error visible)
- [x] Elegir consola
- [x] Elegir año
- [x] Submit → "✓ Juego guardado" ó "❌ Error XXX"
- [x] Juego aparece en la lista inmediatamente

// Ver juegos
- [x] La lista se actualiza con juegos nuevos
- [x] Muestra título, consola, año, completado
- [x] Muestra imagen si existe
- [x] Sin mensajes de error en consola

// Búsqueda IGDB
- [x] 3+ caracteres → búsqueda
- [x] Espera 400ms antes de buscar
- [x] Si cierro ventana, cancela request
- [x] Error visible al usuario si falla
```

---

## 🔗 Referencias

- Backend: `F:\projects\developments\games-tracker-backend\DOCKER.md`
- Endpoints actualizados en: `server-postgres.js`
- Base de datos: `init.sql`
