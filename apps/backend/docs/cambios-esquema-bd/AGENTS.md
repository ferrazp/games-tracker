## 🔄 Cambios en el Esquema BD

El esquema lo crea `initialize()` en [`db/database.js`](../../db/database.js) en cada arranque, y cada deploy lo aplica solo. Por eso todo cambio tiene que ser **aditivo e idempotente**.

### Pasos

1. **Escribir primero el test** (TDD) que use la tabla o columna nueva: `tests/integration/` corre contra SQLite.
2. **Editar los dos bloques de `initialize()`**:
   - SQLite (`schemaSQL` y los `ALTER TABLE … ADD COLUMN` que ignoran el error si ya existe).
   - PostgreSQL (`this.pool.query`, con `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).
3. **Nunca** renombrar ni borrar columnas o tablas con datos de prod: agregar nuevas y migrar en código.
4. **Documentar**:
   - Un `migrations/NNN_descripcion.sql` documental (`CREATE … IF NOT EXISTS`), con el porqué.
   - La tabla o columna en [Esquema de Base de Datos](../esquema-base-datos/AGENTS.md), con su porqué.
   - Si cambia la operación (jobs, backups), en [`docs/OPERACION.md`](../../../../docs/OPERACION.md).
5. **Probar en Postgres** antes de publicar: imágenes locales en QA.
   ```bash
   docker build -f apps/backend/Dockerfile -t ghcr.io/ferrazp/games-tracker-backend:local .
   docker build -f apps/frontend/Dockerfile -t ghcr.io/ferrazp/games-tracker-frontend:local .
   npm run qa:up -- --tag local --no-pull
   ```
   Para ensayar con datos reales: `npm run qa:up -- --tag <tag> --restore <backup de prod>`.

`prod:deploy` hace un backup antes de recrear los contenedores, así que un cambio de esquema que salga mal se puede revertir con `prod:rollback` (solo a pedido del usuario).
