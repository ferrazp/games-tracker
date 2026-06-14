# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `GET /covers/random?console_id=N` — filtra covers por consola cuando se especifica
- Imágenes homogéneas de consolas con `image_type` (svg/bitmap), seed script con custom images (PS3, PS4, PS5, Wii, Family Game) + Icons8 para el resto
- Release year (`first_release_date`) en game_catalog y búsqueda online IGDB: nuevo campo en schema, respuesta de endpoints y búsqueda online
- Endpoint de búsqueda online en IGDB (`POST /search/online`) con retorno de plataforma (`console_name` + `platform_name`)
- Auto-creación de consolas al seleccionar un juego online con plataforma desconocida
- Botón "Buscar en IGDB" visible siempre que haya credenciales Twitch, incluso cuando hay resultados locales en el catálogo
- Filtro por consola en búsqueda online IGDB: al seleccionar una consola, la búsqueda online filtra por plataforma
- Opción "Ninguna" en el dropdown de consolas para poder deseleccionar

### Changed
- Console images seed script reescrito: CUSTOM_IMAGES map + ICONS8_MAP, PS5 corregido de 256×256 custom a 64×64 Icons8

### Fixed
- CORS FRONTEND_URL configurado correctamente para Docker dev (puerto 3001)

## [v1.0.0] - 2026-06-08

### Added
- CRUD completo de videojuegos (GET/POST/PUT/DELETE /games)
- Soporte dual SQLite + PostgreSQL
- Autenticación JWT
- Rate limiting en IGDB API
- Logging estructurado con pino
- Version badge endpoint (/version)
- Month+Year date pickers en campos de fecha
- Hours played field
- Documentación modular en AGENTS.md
- Skills de opencode (next-steps-validator)
- Docker deployment con PostgreSQL

### Changed
- Express 5 con body-parser reemplazado por express.json()
- Actualizadas todas las dependencias a últimas versiones (Express 5, pg 8.21, sqlite3 6, dotenv 17)
- Docker dev separado de prod (docker-compose.dev.yml, puertos 3001/4001/5433)

[Unreleased]: https://github.com/ferrazp/games-tracker/compare/v1.0.0...HEAD
[v1.0.0]: https://github.com/ferrazp/games-tracker/releases/tag/v1.0.0
