## 🔄 Cambios en el Esquema BD

### ⚠️ IMPORTANTE: Mantener este Documento Actualizado

Cuando realices cambios en el esquema:

1. **Actualiza `init.sql`** con cambios SQL
2. **Actualiza `db/database.js`** si hay diferencias SQL entre BD
3. **Documenta en este AGENTS.md**:
   - Nueva tabla: sección completa
   - Campo nuevo: fila en tabla de campos
   - Índice: agregar en sección índices
4. **Prueba ambas BDs**:
   ```bash
   npm run dev:sqlite        # Prueba SQLite
   docker-compose up -d && npm run dev:postgres  # Prueba PostgreSQL
   ```

### Plantilla para Nueva Tabla

```markdown
### Tabla: \`nombre_tabla\`

\`\`\`sql
CREATE TABLE nombre_tabla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
    -- id SERIAL PRIMARY KEY,              -- PostgreSQL
    campo1 TIPO CONSTRAINTS,
    campo2 TIPO CONSTRAINTS
);
\`\`\`

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| \`id\` | INTEGER/SERIAL | PRIMARY KEY | ID único |
| \`campo1\` | TIPO | CONSTRAINTS | Descripción |
```
