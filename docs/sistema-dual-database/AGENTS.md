## 🗄️ Sistema Dual Database

El proyecto usa `server-unified.js` que elige la BD automáticamente según `DB_TYPE` en `.env`:

### Variables de Entorno

```bash
PORT=4000                               # Puerto (default: 4000)
NODE_ENV=development                    # development | production
FRONTEND_URL=http://localhost:3000      # URL del frontend (CORS)
DB_TYPE=sqlite                          # sqlite | postgresql

# ========== SOLO PARA PostgreSQL ==========
DB_HOST=postgres                        # Host (Docker: 'postgres', local: 'localhost')
DB_PORT=5432                            # Puerto
DB_NAME=games_tracker                   # Nombre BD (prod usa games_tracker_prod)
DB_USER=postgres                        # Usuario
DB_PASSWORD=postgres                    # Contraseña

# ========== OPCIONALES ==========
TWITCH_CLIENT_ID=tu_client_id
TWITCH_CLIENT_SECRET=tu_client_secret
```

### Seleccionar Base de Datos

| Escenario | DB_TYPE | DB_NAME | Comando | Cuándo Usar |
|-----------|---------|---------|---------|------------|
| Desarrollo personal | `sqlite` | `games.db` | `npm start` | 💻 Local sin Docker |
| Dev Docker | `postgresql` | `games_tracker` | `docker compose -f docker-compose.dev.yml up` | 🧪 Testing PostgreSQL |
| Producción | `postgresql` | `games_tracker_prod` | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` | 🚀 Público |
| Default | `sqlite` | `games.db` | `npm start` | 📝 Mismo que desarrollo local |

### Nota sobre DB_NAME en Docker

En Docker, `DB_NAME` se configura dentro del archivo compose:

| Perfil | DB_NAME |
|--------|---------|
| `docker-compose.dev.yml` | `games_tracker` (variable `${DB_NAME}`) |
| `docker-compose.prod.yml` | `games_tracker_prod` (hardcodeado) |

El `.env` local solo afecta a SQLite o a ejecución directa con `npm run dev:postgres`.

### Scripts npm

```bash
npm start               # Inicia con DB_TYPE en .env (default: sqlite)
npm run dev             # Igual que start (DB_TYPE en .env)
npm run dev:sqlite      # Fuerza SQLite
npm run dev:postgres    # Fuerza PostgreSQL (requiere Docker)
npm run start:sqlite    # Fuerza SQLite (producción)
npm run start:postgres  # Fuerza PostgreSQL (producción)
npm run seed:catalog    # Poblar catálogo local con top 1000 juegos por consola
npm test                # Tests de API
```
