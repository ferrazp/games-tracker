---
name: gitflow-proximo-paso
description: Use when the user says "próximo paso", "next step", "siguiente paso", or explicitly asks to follow the gitflow workflow for implementing a feature
---

# Gitflow Próximo Paso

Workflow for each "próximo paso" (next step) in the games-tracker project.

Backend and frontend are **separate git repos** — apply workflow to each.

- Backend: `F:\projects\developments\games-tracker-backend` — has git-flow config
- Frontend: `F:\projects\developments\games-tracker`

## Workflow

### 0. Open Feature Branch (gitflow) — Backend only

Backend has git-flow configured (`main`/`develop` + `feature/` prefix).
Frontend: commit directly to `develop` unless user specifies otherwise.

```bash
# backend
git flow feature start <short-descriptive-name>
# or manually:
git checkout -b feature/<name> develop
```

### 1. Create Plan → Present to User

Write a brief plan covering:
- What files will change (backend, frontend, or both)
- Technical approach
- Key decisions

Present and **wait for approval**.

### 2. Implement (on approval)

Execute the plan. Add/Edit files as specified.

### 3. User Tests → Commit (on approval)

Wait for user to test with `npm start` (frontend) or `node server-unified.js` (backend). After user confirms it works:

```bash
git add -A
git commit -m "<type>: <description>"
```

If both repos changed, commit each separately.

### 4. Close Feature → Merge → Versions → Changelog (on approval)

Merge backend feature branch:

```bash
git checkout develop
git merge --no-ff feature/<name>
git branch -d feature/<name>
git push origin develop
```

Update versions:
- Backend: `package.json` version bump
- Frontend: `package.json` version bump
- Both must match the same new dev version (e.g. `1.2.0-dev.1`)

Update `CHANGELOG.md` (both backend and frontend) under `[Unreleased]`:
- Add new entries without removing old ones
- Include the feature name and relevant details

Push changelog:

```bash
git add -A
git commit -m "chore: bump to v<version> and update changelog"
git push origin develop
```

### 5. Mark as Verified

Update `docs/proximos-pasos/AGENTS.md` in backend repo: change `[ ]` to `[x]` for the completed item.

### 6. Self-Update

Append any refinements to this skill if the workflow evolved.
