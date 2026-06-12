---
name: gitflow-proximo-paso
description: Use when the user says "próximo paso", "next step", "siguiente paso", or explicitly asks to follow the gitflow workflow for implementing a feature
---

# Gitflow Próximo Paso

Workflow for each "próximo paso" (next step) in the games-tracker project.

## Workflow

### 0. Open Feature Branch (gitflow)

```bash
git flow feature start <short-descriptive-name>
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

### 4. Close Feature → Merge → Versions → Changelog (on approval)

```bash
git flow feature finish <name>
git checkout develop
git push origin develop
```

Update versions:
- Backend: `package.json` version bump
- Frontend: `package.json` version bump
- Both must match the new dev version (e.g. `1.2.0-dev.1`)

Update `CHANGELOG.md` (both backend and frontend) under `[Unreleased]`:
- List what was added/changed in this step
- Include the feature name and relevant details

Push tags and changelog:
```bash
git add -A
git commit -m "chore: bump to v<version> and update changelog"
git push origin develop
```

### 5. Mark as Verified

Update `docs/proximos-pasos/AGENTS.md`: change `[ ]` to `[x]` for the completed item.

### 6. Self-Update

Append any refinements to this skill if the workflow evolved.
