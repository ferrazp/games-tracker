## 📝 Validaciones de Datos

El servidor implementa validación en `server-unified.js`:

```javascript
// Validar búsqueda (catálogo local y online)
validateSearchQuery(query)
  - 3-100 caracteres
  - No nulo/vacío

// Validar datos de juego (title es el único campo obligatorio)
validateGameData(data)
  - title: string requerido (único campo validado)

// Normalizar/parsear datos de juego
parseGameData(data)
  - console_id: parseInt o null
  - year_played: parseInt o null
  - completed: coerción a boolean
  - image: string o null
```
