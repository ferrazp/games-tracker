# 📋 AGENTS.md - Documentación del Proyecto Games Tracker Backend

> 📚 Documentación modular: cada sección vive en su propio archivo `AGENTS.md`. Esta página es el índice.

## Índice de Secciones

See: [🎯 Visión General](./docs/vision-general/AGENTS.md)

See: [🏗️ Stack Tecnológico](./docs/stack-tecnologico/AGENTS.md)

See: [📂 Estructura del Proyecto](./docs/estructura-proyecto/AGENTS.md)

See: [🚀 Quick Start](./docs/quick-start/AGENTS.md)

See: [🌍 Perfiles de Ambiente](./docs/perfiles-ambiente/AGENTS.md)

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

See: [🐳 Manual Docker](./docs/DOCKER.md)

---

## 🖥️ Frontend

El frontend (React) está en un proyecto separado:

```
F:\projects\developments\games-tracker
```

See su [📖 AGENTS.md](../games-tracker/AGENTS.md) para detalles.

**Ruta relativa desde este repo:** `..\games-tracker`
**Docker:** Se construye desde `docker-compose.yml` usando `context: ../games-tracker`

---

**Última actualización**: 2026-06-14
**Versión del Schema**: 1.1
**Estado**: ✅ Docker Production Ready
**Arquitectura Docker**: Postgres 17 + Backend Node + Frontend Nginx (dev y prod separados)
**Perfiles**: Dev (`:3001`/`:4001`/`:5433`), Prod (`:9090`/`:4001`/`:5432`), Local (SQLite, `:3000`/`:4000`)
**Modo BD por Defecto**: SQLite (desarrollo local)
**Alternativa**: PostgreSQL (Docker dev/prod)
**Package Manager**: npm (instalado) + pnpm (instalado)
**Git Flow**: Siempre usar `git flow feature start <name>` para nuevas features. Rama develop como base.
**Manual de Operaciones**: See [🐳 DOCKER.md](./docs/DOCKER.md)
