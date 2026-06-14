## 🚀 Quick Start

### 1. Instalación

```bash
cd games-tracker-backend
npm install
```

### 2. Configurar .env

```bash
cp .env.example .env
```

### 3. Elegir Perfil

#### 💻 Desarrollo Local (SQLite)

```bash
npm start
# → API en http://localhost:4000
# → Frontend aparte en :3000
```

#### 🧪 Desarrollo Docker (PostgreSQL)

```bash
docker compose -f docker-compose.dev.yml up -d --build
# → API en http://localhost:4001
# → Frontend en http://localhost:3001
# → DB en puerto 5433
```

#### 🚀 Producción Docker (PostgreSQL)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# → API en http://localhost:4001
# → Frontend en http://localhost:9090
# → DB en puerto 5432, base: games_tracker_prod
```

### Referencia

See [🌍 Perfiles de Ambiente](../perfiles-ambiente/AGENTS.md) para tabla comparativa completa.
