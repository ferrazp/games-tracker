---
name: proximo-paso
description: Use when the user says "próximo paso", "next step", "siguiente paso", "agrega al próximo paso", "implementar el próximo paso" o "pasá X a prod" en games-tracker. Flujo GitHub Flow + Conventional Commits + release-please del monorepo.
---

# Próximo paso (GitHub Flow)

Monorepo único: `F:\projects\developments\games-tracker-monorepo` (`ferrazp/games-tracker`). Backend y frontend van en la **misma rama y el mismo PR**.

## 1. Rama corta desde main

```bash
git switch main && git pull
git switch -c <tipo>/<descripcion-corta>     # feat/, fix/, docs/, chore/, refactor/
```

## 2. Plan → aprobación

Plan breve: archivos (apps/backend, apps/frontend, deploy), enfoque técnico, decisiones. **Esperar aprobación.**

## 3. Implementar con TDD

Test primero, verlo fallar, implementar, `npm test` en verde (desde la raíz). Commits en Conventional Commits; el hook `commit-msg` los valida.

## 4. Probar → PR (con aprobación)

El usuario prueba con `npm run dev`. Después:

```bash
git push -u origin HEAD
gh pr create --title "<tipo>(<alcance>): <descripción>" --fill
gh pr merge --squash --auto
```

El título del PR es el commit en `main` y decide la versión: `feat` → minor, `fix`/`perf` → patch, `!` → major; el resto no cambia la versión.

**No** tocar versiones en `package.json`, **no** editar `CHANGELOG.md` y **no** crear tags: lo hace release-please.

## 5. Release y deploy (con aprobación, cuando el usuario quiera publicar)

1. Unir el PR `chore(main): release X.Y.Z` de release-please → tag, GitHub Release e imágenes `:X.Y.Z`.
2. `npm run qa:up -- --tag X.Y.Z` → el usuario prueba en http://localhost:8081.
3. `npm run prod:deploy -- X.Y.Z` → http://localhost:8080.

Ver `docs/OPERACION.md`.

## 6. Marcar como hecho

En `apps/backend/docs/proximos-pasos/AGENTS.md` cambiar `[ ]` por `[x]` (puede ir en el mismo PR).
