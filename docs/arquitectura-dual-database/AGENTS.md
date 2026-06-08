## 🏗️ Arquitectura: Dual Database

### Flujo de Inicialización

```
.env (DB_TYPE=sqlite|postgresql)
    ↓
server-unified.js
    ↓
db/database.js (abstracción)
    ↓
    ├─→ SQLite3 (games.db)
    └─→ PostgreSQL (via pg Pool)
```

### db/database.js

Driver unificado que abstrae diferencias entre SQLite y PostgreSQL:

```javascript
// Exporta interfaz idéntica para ambas BDs
export { initializeDatabase, getDatabase, closeDatabase, DB_TYPE }

// Internamente usa:
// - sqlite3.Database() para SQLite
// - pg.Pool() para PostgreSQL
```

### Ventajas del Diseño

| Aspecto | SQLite | PostgreSQL |
|--------|--------|-----------|
| **Setup** | ✅ Cero config | ⚠️ Requiere Docker |
| **Tamaño** | ✅ Archivo único | ❌ Servidor separado |
| **Desarrollo** | ✅ Ideal | ⚠️ Más complejo |
| **Producción** | ⚠️ Limitado | ✅ Escalable |
| **Concurrencia** | ⚠️ Limitada | ✅ Multi-usuario |
| **Transacciones** | ✅ Básicas | ✅ Avanzadas |
