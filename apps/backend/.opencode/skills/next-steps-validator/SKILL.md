---
name: next-steps-validator
description: Use when completing a feature or task - validates pending work against the Next Steps checklist, verifying each item against actual project state before reporting completion
---

# Next Steps Validator

## Overview

Validates that "Next Steps" / "Progress" items are genuinely completed by checking actual project state (files, git log, running state). Prevents false completion claims.

When a feature adds, edits, or removes code, this skill checks if any change causes a "Next Steps" item to flip from ❌ to ✅.

## Workflow

### 1. Read the Current Checklist

Extract all items from `docs/proximos-pasos/AGENTS.md` and the session "Progress" section.

### 2. For Each Item, Determine Verification Method

| Item Type | Verification Method |
|-----------|-------------------|
| File creation/modification | `Test-Path` / `git log --oneline -5` |
| Code behavior | Run the app / check test output |
| Git setup | `git branch -a`, `git remote -v`, `git log --oneline` |
| Config changes | Read the file and check content |
| External service | Check connectivity / curl endpoint |
| Documentation | Read the file and verify content |

### 3. Categorize Status

- **✅ Done** — verified evidence matches claim
- **❌ Pending** — not started
- **⚠️ Partial** — started but incomplete
- **🔴 Blocked** — blocked by external factor, document why
- **❓ Unknown** — cannot determine from available information

### 4. Auto-Detect Changes from Feature

After implementing a feature:

1. Run `git diff --stat` (or similar) to see what files changed
2. Cross-reference each changed file against the checklist items
3. If a changed file maps to a checklist item, verify the item:
   - Read the file to confirm it contains the expected implementation
   - If confirmed, mark the checklist item as ✅ in `docs/proximos-pasos/AGENTS.md`
4. Update `docs/proximos-pasos/AGENTS.md` with any newly completed items

### 5. Report

Output a table:

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Setup git and push | ✅ | `git log` shows commit, remote is configured |
| 2 | Feature X implementation | ❌ | No feature branch exists, code not found |

### 6. Decision

- If **all items are ✅**, feature is complete
- If **any item is ❌ or ⚠️**, do NOT claim completion — address pending items first
- If **any item is 🔴**, report blocker to user

### 7. Update Source of Truth

If items were completed, update `docs/proximos-pasos/AGENTS.md` to reflect current status. This file is the source of truth for what's done and what's pending.
