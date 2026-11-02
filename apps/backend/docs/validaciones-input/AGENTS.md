## 🔐 Validaciones de Input

### POST /games
```
✓ title: string no vacío, requerido
✓ console_id: número, opcional (si se envía, debe existir)
✓ year_played: número, opcional
✓ completed: boolean, opcional
✓ image: string (base64), opcional
```

### POST /search (catálogo local)
```
✓ query: string 3-100 caracteres, requerido
✓ Query parametrizada (LIKE) — sin riesgo de inyección SQL
```

### POST /search/online (IGDB)
```
✓ query: string 3-100 caracteres, requerido
✓ Requiere credenciales Twitch configuradas
✓ Sanitización: escapa comillas (") para la query de IGDB
```

### POST /consoles
```
✓ name: string no vacío, único, requerido
✓ Validación de unicidad en BD
```
