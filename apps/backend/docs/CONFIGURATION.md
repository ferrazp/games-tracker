# 🎮 Database Configuration - Games Tracker Backend

> ⚠️ **Documento legacy.** La documentación actualizada está en la carpeta `docs/`.  
> Ver [🌍 Perfiles de Ambiente](./perfiles-ambiente/AGENTS.md), [🐳 DOCKER.md](./DOCKER.md), y [🗄️ Sistema Dual Database](./sistema-dual-database/AGENTS.md).

Este backend soporta **SQLite** (desarrollo personal) y **PostgreSQL** (producción) de manera configurable.

---

## 🚀 Quick Start

### SQLite (Desarrollo Personal)
```bash
# Por defecto usa SQLite
npm run dev:sqlite

# O simplemente
npm run dev
```

La base de datos se crea automáticamente en `./games.db`

### PostgreSQL (Producción)
```bash
# Requiere PostgreSQL corriendo
npm run dev:postgres

# O con docker-compose
docker-compose up -d
npm run dev:postgres
```

---

## 📋 Configuración Mediante .env

### Seleccionar Base de Datos
```env
# Para SQLite (default)
DB_TYPE=sqlite

# Para PostgreSQL
DB_TYPE=postgresql
```

### Variables de PostgreSQL
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=games_tracker
DB_USER=postgres
DB_PASSWORD=postgres
```

> **Nota**: Las variables de PostgreSQL **solo se usan** cuando `DB_TYPE=postgresql`

---

## 📁 Estructura de Archivos

```
games-tracker-backend/
├── db/
│   └── database.js          # Capa de abstracción (SQLite + PostgreSQL)
├── server-unified.js        # Servidor único (reemplaza ambos)
├── server.js               # [DEPRECATED] Solo SQLite
├── server-postgres.js      # [DEPRECATED] Solo PostgreSQL
├── games.db                # Base de datos SQLite (auto-creada)
├── package.json            # Scripts npm
└── .env                    # Configuración
```

---

## 🔧 Scripts NPM

| Script | Base de Datos | Uso |
|--------|---------------|-----|
| `npm start` | Según .env | Producción |
| `npm run dev` | Según .env | Desarrollo |
| `npm run dev:sqlite` | SQLite | Desarrollo personal |
| `npm run dev:postgres` | PostgreSQL | Desarrollo con PG |
| `npm run start:sqlite` | SQLite | Producción con SQLite |
| `npm run start:postgres` | PostgreSQL | Producción con PG |

---

## 🎯 Casos de Uso

### 📱 Uso Personal (Development)
```bash
# .env
DB_TYPE=sqlite

npm run dev:sqlite
# o npm run dev (default)
```

**Ventajas:**
- ✅ Sin dependencias externas
- ✅ Base de datos local (`games.db`)
- ✅ Perfecto para testing
- ✅ Fácil de respaldar

---

### 🌐 Producción Pública
```bash
# .env
DB_TYPE=postgresql
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=games_tracker
DB_USER=prod_user
DB_PASSWORD=secure_password

npm run start:postgres
```

**Ventajas:**
- ✅ Base de datos robusta
- ✅ Escalable
- ✅ Backups profesionales
- ✅ Multi-usuario

---

## 🔄 Migración: SQLite → PostgreSQL

Si empezaste con SQLite y quieres migrar a PostgreSQL:

### Opción 1: Manual Export/Import
```sql
-- Exportar desde SQLite
.mode csv
.output consoles.csv
SELECT * FROM consoles;

-- Importar en PostgreSQL
COPY consoles(id, name, created_at, updated_at) FROM 'consoles.csv' WITH CSV;
```

### Opción 2: Herramientas
```bash
# Usar herramientas de terceros (pgloader, sqlalchemy, etc.)
```

### Opción 3: Comenzar Limpio
- Cambiar `DB_TYPE=postgresql` en `.env`
- El servidor crea automáticamente las tablas
- Volver a ingresar datos si es necesario

---

## 📊 Esquema (Idéntico en Ambas)

### SQLite
```sql
CREATE TABLE consoles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    console_id INTEGER,
    year_played INTEGER,
    completed BOOLEAN DEFAULT 0,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (console_id) REFERENCES consoles(id) ON DELETE SET NULL
);
```

### PostgreSQL
```sql
CREATE TABLE consoles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    console_id INTEGER REFERENCES consoles(id) ON DELETE SET NULL,
    year_played INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_console_id ON games(console_id);
CREATE INDEX idx_games_title ON games(title);
CREATE INDEX idx_games_completed ON games(completed);
```

---

## 🐳 Docker Compose (PostgreSQL)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: games_tracker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: .
    environment:
      DB_TYPE: postgresql
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: games_tracker
      DB_USER: postgres
      DB_PASSWORD: postgres
      TWITCH_CLIENT_ID: ${TWITCH_CLIENT_ID}
      TWITCH_CLIENT_SECRET: ${TWITCH_CLIENT_SECRET}
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

---

## ✅ Verificación

### SQLite
```bash
# Verificar que existe el archivo
ls -la games.db

# O consultar con sqlite3
sqlite3 games.db "SELECT * FROM consoles;"
```

### PostgreSQL
```bash
# Conectarse a PostgreSQL
psql -U postgres -d games_tracker -c "SELECT * FROM consoles;"

# Dentro de psql
\dt                    # Listar tablas
\d games               # Describir tabla
\d consoles
```

---

## 🚨 Troubleshooting

### "Database not initialized"
```bash
# Asegurar que DB_TYPE está en .env
cat .env | grep DB_TYPE

# Reinstalar sqlite3 si es necesario
npm install sqlite3
```

### SQLite: "Database is locked"
```bash
# Cerrar otras conexiones
# O eliminar y recrear
rm games.db
npm run dev
```

### PostgreSQL: "Connection refused"
```bash
# Verificar que PostgreSQL está corriendo
docker-compose up -d postgres

# Verificar credenciales en .env
```

---

## 🔒 Recomendaciones de Seguridad

### Desarrollo (SQLite)
- ✅ Ignorar `games.db` en `.gitignore`
- ✅ No committer datos sensibles

### Producción (PostgreSQL)
- ✅ Usar contraseñas fuertes
- ✅ Variables de entorno seguras
- ✅ Backups regulares
- ✅ SSL/TLS para conexiones
- ✅ Logs de auditoría

---

## 📝 Resumen de Cambios

| Componente | Antes | Después |
|-----------|-------|---------|
| Servidor | `server.js` + `server-postgres.js` | `server-unified.js` |
| Abstracción BD | Duplicado | `db/database.js` |
| Configuración | Hardcoded | Variables .env |
| Flexibilidad | Cambiar archivo | Cambiar `DB_TYPE` |

---

## 🎯 Próximas Mejoras

- [x] Seed data automático (consolas predefinidas)
- [x] Migraciones automáticas (via node db/migrate.js)
- [x] Health check con info de BD
- [x] Estadísticas de BD (GET /stats)
- [x] Exportar/importar datos (GET /export, POST /import)
