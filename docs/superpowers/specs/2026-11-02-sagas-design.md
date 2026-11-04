# Sagas — diseño

Fecha: 2026-11-02 · Estado: borrador para aprobación del usuario

## Por qué

Hoy el usuario averigua a mano qué le falta de una saga: busca en internet cuántos juegos tiene (Final Fantasy, Tales of…), los compara con los que registró y saca la cuenta. Registra **todo lo que juega**, así que cualquier juego de la saga que no esté en su lista es uno que nunca jugó. Quiere que la app haga esa cuenta sola y le dé una pista de dónde jugar lo que le falta, para seguir investigando por su cuenta.

Éxito: abre la pestaña Sagas, entra a Final Fantasy y ve de un vistazo qué completó, qué dejó a medias y qué le falta (en gris), y con un clic tiene por dónde empezar a buscar uno que le falte.

## Objetivos

1. Reconocer automáticamente la saga de cada juego registrado, usando IGDB.
2. Pestaña **Sagas** (solo lectura) con una tarjeta por saga.
3. Pantalla completa por saga con todos sus juegos y el estado de cada uno.
4. Panel **Sugerir**, gratuito, para los juegos que faltan.
5. Guardar el ID de IGDB en cada juego (los nuevos al registrarlos; los existentes, con un proceso de completado).

## No objetivos

- Editar sagas a mano, crear sagas propias o corregir a qué saga pertenece un juego.
- Que los **Próximos Juegos** (wishlist) cuenten en las sagas. Un juego que solo está en la wishlist figura como "te falta".
- Recomendación con IA o búsqueda web. Se descartó por costo (API paga aparte de la suscripción); podría sumarse más adelante encima del panel Sugerir sin rehacerlo.
- Precios, ofertas o disponibilidad real en tiendas.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que un juego que el usuario jugó figure como faltante porque lo registró en otra versión (port/remaster) o porque no se pudo identificar. Ante la duda, se le pregunta; nunca se adivina en silencio.
- Que la saga mezcle cosas que no son la saga (Kingdom Hearts, Mario Hoops, DLCs, ediciones de colección).
- Que abrir la pantalla dependa de IGDB en ese momento (lenta o rota si IGDB no responde).
- Tocar o perder datos de prod: el completado de IDs se prueba primero en QA con una copia y se apoya en el backup automático del deploy.

## Lo que decidió el usuario

- **Agrupación:** la **serie** de IGDB (`collections`), no la franquicia. Cada juego va a **la serie más grande** en la que esté (la que tenga más juegos). Los spin-offs que no están en la serie principal forman su propia saga (Chocobo, Crystal Chronicles, Dissidia…).
  - Precisión (decisión del agente, coherente con lo medido con el usuario): **cada juego de IGDB pertenece a una sola saga**, la de su serie más grande. Una saga lista solo los juegos cuya serie más grande es ella; un juego nunca aparece en dos sagas. Si un spin-off (p. ej. un Dissidia) también está en la serie "Final Fantasy" y esa es su serie más grande, cae en Final Fantasy: manda IGDB. "Más grande" se mide por la cantidad **cruda** de juegos de la serie en IGDB (`collections.games`), antes de filtrar por tipo; empate → el id de serie menor.
- **Estados de cada juego en una saga:**
  - **Completado:** registrado y marcado como completado.
  - **Pendiente:** registrado con fecha de inicio y sin completar.
  - **Te falta:** pertenece a la saga y no está registrado. Se muestra en **escala de grises**.
- **Una saga aparece en cuanto hay al menos un juego registrado** que pertenezca a ella (Tales of aparece al registrar el primero).
- **Pantalla de saga: opción A del boceto** — grilla de portadas agrupadas por año de lanzamiento, con filtros Todos / Completados / Pendientes / Te faltan y un encabezado con el resumen ("4 completados · 1 pendiente · te faltan 84").
- **Sugerir:** al pasar el mouse sobre una portada gris aparece "Sugerir"; al hacer clic se abre el panel.
- **Sugerir gratuito, sin IA:** muestra las versiones/plataformas que conoce IGDB, marca como sugerida la más reciente, y ofrece links de búsqueda ya filtrados por el título.
- **IDs de IGDB:** los juegos nuevos lo guardan al registrarse; para los existentes, el agente se encarga de un proceso de completado.

## Decisiones del agente (el usuario puede revisarlas)

- **Un juego registrado sin fecha de inicio y sin completar** cuenta como Pendiente (no queda afuera).
- **Qué entra en la lista de una saga:** juegos principales y remakes (IGDB `game_type` 0 = main game y 8 = remake). Quedan afuera DLCs, expansiones, bundles, ediciones, ports y remasters; los ports y remasters aparecen como "versiones" dentro de Sugerir. Consecuencia: Final Fantasy VII Remake y Final Fantasy VII original son dos juegos distintos de la saga.
- **Un juego registrado que es port, remaster o edición** (p. ej. "Final Fantasy X HD Remaster") se reconoce como su juego padre en IGDB (`version_parent` / `parent_game`), y es el padre el que cuenta como completado/pendiente. Si un juego tiene padre que es remake de otro (Remake → VII), cuenta como el **remake**, no como el original.
- **Un juego registrado que es expansión o DLC** (p. ej. "Final Fantasy XIV: Heavensward") se reconoce como su juego base (`parent_game`) y le aporta su estado: haber jugado la expansión implica haber jugado el base. Nunca queda "sin identificar" solo por ser expansión.
- **Si dos registros del usuario caen en el mismo juego de la saga** (lo jugó en dos consolas), el estado más avanzado gana: Completado > Pendiente.
- **Celular (sin hover):** un toque en la portada gris abre el panel Sugerir como hoja desde abajo; las portadas grises muestran siempre un ícono chico de 🔍 para que se note que se pueden tocar.
- **Caché:** la lista de juegos de cada saga se trae de IGDB y se guarda en la base. El refresco automático lo hace **el servidor** (al arrancar y una vez por día, solo las sagas con más de 7 días), nunca una visita: las rutas de lectura públicas no llaman a IGDB ni escriben. Además hay un botón **"Actualizar saga"** en la pantalla de la saga, que requiere sesión.
- **Portadas de los juegos faltantes:** se guarda en la base la **URL** de la portada de IGDB (tamaño chico, `t_cover_big`), no la imagen; el navegador la carga desde el CDN de IGDB. Si no carga, se muestra un recuadro gris con el título. Así los backups no crecen con cientos de imágenes. (El anti-objetivo de "no depender de IGDB" se refiere a los datos de la saga, que sí están en la base.)
- **Orden de las tarjetas en la pestaña Sagas:** por cantidad de juegos registrados (más arriba las sagas que más jugó); empate, alfabético.
- **Tarjeta de saga:** collage de hasta 3 portadas de juegos registrados, nombre, barra de avance (completados en verde, pendientes en amarillo) y el texto "N completados · M pendientes · te faltan K de T".
- **Versión "sugerida" en el panel:** la de lanzamiento más reciente entre el juego y sus ports/remasters conocidos por IGDB. Si IGDB solo conoce la original, se sugiere esa.
- **Links de búsqueda del panel:** Steam, PlayStation Store, Nintendo eShop, Xbox y Google ("dónde jugar <título>"), cada uno con el título ya cargado en la búsqueda.
- **Sin credenciales de IGDB** (no hay `TWITCH_CLIENT_ID`): la pestaña muestra un aviso de que hace falta configurarlas, en vez de fallar.

## Completar los IDs de los juegos ya registrados

Hoy la tabla `games` no guarda el ID de IGDB (solo título, consola, fechas, imagen). `game_catalog` (~7.800 filas) sí tiene `igdb_id`, pero es UNIQUE: cada fila es un juego de IGDB con **una** consola, y un juego multiplataforma figura una sola vez (los ports con id propio sí tienen fila aparte). Prod tiene al menos 6 juegos más los Final Fantasy cargados después del último backup.

Proceso único, idempotente, que se puede volver a correr:

1. Para cada juego sin ID: buscar en `game_catalog` por título exacto (sin distinguir mayúsculas), en cualquier consola. Si hay varias filas, preferir la de la consola del juego. Una coincidencia (o una sola en la consola del juego) → se asigna.
2. Si no, buscar en IGDB por título (y plataforma de la consola).
3. **Una sola coincidencia clara** → se asigna automáticamente. **Varias o ninguna** → el juego queda como "sin identificar".
4. Los "sin identificar" se muestran en una lista corta para que el usuario elija entre los candidatos (o marque "no es de ninguna saga"). Mientras no se resuelvan, ese juego no aparece en ninguna saga, y la pestaña Sagas lo avisa ("2 juegos sin identificar — revisar").
5. Se ensaya primero en QA con una copia de los datos de prod, para ver cuántos se asignan solos y cuántos quedan dudosos. En prod corre después del deploy, que ya saca un backup antes de tocar nada. La elección manual de los dudosos se hace **directamente en prod** desde la lista de revisión (solo escribe el `igdb_id` del juego); lo elegido en QA no se traslada.

## Restricciones

- Monorepo `ferrazp/games-tracker`: Express 5 + SQLite (dev) / Postgres 17 (QA/prod), React 19 + Vite. Todo SQL tiene que andar en ambos motores (patrón existente con variantes `?` / `$1`).
- Cambios de esquema con una migración nueva en `apps/backend/migrations/` (siguiente número: `006_…`), aplicada por `db/migrate.js`.
- IGDB vía las credenciales Twitch ya configuradas (`services/twitch.js`, `services/igdb.js`). Respetar los límites de la API de IGDB (4 requests/segundo): el completado de IDs y el refresco de sagas tienen que espaciar o agrupar las consultas (IGDB acepta `where id = (…)` con listas).
- Las rutas de lectura de sagas pueden ser públicas como `GET /games`; las que escriben (asignar ID, resolver "sin identificar", refrescar) requieren JWT como el resto de las escrituras. Usar `apiFetch` en el front para las llamadas autenticadas (regla de `apps/frontend/AGENTS.md`).
- Flujo del repo: TDD, Conventional Commits, PR con `ci` en verde, release con release-please. No commitear `.env`, `deploy/*.env`, `deploy/.*-version` ni `*.db`.
- Todos los textos de la UI en español rioplatense, como el resto de la app.

## Datos de referencia (relevados en IGDB el 2026-11-02)

- Serie "Final Fantasy" (id 39): 193 entradas; con la regla de "serie más grande" quedaron ~89 contando principales, remakes **y remasters**. Como los remasters se excluyen de la lista, el total real de la saga será menor; es un número de referencia, no un valor esperado en tests.
- Serie "Tales" (id 269) para Tales of Arise, Berseria, Destiny…; los de móvil caen en "Tales of Mobile".
- IGDB marca a FF VII Remake y Rebirth como remakes (`game_type` 8) de FF VII, y a la vez los pone en cuatro series (Final Fantasy, Final Fantasy VII, Compilation of FF VII, FF VII Remake).
- IGDB **no** conoce todas las versiones actuales: de FF IX solo sabe PS1/PS3/PSP y una remasterización móvil, aunque `game_catalog` tiene una entrada de FF IX para PS4. El panel Sugerir debe combinar lo que trae IGDB con las entradas de `game_catalog` del mismo título en otras consolas.

## Qué queda a criterio de quien lo construya

- Forma exacta de las tablas nuevas (sagas, juegos de cada saga, relación con `games`) y de las rutas de la API.
- Cómo se dispara el completado de IDs (script `npm run`, endpoint protegido o paso automático al arrancar), siempre que sea idempotente y se pueda ensayar en QA.
- Diseño visual fino dentro del estilo actual de la app (bocetos de referencia en `.superpowers/brainstorm/`, no versionados).
- Paginación o carga perezosa de portadas si una saga es muy grande.
