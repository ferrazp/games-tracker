---
name: git-flow-workflow
description: Gestión de features con git-flow en games-tracker. Triggers: "agrega al proximo paso", "implementar el proximo paso", "pasa la feature X al main de prod". Incluye changelog (Keep a Changelog), versionado semver, y deploy Docker diferenciado dev/prod.
---

# Git Flow Workflow for Games Tracker

## Branching Model

```
main        ──●──────────────────●── (production, tagged)
                \                /
develop       ───●──●──●──●──●──●── (integration, Docker dev)
                 \        /
feature/X       ──●──●──
```

- `main` — producción, tags semver, deploy con `docker-compose.yml`
- `develop` — integración, deploy con `docker-compose.dev.yml`
- `feature/NOMBRE` — creada desde `develop`, trabajo 100% local

## When to Activate

| Trigger | Acción |
|---------|--------|
| "agrega al proximo paso" / "agregá al próximo paso" + texto | Agregar item a next-steps checklist |
| "implementar el proximo paso" / "implementá el próximo paso" | Feature branch completa + deploy dev |
| "pasa la feature X al main de prod" / "pasá X a producción" | Release a main + tag + deploy prod |
| Cualquier mención a "git flow", "feature branch", "changelog" o "release" | Seguir este workflow |

## Core Principle

**Los tags se crean SOLO desde main. Las features NO se cierran sin aprobación del usuario. Feature branches trabajan local, develop deploya en Docker dev, main deploya en Docker prod. Changelog y semver se actualizan en cada etapa.**

## Git Commands (sin git-flow CLI)

| Acción | Comando |
|--------|---------|
| Iniciar feature | `git checkout develop && git pull && git checkout -b feature/NOMBRE develop` |
| Commit | `git add . && git commit -m "tipo(alcance): mensaje"` |
| Push feature | `git push origin feature/NOMBRE` |
| Cerrar feature (solo con aprobación) | `git checkout develop && git merge --no-ff feature/NOMBRE && git branch -d feature/NOMBRE` |
| Push develop | `git push origin develop` |
| Release a main (ÚNICO lugar para tags) | `git checkout main && git merge --no-ff develop && git tag vNUEVA_VERSION && git push origin main --tags` |

Todos los merges usan `--no-ff` para preservar historial de branches.

## Trigger Mapping

### "agrega al proximo paso" / "agregá al próximo paso"

1. Agregar item a `F:\projects\developments\games-tracker-backend\docs\proximos-pasos\AGENTS.md`
2. Formato: `- [ ] Descripción del próximo paso` (insertar al final del listado)
3. **No hacer nada más.** No crear branch, no implementar, no deployar.

### "implementar el proximo paso" / "implementá el próximo paso"

**Apertura de feature:**

1. Leer `docs/proximos-pasos/AGENTS.md` para identificar el primer item `- [ ]` sin marcar
2. Crear feature branch en ambos repos:
   ```bash
   cd F:\projects\developments\games-tracker-backend
   git checkout develop && git pull && git checkout -b feature/NOMBRE-DEL-PASO develop
   cd F:\projects\developments\games-tracker
   git checkout develop && git pull && git checkout -b feature/NOMBRE-DEL-PASO develop
   ```
3. Actualizar CHANGELOG.md: agregar entrada descriptiva bajo `[Unreleased]` en la categoría correcta (Added, Changed, Fixed, etc.) en los repos que corresponda. Si no existe, crearlo con template estándar. Commit: `docs(changelog): registro feature/NOMBRE`

**Desarrollo (local o Docker dev según corresponda):**

4. Si es prueba rápida: `npm start` local (backen puerto 4000, frontend puerto 3000)
5. Si necesita validación con PostgreSQL: usar Docker dev existente
6. NO crear tags desde develop — los tags son SOLO de main

**Cierre de feature (PREVIA APROBACIÓN):**

7. Verificar que la entrada en CHANGELOG.md sigue siendo precisa; actualizar si hace falta
8. Commit + push en ambos repos
9. **PREGUNTAR AL USUARIO:** "¿Aprobás cerrar la feature NOMBRE (merge a develop + deploy dev)?"
10. **NO cerrar hasta recibir aprobación explícita.** Si el usuario dice que no, detenerse.
11. Marcar el item como `- [x]` en `docs/proximos-pasos/AGENTS.md`
12. Cerrar feature:
    ```bash
    cd F:\projects\developments\games-tracker-backend
    git checkout develop && git merge --no-ff feature/NOMBRE && git branch -d feature/NOMBRE && git push origin develop
    cd F:\projects\developments\games-tracker
    git checkout develop && git merge --no-ff feature/NOMBRE && git branch -d feature/NOMBRE && git push origin develop
    ```
13. Deployar en dev: `docker compose -p games_tracker_dev -f docker-compose.dev.yml up -d --build`
14. Verificar: http://localhost:3001 (frontend) y http://localhost:4001/api/health (backend)

### "pasa la feature X al main de prod" / "pasá X a producción"

1. Si X es nombre de feature, confirmar que ya está mergeada a develop
2. Analizar CHANGELOG.md para determinar versión semver:
   - `### Added` + `### Changed` → MINOR
   - `### Fixed` + `### Security` → PATCH
   - Breaking changes explícitos → MAJOR
3. Leer última tag: `git tag | Sort-Object -Descending | Select-Object -First 1`
4. Calcular nueva versión
5. Release a main:
   ```bash
   # Backend
   cd F:\projects\developments\games-tracker-backend
   git checkout main && git pull
   git merge --no-ff develop
   git tag vNUEVA_VERSION
   git push origin main --tags

   # Frontend (mismo tag)
   cd F:\projects\developments\games-tracker
   git checkout main && git pull
   git merge --no-ff develop
   git tag vNUEVA_VERSION
   git push origin main --tags
   ```
6. Mover entradas de CHANGELOG.md: de `[Unreleased]` a `## [vNUEVA_VERSION] - YYYY-MM-DD`, dejar `[Unreleased]` vacío con categorías. Commit: `docs(changelog): release vNUEVA_VERSION`
7. Deployar producción: `docker compose up -d --build`
8. Verificar: `curl http://localhost:3000` y `curl http://localhost:4000/version`

## Changelog

Cada repo tiene su `CHANGELOG.md` en la raíz. Sigue https://keepachangelog.com/en/1.1.0/.

### Ciclo de vida

| Evento | Acción |
|--------|--------|
| Feature abierta | Agregar entrada bajo `[Unreleased]` en categoría correcta. Commit: `docs(changelog): registro feature/NOMBRE` |
| Feature cerrada | Verificar que la entrada sigue siendo precisa. Pushear develop |
| Release a main | Mover todas las entradas a `[vX.Y.Z] - fecha`. Dejar `[Unreleased]` vacío. Commit: `docs(changelog): release vX.Y.Z` |

### Categorías (orden estricto)

| Categoría | Uso |
|-----------|-----|
| `Added` | Features nuevas |
| `Changed` | Cambios en features existentes |
| `Deprecated` | Features próximas a eliminar |
| `Removed` | Features eliminadas |
| `Fixed` | Bug fixes |
| `Security` | Vulnerabilidades |

### Template inicial (si no existe CHANGELOG.md)

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
### Changed
### Fixed

## [v1.0.0] - 2026-06-08
### Added
- CRUD completo de videojuegos
- Version badge front+backend
- Month+Year date pickers
- Hours played field
- Docker deployment con PostgreSQL
```

## Docker Compose

| Ambiente | Archivo | Project Name | Comando |
|----------|---------|-------------|---------|
| Dev | `docker-compose.dev.yml` | `games_tracker_dev` | `docker compose -p games_tracker_dev -f docker-compose.dev.yml up -d --build` |
| Prod | `docker-compose.yml` | `games_tracker` | `docker compose up -d --build` |

### Puertos

| Servicio | Dev | Prod |
|----------|-----|------|
| Frontend | `localhost:3001` | `localhost:3000` |
| Backend API | `localhost:4001` | `localhost:4000` |
| PostgreSQL | `localhost:5433` | `localhost:5432` |

## Quick Reference

```
¿Qué quiere hacer?                → Acción
─────────────────────────────────────────────────────────────────
"agrega al proximo paso: X"       → Solo editar AGENTS.md
"implementar el próximo paso"     → feature/ + preguntar antes de cerrar
"pasa la feature X a producción"  → main merge + tag + prod deploy
¿Cambia frontend y backend?       → Feature branch en AMBOS repos
¿Cerrar feature?                  → PREGUNTAR al usuario primero
¿Tags?                            → SOLO desde main, NUNCA de develop
¿Feature cerrada (→ develop)?     → Docker dev (compose.dev.yml)
¿Release a main?                  → Tag semver + Docker prod (compose.yml)
```

## Anti-Patterns / Red Flags

| Pensamiento | Realidad | Acción correcta |
|-------------|----------|-----------------|
| "Deployo Docker para probar la feature rápido" | Feature abierta = no Docker | Usar `npm start` local |
| "Solo cambio frontend, no necesito branch en backend" | Si el cambio afecta API o datos, sí | Feature branch en ambos |
| "No actualizo el changelog, me voy a acordar" | No te vas a acordar | Actualizar al abrir la feature |
| "Esto es un fix chico, no merece versión" | Todo merge a develop merece entrada en changelog | Siempre registrar |
| "Hago el tag y después actualizo el changelog" | El tag debe reflejar el changelog | Changelog ANTES del tag |
| "Cierro la feature sin preguntar, total ya está" | El usuario puede querer cambios antes del merge | Preguntar siempre |
| "Olvidé pushear la feature branch" | Si se pierde el equipo, se pierde el código | Pushear regularmente |

## Important Notes

- Ambos repos (frontend + backend) llevan feature branch separada cuando el cambio los afecta
- **Nunca cerrar una feature sin preguntar al usuario.** Esperar aprobación explícita.
- **Los tags se crean SOLO desde main.** Nunca taguear desde develop o feature branches.
- Pushear feature branches regularmente para backup
- Misma versión de tag en ambos repos siempre
- El changelog se actualiza SOLO en los repos que el cambio afecta
