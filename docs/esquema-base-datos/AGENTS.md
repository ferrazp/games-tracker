## 🗄️ Esquema de Base de Datos

El schema es compatible SQLite y PostgreSQL. La abstracción está en `db/database.js`.

### Tabla: `consoles`

```sql
CREATE TABLE consoles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
    -- id SERIAL PRIMARY KEY,              -- PostgreSQL
    name VARCHAR(255) NOT NULL UNIQUE,
    launch_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | INTEGER/SERIAL | PRIMARY KEY | ID único |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Nombre de consola |
| `launch_year` | INTEGER | NULLABLE | Año de lanzamiento |
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
    month_played INTEGER,
    year_completed INTEGER,
    month_completed INTEGER,
    hours_played NUMERIC(8,1),
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
| `year_played` | INTEGER | NULLABLE | Año en que se jugó |
| `month_played` | INTEGER | NULLABLE | Mes en que se jugó |
| `year_completed` | INTEGER | NULLABLE | Año en que se completó |
| `month_completed` | INTEGER | NULLABLE | Mes en que se completó |
| `hours_played` | NUMERIC(8,1) | NULLABLE | Horas jugadas |
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

**Nota**: Contiene ~7800 juegos (top 1000 por consola) precargados desde IGDB. Es independiente (sin FK); `console_name` se guarda como texto.

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
CREATE INDEX idx_catalog_console_cover ON game_catalog(console_name) WHERE cover_url IS NOT NULL AND cover_url != '';
```

**Optimizan**: búsquedas por consola, título, filtros completados, covers por consola y catálogo local.

---

### Vista: `games_view` (PostgreSQL)

```sql
CREATE OR REPLACE VIEW games_view AS
SELECT
    g.id,
    g.title,
    g.year_played,
    g.month_played,
    g.year_completed,
    g.month_completed,
    g.hours_played,
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

**Nota**: SQLite obtiene datos con JOIN directo en queries.

---

### Relaciones

```
┌─────────────────┐
│    consoles     │
├─────────────────┤
│ id (PK)         │
│ name (UNIQUE)   │
│ launch_year     │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ 1:N
         │ (ON DELETE SET NULL)
         │
         ▼
┌─────────────────────────┐
│         games           │
├─────────────────────────┤
│ id (PK)                 │
│ title                   │
│ console_id (FK) ────────┘
│ year_played
│ month_played
│ year_completed
│ month_completed
│ hours_played
│ completed
│ image
│ created_at
│ updated_at
└─────────────────────────┘
      (soft constraint)

┌─────────────────────────┐
│      game_catalog       │  ← independiente
├─────────────────────────┤
│ id (PK)                 │
│ igdb_id (UNIQUE)        │
│ title                   │
│ console_name (texto)    │
│ cover_url               │
│ rating                  │
│ release_date            │
│ created_at              │
└─────────────────────────┘
```
