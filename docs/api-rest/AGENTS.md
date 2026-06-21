## 🔌 API REST - Endpoints

### Health Check

```http
GET /health
```

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-06-06T16:30:00.000Z"
}
```

---

### Juegos (Games)

#### Listar juegos (con paginación y filtros)

```http
GET /games?limit=20&offset=0&console_id=&completed=&q=
```

**Query Parameters** (todos opcionales):
- `limit`: integer, 1-100, default 20
- `offset`: integer, default 0
- `console_id`: integer, filtra por consola
- `completed`: boolean (`true`/`false`), filtra por estado
- `q`: string, búsqueda LIKE sobre título

**Response**: `200 OK`
```json
{
  "games": [
    {
      "id": 1,
      "title": "The Legend of Zelda",
      "year_played": 2024,
      "completed": true,
      "image": "base64_string...",
      "console_name": "Nintendo Switch",
      "console_id": 13,
      "created_at": "2026-06-06T03:37:35.940Z",
      "updated_at": "2026-06-06T03:37:35.940Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### Obtener un juego por ID

```http
GET /games/:id
```

**Parámetros**: `id` (integer, requerido)

**Response**: `200 OK`
```json
{
  "game": {
    "id": 1,
    "title": "The Legend of Zelda",
    "year_played": 2024,
    "completed": true,
    "image": "base64_string...",
    "console_name": "Nintendo Switch",
    "console_id": 13,
    "created_at": "2026-06-06T03:37:35.940Z",
    "updated_at": "2026-06-06T03:37:35.940Z"
  }
}
```

**Errores**:
- `400 Bad Request`: id inválido (no entero positivo)
- `404 Not Found`: el juego no existe

#### Crear un nuevo juego

```http
POST /games
Content-Type: application/json

{
  "title": "string (required)",
  "console_id": "integer (optional, debe existir si se envía)",
  "year_played": "integer (optional)",
  "completed": "boolean (optional, default: false)",
  "image": "string (optional, base64)"
}
```

**Response**: `201 Created`
```json
{
  "message": "Game added successfully",
  "game": { /* objeto completo con console_name */ },
  "success": true
}
```

**Errores**:
- `400 Bad Request`: `title` faltante, o `console_id` no existe

#### Actualizar un juego

```http
PUT /games/:id
Content-Type: application/json

{
  "title": "string (required)",
  "console_id": "integer (optional)",
  "year_played": "integer (optional)",
  "completed": "boolean (optional)",
  "image": "string (optional, base64)"
}
```

**Response**: `200 OK`
```json
{
  "message": "Game updated successfully",
  "game": { /* objeto completo con console_name */ },
  "success": true
}
```

**Errores**:
- `400 Bad Request`: id inválido, `title` faltante, o `console_id` no existe
- `404 Not Found`: el juego no existe

#### Eliminar un juego

```http
DELETE /games/:id
```

**Response**: `200 OK`
```json
{
  "message": "Game deleted successfully",
  "gameId": 1,
  "success": true
}
```

**Errores**:
- `400 Bad Request`: id inválido
- `404 Not Found`: el juego no existe

---

### Consolas (Consoles)

#### Listar todas las consolas

```http
GET /consoles
```

**Response**: `200 OK`
```json
{
  "consoles": [
    { "id": 1, "name": "Family Game" },
    { "id": 2, "name": "Super Nintendo" },
    { "id": 13, "name": "Nintendo Switch" },
    { "id": 15, "name": "PC" }
  ]
}
```

**Consolas Predefinidas** (15 total):
1. Family Game
2. Super Nintendo
3. Nintendo 64
4. Dreamcast
5. PlayStation 1
6. PlayStation 2
7. GameCube
8. PlayStation 3
9. PlayStation Portable (PSP)
10. Nintendo DS
11. Nintendo Wii
12. PlayStation 4
13. Nintendo Switch
14. PlayStation 5
15. PC

#### Agregar una nueva consola

```http
POST /consoles
Content-Type: application/json

{
  "name": "string (required, unique)"
}
```

**Response**: `201 Created`
```json
{
  "message": "Console added successfully",
  "console": { "id": 16, "name": "Xbox Series X" },
  "success": true
}
```

**Errores**:
- `400 Bad Request`: `name` faltante o consola ya existe

---

### Búsqueda (Search)

#### Buscar en catálogo local

```http
POST /search
Content-Type: application/json

{
  "query": "string (3-100 caracteres, required)"
}
```

**Descripción**: Busca juegos en el catálogo local precargado desde IGDB (~1000 juegos mejor rankeados por consola). Responde al instante sin llamadas a API externa.

**Response**: `200 OK`
```json
{
  "results": [
    {
      "id": 123456,
      "name": "The Legend of Zelda: Breath of the Wild",
      "cover": {
        "url": "//images.igdb.com/igdb/image/upload/t_cover_big/..."
      }
    }
  ],
  "source": "local",
  "online_available": false
}
```

**Errores**:
- `400 Bad Request`: Query inválido (< 3 o > 100 caracteres)
- `500 Server Error`: Error interno

#### Buscar online (IGDB API en vivo)

```http
POST /search/online
Content-Type: application/json

{
  "query": "string (3-100 caracteres, required)"
}
```

**Descripción**: Busca juegos directamente en la API de IGDB (Twitch). Útil cuando el catálogo local no encuentra el juego buscado. Requiere credenciales Twitch configuradas.

**Response**: `200 OK`
```json
{
  "results": [
    {
      "id": 123456,
      "name": "The Legend of Zelda: Breath of the Wild",
      "cover": {
        "url": "//images.igdb.com/igdb/image/upload/t_cover_big/..."
      }
    }
  ],
  "source": "online"
}
```

**Rate Limiting**: 30 requests por minuto por IP. Exceder el límite responde `429 Too Many Requests`.

**Errores**:
- `400 Bad Request`: Query inválido o credenciales Twitch no configuradas
- `429 Too Many Requests`: Se excedió el límite de rate (30/min)
- `500 Server Error`: Error de Twitch API

---

### Próximos Juegos (Wishlist)

Requiere autenticación JWT (Bearer token) en todos los endpoints.

#### Listar próximos juegos

```http
GET /wishlist
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "games": [
    {
      "id": 1,
      "game_catalog_id": 123,
      "sort_order": 0,
      "title": "The Legend of Zelda: Breath of the Wild",
      "console_name": "Nintendo Switch",
      "cover_url": "data:image/jpeg;base64,...",
      "created_at": "2026-06-21T12:00:00.000Z",
      "updated_at": "2026-06-21T12:00:00.000Z"
    }
  ]
}
```

#### Agregar juego a la lista

```http
POST /wishlist
Authorization: Bearer <token>
Content-Type: application/json

{
  "game_catalog_id": 123
}
```

**Response**: `201 Created`
```json
{
  "message": "Game added to wishlist",
  "game": { /* objeto completo */ },
  "success": true
}
```

**Errores**:
- `400 Bad Request`: `game_catalog_id` faltante, inválido o no existe en catálogo
- `409 Conflict`: El juego ya está en la wishlist

#### Reordenar la lista

```http
PUT /wishlist/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "id": 2, "sort_order": 0 },
    { "id": 1, "sort_order": 1 },
    { "id": 3, "sort_order": 2 }
  ]
}
```

**Response**: `200 OK`
```json
{
  "message": "Wishlist reordered successfully",
  "games": [ /* lista completa ordenada */ ],
  "success": true
}
```

**Errores**:
- `400 Bad Request`: `items` inválido o mal formado

#### Eliminar juego de la lista

```http
DELETE /wishlist/:id
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "message": "Game removed from wishlist",
  "id": 1,
  "success": true
}
```

**Errores**:
- `400 Bad Request`: id inválido
- `404 Not Found`: el item no existe
