# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.4.0] - 2026-06-21

### Added
- Sección "Próximos Juegos" (wishlist): componente Wishlist con búsqueda local + IGDB online, reorden ↑↓, remover ✕
- Tabs en App: "Lista de Juegos" / "Próximos Juegos"
- Barra de filtros/búsqueda en la lista de juegos: búsqueda por título, selector de consola con iconos, filtro completado/pendiente, rango de años jugado y completado, ordenamiento
- Filtro por consola usando solo iconos (sin texto) en la lista de juegos

## [v1.3.0] - 2026-06-14

### Performance
- Side panels cachean covers por `consoleId` en `useRef` — cambiar a una consola ya visitada es instantáneo (sin fetch)
- Se mantienen las covers viejas visibles mientras cargan las nuevas (sin flash blanco)

### Added
- Side panels dinámicos: cambian las portadas según la consola seleccionada en GameForm/GameList
- Componente ConsoleImage para renderizar imágenes SVG inline o bitmap según image_type
- Selector visual de consolas con imágenes (Wikipedia thumbnails en Base64)
- Botón "Completado" se deshabilita hasta seleccionar un juego del catálogo
- Release year (`first_release_date`) en catálogo de juegos y búsqueda online IGDB: campo de año de lanzamiento visible al buscar y seleccionar juegos
- Búsqueda online en IGDB desde GameForm: botón "Buscar en IGDB" visible siempre, incluso con resultados locales; filtra por consola seleccionada
- Auto-creación de consolas: si un juego online pertenece a una plataforma que no está en la DB, se crea automáticamente al seleccionarlo
- Opción "Ninguna" en dropdown de consolas para poder deseleccionar
- Version badge mostrando versión del frontend y backend
- Skill de git-flow-workflow con reglas de etiquetado, CORS fix y solo SQLite local en features

### Changed
- Actualizadas todas las dependencias a últimas versiones estables (React 19, react-datepicker 9, web-vitals 5, date-fns 4, testing-library)
- DatePicker de mes/año: agregado header custom con dropdown de años y locale español

### Fixed
- CORS FRONTEND_URL configurado correctamente para Docker dev (puerto 3001)

## [v1.2.1] - 2026-06-13

### Added
- Side panels con portadas rotadas y solapadas — más juegos visibles en el fondo
- Login label alignment fix — padding-left en labels de login

## [v1.2.0] - 2026-06-13

### Added
- Side panels decorativos con portadas aleatorias del catálogo
- Endpoint GET /covers/random en backend
- Servicio de covers para side panels
- Login label alignment fix — padding-left en labels de login

### Changed
- Side panels: de grid a cartas apiladas rotadas y solapadas (v1.2.1)

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

[Unreleased]: https://github.com/ferrazp/games-tracker-front/compare/v1.3.0...HEAD
[v1.3.0]: https://github.com/ferrazp/games-tracker-front/releases/tag/v1.3.0
[v1.2.1]: https://github.com/ferrazp/games-tracker-front/releases/tag/v1.2.1
[v1.2.0]: https://github.com/ferrazp/games-tracker-front/releases/tag/v1.2.0
[v1.0.0]: https://github.com/ferrazp/games-tracker-front/releases/tag/v1.0.0
