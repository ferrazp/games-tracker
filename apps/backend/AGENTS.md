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

See: [🚢 Operación QA / Prod](../../docs/OPERACION.md)

---

## 🖥️ Frontend

El frontend está en el mismo monorepo: [`apps/frontend`](../frontend/AGENTS.md). Índice general: [AGENTS.md raíz](../../AGENTS.md).

---

**Última actualización**: 2026-11-02
**Monorepo**: `ferrazp/games-tracker` (npm workspaces); este paquete es el workspace `games-backend`
**Ambientes**: Dev (SQLite, `:4000`), QA (`gt-qa`, `:8081`), Prod (`gt-prod`, `:8080`), API solo vía `/api` en QA/Prod
**Modo BD por Defecto**: SQLite (desarrollo local); PostgreSQL 17 en QA y Prod
**Flujo git**: GitHub Flow + Conventional Commits + release-please (ver [CONTRIBUTING.md](../../CONTRIBUTING.md))
**Operación**: [docs/OPERACION.md](../../docs/OPERACION.md)
