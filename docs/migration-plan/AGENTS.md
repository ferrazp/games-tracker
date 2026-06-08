## 🔄 Plan de Migraciones BD

El proyecto usa un sistema de migraciones SQL versionadas para mantener el schema sincronizado entre entornos (SQLite/PostgreSQL).

### Cómo funciona

1. Las migraciones están en `migrations/` como archivos `NNN_descripcion.sql`
2. Se aplican en orden alfabético (por eso el prefijo numérico)
3. Cada migración ya aplicada se registra en la tabla `_migrations`
4. Solo se aplican las no registradas

### Ejecutar migraciones

```bash
# Aplica todas las pendientes
node db/migrate.js

# Con Docker
docker compose exec backend node db/migrate.js
```

### Migraciones actuales

| Archivo | Descripción |
|---------|-------------|
| `001_initial.sql` | Schema inicial: consoles, games, game_catalog, _migrations |
| `002_catalog_view.sql` | Vista `games_view` (PostgreSQL) |

### Agregar una migración nueva

1. Crear `migrations/003_descripcion.sql`
2. Escribir SQL (debe ser compatible con SQLite y PostgreSQL)
3. Ejecutar `node db/migrate.js`

```sql
-- migrations/003_descripcion.sql
ALTER TABLE games ADD COLUMN rating INTEGER DEFAULT NULL;
```

### Migración de schema: SQLite ↔ PostgreSQL

| Elemento | SQLite | PostgreSQL |
|----------|--------|------------|
| `INTEGER PRIMARY KEY` | `AUTOINCREMENT` automático | Usar `SERIAL` |
| `BOOLEAN` | `INTEGER` (0/1) | `BOOLEAN` (true/false) |
| `ILIKE` | No soportado | Case-insensitive |
| `LIKE` | Case-insensitive por default | Case-sensitive |
| `RETURNING` | No soportado | Soportado |
| `COUNT(*)` | Devuelve número | Devuelve `bigint` (castear con `::int`) |
| Views | `CREATE VIEW` | `CREATE OR REPLACE VIEW` |
| `INSERT OR IGNORE` | Soportado | Usar `ON CONFLICT DO NOTHING` |

### Rollback

No hay rollback automático. Para deshacer una migración:

1. Aplicar manualmente el SQL inverso
2. Eliminar el registro de `_migrations`:
   ```sql
   DELETE FROM _migrations WHERE name = '003_descripcion.sql';
   ```
