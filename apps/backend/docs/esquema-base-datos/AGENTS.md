## 🗄️ Esquema de Base de Datos

El esquema real lo crea `initialize()` en [`db/database.js`](../../db/database.js) al arrancar el backend, con `CREATE TABLE IF NOT EXISTS` y `ADD COLUMN IF NOT EXISTS`. Hay dos bloques equivalentes: SQLite (dev y tests) y PostgreSQL (QA y Prod). Cada deploy aplica el esquema solo; no hay migraciones manuales. Los archivos de `migrations/` son documentales.

Abajo se muestran los tipos de PostgreSQL. En SQLite: `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`, `TIMESTAMP` → `DATETIME`, `NUMERIC` → `REAL`, `BOOLEAN` → `INTEGER` (0/1).

Tablas por área:

| Área | Tablas |
|---|---|
| Registro de juegos | `consoles`, `games` |
| Catálogo y próximos juegos | `game_catalog`, `game_wishlist` |
| Sagas: caché de IGDB | `igdb_resolution`, `sagas`, `saga_games` |
| Sagas: decisiones del usuario | `saga_archived`, `saga_links` |
| Interno | `_migrations` |

---

### Tabla: `consoles`

```sql
CREATE TABLE consoles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    launch_year INTEGER,
    image TEXT,
    image_type VARCHAR(20) DEFAULT 'bitmap',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Nombre de consola |
| `launch_year` | INTEGER | NULLABLE | Año de lanzamiento (valida el año jugado) |
| `image` | TEXT | NULLABLE | Imagen de la consola (base64 o SVG) |
| `image_type` | VARCHAR(20) | DEFAULT `'bitmap'` | Tipo de imagen (`bitmap` o `svg`) |
| `created_at` / `updated_at` | TIMESTAMP | DEFAULT NOW() | Auditoría |

---

### Tabla: `games`

```sql
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    console_id INTEGER REFERENCES consoles(id) ON DELETE SET NULL,
    year_played INTEGER,
    month_played INTEGER,
    year_completed INTEGER,
    month_completed INTEGER,
    hours_played NUMERIC(8,1),
    release_year INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    image TEXT,
    igdb_id INTEGER,
    igdb_match TEXT,
    igdb_candidates TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `title` | VARCHAR(255) | NOT NULL | Título del juego |
| `console_id` | INTEGER | FK → consoles(id) ON DELETE SET NULL | Consola |
| `year_played` / `month_played` | INTEGER | NULLABLE | Cuándo se empezó |
| `year_completed` / `month_completed` | INTEGER | NULLABLE | Cuándo se terminó |
| `hours_played` | NUMERIC(8,1) | NULLABLE | Horas jugadas |
| `release_year` | INTEGER | NULLABLE | Año de lanzamiento del juego |
| `completed` | BOOLEAN | DEFAULT FALSE | ¿Completado? (en sagas: `completed` o `pending`) |
| `image` | TEXT | NULLABLE | Portada (base64) |
| `igdb_id` | INTEGER | NULLABLE | Juego de IGDB al que corresponde (la versión registrada, no necesariamente el original) |
| `igdb_match` | TEXT | NULLABLE | Cómo se obtuvo `igdb_id`: `selected` (elegido del catálogo al cargarlo), `auto` (lo encontró el backfill), `manual` (elegido en *sin identificar*), `unresolved` (ambiguo, espera que el usuario elija), `none` (fuera de las sagas). `NULL` = pendiente de buscar |
| `igdb_candidates` | TEXT | NULLABLE | JSON con hasta 5 candidatos `[{igdb_id, name, year, platforms, cover_url}]` cuando es `unresolved` |
| `created_at` / `updated_at` | TIMESTAMP | DEFAULT NOW() | Auditoría |

Si se edita el título de un juego sin mandar `igdb_id`, se limpian `igdb_id` e `igdb_match` y el backfill lo vuelve a buscar.

---

### Tabla: `game_catalog`

```sql
CREATE TABLE game_catalog (
    id SERIAL PRIMARY KEY,
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
| `id` | SERIAL | PRIMARY KEY | ID único |
| `igdb_id` | INTEGER | NOT NULL, UNIQUE | ID del juego en IGDB |
| `title` | VARCHAR(255) | NOT NULL | Título |
| `console_name` | VARCHAR(255) | NULLABLE | Consola, como texto |
| `cover_url` | TEXT | NULLABLE | URL de portada (IGDB) |
| `rating` | NUMERIC(5,2) | NULLABLE | Rating comunitario IGDB (0-100) |
| `release_date` | INTEGER | NULLABLE | Fecha de lanzamiento (timestamp Unix) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha de inserción |

~7800 juegos (top 1000 por consola) precargados desde IGDB con `scripts/seed-catalog.js`. Independiente: sin FK, `console_name` es texto.

---

### Tabla: `game_wishlist`

```sql
CREATE TABLE game_wishlist (
    id SERIAL PRIMARY KEY,
    game_catalog_id INTEGER NOT NULL REFERENCES game_catalog(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `game_catalog_id` | INTEGER | NOT NULL, FK → game_catalog(id) ON DELETE CASCADE | Juego del catálogo |
| `sort_order` | INTEGER | NOT NULL, DEFAULT 0 | Orden manual |
| `created_at` / `updated_at` | TIMESTAMP | DEFAULT NOW() | Auditoría |

---

## Sagas

Las sagas se arman con las *series* (collections) de IGDB. Hay dos tipos de tablas, y la separación es deliberada:

- **Caché de IGDB** (`igdb_resolution`, `sagas`, `saga_games`): la escriben los jobs de [`src/services/sagas-sync.js`](../../src/services/sagas-sync.js). `saga_games` se borra y se vuelve a escribir en cada refresco de la saga, así que **nada que decida el usuario puede vivir ahí**.
- **Decisiones del usuario** (`saga_archived`, `saga_links`): solo las escriben las rutas con sesión. Ningún refresco las toca.

Ninguna tiene FK hacia el caché a propósito: si IGDB saca un juego de una saga y después lo vuelve a poner, el archivo o la unión siguen valiendo. Las pantallas nunca consultan a IGDB en vivo (es lento y tiene límites de uso): leen estas tablas. Detalle operativo en [OPERACION.md](../../../../docs/OPERACION.md#sagas).

### Tabla: `igdb_resolution`

```sql
CREATE TABLE igdb_resolution (
    igdb_id INTEGER PRIMARY KEY,
    canonical_igdb_id INTEGER NOT NULL,
    saga_id INTEGER,
    resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `igdb_id` | INTEGER | PRIMARY KEY | La versión registrada (`games.igdb_id`) |
| `canonical_igdb_id` | INTEGER | NOT NULL | El juego original al que pertenece: se sube por `version_parent` / `parent_game` de IGDB, como máximo 6 saltos, hasta un remake o un juego principal sin `version_parent` (IGDB marca algunas ediciones como principales pero con padre: esas no cuentan como originales) |
| `saga_id` | INTEGER | NULLABLE | Serie del original (`sagas.id`); `NULL` = no está en ninguna serie |
| `resolved_at` | TIMESTAMP | DEFAULT NOW() | Cuándo se resolvió |

**Por qué:** un mismo juego aparece en IGDB como muchas fichas (ports, remasters, ediciones). Sin esta tabla, *Chrono Trigger (PC, 2018)* no contaría como el *Chrono Trigger* de la saga. Es un caché: no se invalida solo.

### Tabla: `sagas`

```sql
CREATE TABLE sagas (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    refreshed_at TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | ID de la collection en IGDB |
| `name` | TEXT | NOT NULL | Nombre de la saga |
| `refreshed_at` | TIMESTAMP | NULLABLE | Último refresco; el job diario refresca las de más de 7 días |

### Tabla: `saga_games`

```sql
CREATE TABLE saga_games (
    igdb_id INTEGER PRIMARY KEY,
    saga_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    release_year INTEGER,
    game_type INTEGER,
    cover_url TEXT,
    versions TEXT
);
CREATE INDEX idx_saga_games_saga_id ON saga_games(saga_id);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `igdb_id` | INTEGER | PRIMARY KEY | Juego original de la saga |
| `saga_id` | INTEGER | NOT NULL | Saga (`sagas.id`) |
| `name` | TEXT | NOT NULL | Nombre |
| `release_year` | INTEGER | NULLABLE | Año de lanzamiento (agrupa la grilla por año) |
| `game_type` | INTEGER | NULLABLE | Tipo de IGDB; solo se guardan `0` (principal) y `8` (remake) |
| `cover_url` | TEXT | NULLABLE | Portada |
| `versions` | TEXT | NULLABLE | JSON `[{label, year}]`: plataformas y años, para el panel Sugerir |

Todos los juegos de cada saga, jugados o no: los que no están registrados se muestran en gris.

### Tabla: `saga_archived` (v1.8.0)

```sql
CREATE TABLE saga_archived (
    igdb_id INTEGER PRIMARY KEY,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `igdb_id` | INTEGER | PRIMARY KEY | Juego de la saga archivado |
| `archived_at` | TIMESTAMP | DEFAULT NOW() | Cuándo se archivó (ordena la lista de archivados) |

**Por qué:** IGDB mete en las series spin-offs, mobile y recopilaciones que el usuario no considera parte de la saga. Archivar los saca de la grilla y de los totales (aunque estén registrados) y sobrevive a los refrescos. Se restauran desde el menú ⋯ → *Archivados*.

### Tabla: `saga_links` (v1.10.0)

```sql
CREATE TABLE saga_links (
    igdb_id INTEGER PRIMARY KEY,
    main_igdb_id INTEGER NOT NULL
);
```

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `igdb_id` | INTEGER | PRIMARY KEY | Juego del grupo (uno por fila, la principal incluida) |
| `main_igdb_id` | INTEGER | NOT NULL | Versión principal del grupo (la de ⭐); la fila de la principal apunta a sí misma |

**Por qué:** IGDB trata como juegos distintos versiones que para el usuario son el mismo (p. ej. *Final Fantasy III* de 1990 y el 3D de 2006). Unirlas hace que todas cuenten como jugadas con el estado más avanzado de lo registrado en el grupo, sin cambiar el total ni ocultar ninguna tarjeta (se ve el año de cada una). La `PRIMARY KEY` garantiza que un juego esté en un solo grupo; al unir, se reemplazan en una transacción los grupos que tocan esos juegos.

---

### Tabla: `_migrations`

Registro de archivos de `migrations/` aplicados por `npm run migrate -w games-backend` (`db/migrate.js`). Con el esquema creado por `initialize()` ese runner ya no hace falta.

---

### Índices

```sql
CREATE INDEX idx_games_console_id ON games(console_id);
CREATE INDEX idx_games_title ON games(title);
CREATE INDEX idx_games_completed ON games(completed);

CREATE INDEX idx_catalog_title ON game_catalog(title);
CREATE INDEX idx_catalog_console ON game_catalog(console_name);
CREATE INDEX idx_catalog_console_cover ON game_catalog(console_name) WHERE cover_url IS NOT NULL AND cover_url != '';

CREATE INDEX idx_wishlist_sort_order ON game_wishlist(sort_order);
CREATE INDEX idx_wishlist_catalog_id ON game_wishlist(game_catalog_id);

CREATE INDEX idx_saga_games_saga_id ON saga_games(saga_id);
```

Las tablas de sagas restantes se consultan por su `PRIMARY KEY`.

---

### Vista: `games_view` (PostgreSQL, `migrations/002_catalog_view.sql`)

Juegos con el nombre de su consola (`LEFT JOIN consoles`). SQLite obtiene lo mismo con JOIN directo en las queries.

---

### Relaciones

Las flechas llenas son FK reales; las punteadas son vínculos lógicos por ID de IGDB (sin FK, a propósito).

```
consoles 1 ──< games                 (ON DELETE SET NULL)
game_catalog 1 ──< game_wishlist     (ON DELETE CASCADE)

games.igdb_id ┄┄> igdb_resolution.igdb_id
                    │ canonical_igdb_id ┄┄> saga_games.igdb_id
                    │ saga_id           ┄┄> sagas.id
sagas.id 1 ┄┄< saga_games.saga_id

saga_games.igdb_id ┄┄ saga_archived.igdb_id     (0..1: archivado)
saga_games.igdb_id ┄┄ saga_links.igdb_id        (0..1: en un grupo)
                       saga_links.main_igdb_id ┄┄> saga_games.igdb_id (principal)
```

Estado de un juego de la saga (`buildSagaDetail` en `src/services/sagas-logic.js`):

1. Se juntan los `games` registrados por `canonical_igdb_id` (salvo los `none` y `unresolved`): `completed` si alguno está completado, si no `pending`.
2. Si el juego está en un grupo de `saga_links`, toma el estado más avanzado de los registrados del grupo.
3. Si no hay nada, `missing` (gris). Los de `saga_archived` no se muestran ni cuentan.
