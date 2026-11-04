# Changelog

## [1.9.1](https://github.com/ferrazp/games-tracker/compare/v1.9.0...v1.9.1) (2026-11-04)


### Correcciones

* **backend:** follow longer IGDB version chains to reach the original game ([#38](https://github.com/ferrazp/games-tracker/issues/38)) ([149db49](https://github.com/ferrazp/games-tracker/commit/149db49617168c564fc8163e6cf9cb0dd14f24f6))

## [1.9.0](https://github.com/ferrazp/games-tracker/compare/v1.8.0...v1.9.0) (2026-11-04)


### Funcionalidades

* show the sagas' own covers in the side panels ([#36](https://github.com/ferrazp/games-tracker/issues/36)) ([d598d60](https://github.com/ferrazp/games-tracker/commit/d598d606f041019c72acb06f23df3714a4d97115))

## [1.8.0](https://github.com/ferrazp/games-tracker/compare/v1.7.0...v1.8.0) (2026-11-04)


### Funcionalidades

* archive and restore games of a saga ([#35](https://github.com/ferrazp/games-tracker/issues/35)) ([b7bb354](https://github.com/ferrazp/games-tracker/commit/b7bb354aa2b37dea7f4a65cf21c13a88c019338a))
* **backend:** add the sagas API and refresh them daily and after each change ([5d77ef5](https://github.com/ferrazp/games-tracker/commit/5d77ef51ed8094290f761193a7973589fdce7bb3))
* **backend:** group registered games into sagas using IGDB series ([5d77ef5](https://github.com/ferrazp/games-tracker/commit/5d77ef51ed8094290f761193a7973589fdce7bb3))
* **backend:** store the IGDB id of each registered game ([5d77ef5](https://github.com/ferrazp/games-tracker/commit/5d77ef51ed8094290f761193a7973589fdce7bb3))
* **frontend:** add the sagas tab with each saga's missing games and suggestions ([5d77ef5](https://github.com/ferrazp/games-tracker/commit/5d77ef51ed8094290f761193a7973589fdce7bb3))
* **frontend:** let the user pick the right game when it is ambiguous ([5d77ef5](https://github.com/ferrazp/games-tracker/commit/5d77ef51ed8094290f761193a7973589fdce7bb3))

## [1.7.0](https://github.com/ferrazp/games-tracker/compare/v1.6.1...v1.7.0) (2026-11-02)


### Funcionalidades

* **frontend:** completed date picker opens one month after the start date ([#31](https://github.com/ferrazp/games-tracker/issues/31)) ([f87d168](https://github.com/ferrazp/games-tracker/commit/f87d168314a3cc2a6f4815f1b12b1b0b92b20ce1))


### Correcciones

* **backend:** export and import all game fields and the wishlist ([9e6c610](https://github.com/ferrazp/games-tracker/commit/9e6c6101779e726dab1df34b44b6701776530621))
* **backend:** trust the nginx proxy to read the client IP ([9e6c610](https://github.com/ferrazp/games-tracker/commit/9e6c6101779e726dab1df34b44b6701776530621))
* **deploy:** accept quoted values in deploy env files ([9e6c610](https://github.com/ferrazp/games-tracker/commit/9e6c6101779e726dab1df34b44b6701776530621))
* **frontend:** expired session returns to login instead of showing alerts ([9e6c610](https://github.com/ferrazp/games-tracker/commit/9e6c6101779e726dab1df34b44b6701776530621))
* **frontend:** list search waits until you stop typing ([9e6c610](https://github.com/ferrazp/games-tracker/commit/9e6c6101779e726dab1df34b44b6701776530621))

## [1.6.1](https://github.com/ferrazp/games-tracker/compare/v1.6.0...v1.6.1) (2026-11-02)


### Correcciones

* **deps:** bump the npm-major group with 6 updates ([#28](https://github.com/ferrazp/games-tracker/issues/28)) ([3b22fe4](https://github.com/ferrazp/games-tracker/commit/3b22fe4a3dcda8fc13b9bf1a7227937fc18914dc))
* **docker:** bump nginx from 1.28-alpine to 1.31-alpine in /apps/frontend in the docker-minor-patch group across 1 directory ([#17](https://github.com/ferrazp/games-tracker/issues/17)) ([d6064e0](https://github.com/ferrazp/games-tracker/commit/d6064e0df69e696fc20dd4d0b7b03e59222e89e8))
* **docker:** run backend and frontend images on Node 26 ([#27](https://github.com/ferrazp/games-tracker/issues/27)) ([5dc9bab](https://github.com/ferrazp/games-tracker/commit/5dc9bab2589968fcaad7f523cfdf86f891b14b93))

## [1.6.0](https://github.com/ferrazp/games-tracker/compare/v1.5.0...v1.6.0) (2026-11-02)


### Funcionalidades

* **deploy:** desktop launcher menu, prod start/stop and root README ([#22](https://github.com/ferrazp/games-tracker/issues/22)) ([02f2bb5](https://github.com/ferrazp/games-tracker/commit/02f2bb5ead82bfd071e96823048f2689f2778318))

## [1.5.0](https://github.com/ferrazp/games-tracker/compare/v1.4.1...v1.5.0) (2026-11-02)


### Funcionalidades

* CI, automated releases and isolated QA/prod environments ([#6](https://github.com/ferrazp/games-tracker/issues/6)) ([5e3db42](https://github.com/ferrazp/games-tracker/commit/5e3db42f2c8d9d7e4e8e005f833644f46d03a7b1))
