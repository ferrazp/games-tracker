# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
