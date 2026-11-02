---
name: skill-reviewer
description: Valida skills SKILL.md contra el estándar abierto y mejores prácticas de la industria. Úsalo al crear o modificar cualquier skill para asegurar calidad antes de darla por terminada.
---

# Skill Reviewer

Valida skills SKILL.md contra el estándar abierto (https://www.agensi.io/learn/skill-md-specification-open-standard) y las mejores prácticas de la comunidad.

## When to Activate

- Creaste o modificaste un archivo `SKILL.md`
- Te pidieron validar una skill antes de darla por terminada
- Querés revisar la calidad de una skill existente
- Mencionás "validar skill", "revisar skill", "skill reviewer" o "evaluar skill"

## Core Principle

**Una skill debe ser autodetectable (frontmatter correcto), específica (trigger conditions claras), ejecutable (pasos concretos) y completa (quick reference + anti-patterns). Si falla en frontmatter, no se va a cargar nunca.**

## Validation Checklist

### 1. Frontmatter

| Item | Regla | Cómo verificar |
|------|-------|---------------|
| `name` existe | String requerido | Leer frontmatter |
| `name` sin espacios | Lowercase + hyphens, ej: `mi-skill` | `Read` + inspección visual |
| `name` = nombre del directorio | Debe coincidir exactamente | `(Get-Item ..).Parent.Name` vs frontmatter |
| `description` existe | String requerido, 20-1024 chars | Leer frontmatter + medición |
| `description` específica | Describe triggers, no la skill misma | Juicio: ¿describiría cuándo activarse? |
| `---` bien formado | Primeros 3 chars del archivo | `Read -Offset 1 -Limit 3` |

#### Correcciones rápidas

```
❌ name: Mi Skill          → no cumple regex
❌ name: mi_skill          → underscore inválido
❌ name: -mi-skill         → leading hyphen inválido
✅ name: mi-skill
```

### 2. Content Structure

| Item | Bueno | Malo |
|------|-------|------|
| When to Activate | Tabla con triggers explícitos | "Esta skill ayuda con X" vago |
| Core Principle | 1-2 oraciones en negrita | Ausente |
| Step-by-Step | Pasos numerados con comandos | Párrafos sin estructura |
| Quick Reference | Tabla o checklist compacto | Ausente |
| Anti-Patterns | Tabla: pensamiento → realidad → acción | Ausente |

#### Verificar con

```bash
# Check sections exist
rg "^## " F:\path\to\skill\SKILL.md
# Expected: When to Activate, Core Principle, (al menos un proceso), Quick Reference, Anti-Patterns
```

### 3. Description Quality

Evaluar la description del frontmatter:

```
✅ "Reviews code for security vulnerabilities, logic errors, and style violations."
❌ "Helps with code" (demasiado vago)
❌ "A really useful skill for developers" (describe la skill, no el trigger)
❌ "Use this when you want to review Python Flask API endpoints for SQL injection
    vulnerabilities in PostgreSQL queries" (demasiado específico)
```

### 4. Actionability

Cada paso debe ser ejecutable sin adivinar:

```
❌ "Mejorar el código" → ¿cómo? ¿qué archivos?
✅ "Ejecutar npm test, leer errores, corregir el archivo que falla"
```

### 5. Recommended Lengths

| Componente | Recomendado |
|-----------|-------------|
| Description | 20-160 caracteres |
| Core Principle | 1-2 oraciones |
| Trigger conditions | 3-6 items |
| Cada paso/fase | 50-200 palabras |
| Quick Reference | 5-15 líneas |
| Total skill | 200-400 líneas |

### 6. Visual Hierarchy

- H1: Título de la skill
- H2: Secciones principales (When to Activate, Core Principle, etc.)
- H3: Subsecciones (pasos detallados, variantes)
- Tablas para comparaciones
- Code blocks para comandos
- Listas ordenadas para secuencias
- Listas sin orden para opciones

## Output Template

```markdown
## Skill Review: [nombre]

### Frontmatter
- name: ✅/❌ ([detalle])
- description: ✅/❌ ([detalle])
- Total: [N]/2

### Content
| Componente | Estado | Nota |
|-----------|--------|------|
| When to Activate | ✅/⚠️/❌ | |
| Core Principle | ✅/⚠️/❌ | |
| Step-by-Step | ✅/⚠️/❌ | |
| Quick Reference | ✅/⚠️/❌ | |
| Anti-Patterns | ✅/⚠️/❌ | |

### Quality
- Description specificity: ✅/⚠️/❌
- Actionability: ✅/⚠️/❌
- Length (total líneas): [N] ([✅ dentro / ⚠️ cerca / ❌ fuera] del rango 200-400)

### Verdict
✅ Aprobada / ⚠️ Aprobada con mejoras / ❌ Rechazada
```

## Process

1. Leer el archivo `SKILL.md` completo
2. Verificar frontmatter (checklist sección 1)
3. Verificar estructura de contenido (checklist sección 2)
4. Evaluar calidad de description (checklist sección 3)
5. Evaluar actionability (checklist sección 4)
6. Medir longitud total (checklist sección 5)
7. Generar reporte usando el Output Template
8. Si hay ❌, explicar el problema y sugerir la corrección
9. No aprobar si hay frontmatter inválido (la skill no cargaría)

## Anti-Patterns

| Pensamiento | Realidad |
|-------------|----------|
| "La description puede ser cualquier cosa" | Si es muy vaga, la skill nunca se activa |
| "Con tener los pasos alcanza" | Sin trigger conditions, el agente no sabe cuándo usarla |
| "El frontmatter es opcional" | Es REQUERIDO. Sin name/description no funciona |
| "Una skill de 600 líneas es mejor" | El agente no sigue instrucciones tan largas |
| "Ya conozco el formato, no hace falta revisar" | Skills evolucionan, siempre revisar |
