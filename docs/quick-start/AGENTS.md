## 🚀 Quick Start

### 1. Instalación

```bash
# Clonar repo
git clone <repo-url>
cd games-tracker-backend

# Instalar dependencias (elige uno)
npm install              # Usando npm
# o
pnpm install            # Usando pnpm (más rápido)
```

### 2. Configurar .env

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# (Opcional) Editar .env con credenciales Twitch
# Solo necesarias para /search/online y npm run seed:catalog
# Obtener en: https://dev.twitch.tv/console/apps
```

### 3. Iniciar Servidor

#### Opción A: SQLite (Desarrollo Local - Recomendado)

```bash
# Automático (usa DB_TYPE=sqlite en .env)
npm start

# O explícito
npm run dev:sqlite
```

#### Opción B: PostgreSQL (Producción)

```bash
# Con Docker
docker-compose up -d

# Esperar health check (~30s)
npm run dev:postgres
```
