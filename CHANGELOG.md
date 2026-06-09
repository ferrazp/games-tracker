# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Actualizadas todas las dependencias a sus últimas versiones estables (Express 5, body-parser 2, pg, sqlite3 6, dotenv 17, etc.)

### Fixed
- Adaptación de código para compatibilidad con Express 5 y body-parser 2

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
- Docker deployment con PostgreSQL
