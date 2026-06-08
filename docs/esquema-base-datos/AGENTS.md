## 🗄️ Esquema de Base de Datos

El schema es idéntico para ambas BDs (SQLite y PostgreSQL). La abstracción está en `db/database.js`.

### Tabla: `consoles`

```sql
CREATE TABLE consoles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
    -- id SERIAL PRIMARY KEY,              -- PostgreSQL
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | INTEGER/SERIAL | PRIMARY KEY | ID único |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Nombre de consola |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha creación |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Fecha actualización |

---

### Tabla: `games`

```sql
CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
    -- id SERIAL PRIMARY KEY,              -- PostgreSQL
    title VARCHAR(255) NOT NULL,
    console_id INTEGER REFERENCES consoles(id) ON DELETE SET NULL,
    year_played INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | INTEGER/SERIAL | PRIMARY KEY | ID único |
| `title` | VARCHAR(255) | NOT NULL | Título juego |
| `console_id` | INTEGER | FK → consoles(id) | ID consola |
| `year_played` | INTEGER | NULLABLE | Año jugado |
| `completed` | BOOLEAN | DEFAULT FALSE | ¿Completado? |
| `image` | TEXT | NULLABLE | Imagen (base64) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha creación |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Fecha actualización |

---

### Tabla: `game_catalog`

```sql
CREATE TABLE game_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
    -- id SERIAL PRIMARY KEY,              -- PostgreSQL
    igdb_id INTEGER NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    console_name VARCHAR(255),
    cover_url TEXT,
    rating NUMERIC(5,2),
    release_date INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | INTEGER/SERIAL | PRIMARY KEY | ID único |
| `igdb_id` | INTEGER | NOT NULL, UNIQUE | ID del juego en IGDB |
| `title` | VARCHAR(255) | NOT NULL | Título del juego |
| `console_name` | VARCHAR(255) | NULLABLE | Nombre de la consola asociada |
| `cover_url` | TEXT | NULLABLE | URL de portada (IGDB) |
| `rating` | NUMERIC(5,2) | NULLABLE | Rating comunitario IGDB (0-100). En SQLite es `REAL` |
| `release_date` | INTEGER | NULLABLE | Fecha lanzamiento (timestamp Unix) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha de inserción en catálogo |

**Nota**: Contiene el top ~1000 juegos mejor rankeados por consola, precargados desde IGDB via `npm run seed:catalog`. Es una tabla **independiente** (sin foreign keys); `console_name` se guarda como texto.

---

### Índices

```sql
-- Tabla games
CREATE INDEX idx_games_console_id ON games(console_id);
CREATE INDEX idx_games_title ON games(title);
CREATE INDEX idx_games_completed ON games(completed);

-- Tabla game_catalog
CREATE INDEX idx_catalog_title ON game_catalog(title);
CREATE INDEX idx_catalog_console ON game_catalog(console_name);
```

**Optimizan**: búsquedas por consola, título, filtros completados y catálogo local

---

### Vista: `games_view` (PostgreSQL)

```sql
CREATE OR REPLACE VIEW games_view AS
SELECT 
    g.id,
    g.title,
    g.year_played,
    g.completed,
    g.image,
    c.name as console_name,
    c.id as console_id,
    g.created_at,
    g.updated_at
FROM games g
LEFT JOIN consoles c ON g.console_id = c.id
ORDER BY g.created_at DESC;
```

**Nota**: SQLite obtiene datos con JOIN directo en queries

---

### Relaciones

```
┌─────────────────┐
│    consoles     │
├─────────────────┤
│ id (PK)         │
│ name (UNIQUE)   │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ 1:N
         │ (ON DELETE SET NULL)
         │
         ▼
┌─────────────────┐
│     games       │
├─────────────────┤
│ id (PK)         │
│ title           │
│ console_id (FK) │ ──┐
│ year_played     │   │
│ completed       │   │
│ image           │   │
│ created_at      │   │
│ updated_at      │   │
└─────────────────┘   │
      (soft constraint)
```
