# 📋 AGENTS.md - Documentación del Proyecto Games Tracker Backend

> 📚 Documentación modular: cada sección vive en su propio archivo `AGENTS.md`. Esta página es el índice.

## Índice de Secciones

See: [🎯 Visión General](./docs/vision-general/AGENTS.md)

See: [🏗️ Stack Tecnológico](./docs/stack-tecnologico/AGENTS.md)

See: [📂 Estructura del Proyecto](./docs/estructura-proyecto/AGENTS.md)

See: [🚀 Quick Start](./docs/quick-start/AGENTS.md)

See: [🗄️ Sistema Dual Database](./docs/sistema-dual-database/AGENTS.md)

See: [🔌 API REST - Endpoints](./docs/api-rest/AGENTS.md)

See: [🗄️ Esquema de Base de Datos](./docs/esquema-base-datos/AGENTS.md)

See: [🔐 Validaciones de Input](./docs/validaciones-input/AGENTS.md)

See: [📝 Validaciones de Datos](./docs/validaciones-datos/AGENTS.md)

See: [🏗️ Arquitectura: Dual Database](./docs/arquitectura-dual-database/AGENTS.md)

See: [📦 Package Managers: npm vs pnpm](./docs/package-managers/AGENTS.md)

See: [🐳 Docker - PostgreSQL](./docs/docker-postgresql/AGENTS.md)

See: [🚀 Despliegue](./docs/despliegue/AGENTS.md)

See: [🔄 Cambios en el Esquema BD](./docs/cambios-esquema-bd/AGENTS.md)

See: [📊 Estadísticas del Proyecto](./docs/estadisticas-proyecto/AGENTS.md)

See: [📚 Archivos Clave](./docs/archivos-clave/AGENTS.md)

See: [🔗 Referencias](./docs/referencias/AGENTS.md)

See: [🎯 Próximos Pasos Recomendados](./docs/proximos-pasos/AGENTS.md)

See: [🔄 Migration Plan BD](./docs/migration-plan/AGENTS.md)

---

## 🖥️ Frontend

El frontend (React) está en un proyecto separado:

```
F:\projects\developments\games-tracker
```

See su [📖 AGENTS.md](../../games-tracker/AGENTS.md) para detalles.

**Ruta relativa desde este repo:** `..\games-tracker`  
**Puerto desarrollo:** 3000  
**API URL:** configurable via `REACT_APP_API_URL` o `.env`  
**Docker:** Se construye desde `docker-compose.yml` usando `context: ../games-tracker`

---

**Última actualización**: 2026-06-07  
**Versión del Schema**: 1.0  
**Estado**: ✅ Docker Production Ready  
**Arquitectura Docker**: 3 contenedores (PostgreSQL 17 + Backend Node + Frontend Nginx)  
**Modo BD por Defecto**: SQLite (desarrollo)  
**Alternativa**: PostgreSQL (producción)  
**Package Manager**: npm (instalado) + pnpm (instalado)  
**Manual de Operaciones**: See [🐳 DOCKER.md](./DOCKER.md)
