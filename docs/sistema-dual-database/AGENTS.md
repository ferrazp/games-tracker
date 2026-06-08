## 🗄️ Sistema Dual Database

El proyecto usa `server-unified.js` que elige la BD automáticamente según `DB_TYPE` en `.env`:

### Variables de Entorno

```bash
# ========== OPCIONALES ==========
# Twitch solo se usa para /search/online y npm run seed:catalog.
# El servidor y el catálogo local funcionan sin estas credenciales.
TWITCH_CLIENT_ID=tu_client_id          # Twitch IGDB API (opcional)
TWITCH_CLIENT_SECRET=tu_client_secret  # (opcional)

PORT=4000                               # Puerto (default: 4000)
NODE_ENV=development                    # development | production
FRONTEND_URL=http://localhost:3000      # URL del frontend (CORS)
DB_TYPE=sqlite                          # sqlite | postgresql

# ========== SOLO PARA PostgreSQL ==========
DB_HOST=postgres                        # Host (Docker: 'postgres', local: 'localhost')
DB_PORT=5432                            # Puerto
DB_NAME=games_tracker                   # Nombre BD
DB_USER=postgres                        # Usuario
DB_PASSWORD=postgres                    # Contraseña
```

### Seleccionar Base de Datos

| Escenario | DB_TYPE | Comando | Cuándo Usar |
|-----------|---------|---------|------------|
| Desarrollo personal | `sqlite` | `npm run dev:sqlite` | 💻 Local sin Docker |
| Producción pública | `postgresql` | `npm run dev:postgres` | 🚀 Despliegue público |
| Default | `sqlite` | `npm start` | 📝 Mismo que SQLite |

### Scripts npm

```bash
npm start               # Inicia con DB_TYPE en .env (default: sqlite)
npm run dev             # Igual que start (DB_TYPE en .env)
npm run dev:sqlite      # Fuerza SQLite
npm run dev:postgres    # Fuerza PostgreSQL (requiere Docker)
npm run start:sqlite    # Fuerza SQLite (producción)
npm run start:postgres  # Fuerza PostgreSQL (producción)
npm run seed:catalog    # Poblar catálogo local con top 1000 juegos por consola (requiere credenciales Twitch)
npm test                # (En progreso)
```
