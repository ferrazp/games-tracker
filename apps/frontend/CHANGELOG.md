# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version badge mostrando versión del frontend y backend
- Skill de git-flow-workflow con reglas de etiquetado, CORS fix y solo SQLite local en features

### Changed
- Actualizadas todas las dependencias a últimas versiones estables (React 19, react-datepicker 9, web-vitals 5, date-fns 4, testing-library)

### Fixed
- CORS FRONTEND_URL configurado correctamente para Docker dev (puerto 3001)

## [v1.0.0] - 2026-06-08

### Added
- CRUD completo de videojuegos (GameForm + GameList)
- Búsqueda mock local con debounce de 400ms
- Conversión de imágenes IGDB a Base64
- Selector de año con react-datepicker
- Month+Year date pickers
- Hours played field
- README en español
- Próximos pasos checklist en AGENTS.md
- Skills de opencode (next-steps-validator, git-flow-workflow)
- Docker deployment con Nginx

### Changed
- Documentación del proyecto modularizada en AGENTS.md

[Unreleased]: https://github.com/ferrazp/games-tracker-front/compare/v1.0.0...HEAD
[v1.0.0]: https://github.com/ferrazp/games-tracker-front/releases/tag/v1.0.0
