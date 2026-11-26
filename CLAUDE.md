# Macar Showdown — notas para Claude Code

Dueño: Arturo (Macar). Háblale en español de España: frases cortas, al grano, una recomendación cuando pide decidir, honesto, sin halagos. La app sale en inglés por defecto (Arturo juega Showdown en inglés); se puede pasar a español en Settings. El código y los textos fuente están en español y `renderer/i18n.js` los traduce. Los nombres de Pokémon, movimientos, objetos y habilidades, siempre en inglés.

## Qué es
App de escritorio para Windows (Electron) para jugar Pokémon Champions VGC (Reg M-C, nivel 50) en Pokémon Showdown y prepararse: pantalla de inicio con sesiones por equipo, Showdown dentro de la app, captura automática de partidas, Dashboard (Resumen, Partidas, Rivales, Tu equipo, Hábitos), Tu equipo, calculadora con Multicalc, Teambuilder, Matchups, Mi PC, Optimizador SP y documento de preparación (prep doc). Los equipos de torneo (top teams) no se enseñan aquí: eso va en la Macar Dex; los datos de torneo solo sirven para los sets del rival en la calculadora. Uso personal. Inspirada en las funciones de la app Flinched (instalada en `C:\Program Files\Flinched`), pero con código propio y el estilo de la Macar Dex: nunca copiar su código, imágenes ni textos.

Repositorio: `Macar218/macar-showdown` (público). Cada push a `main` compila el instalador en GitHub Actions y publica la versión `v<package.json version>` con `Macar-Showdown-Setup-x.y.z.exe`, `.blockmap` y `latest.yml`. Las apps instaladas se actualizan solas (electron-updater) desde la 0.4.0. Para que una versión llegue a los usuarios hay que subir la versión en `package.json` (y `package-lock.json`).

## Archivos
| Archivo | Qué |
|---|---|
| `main.js` | Proceso principal: ventana, webview de Showdown, IPC, carpeta de datos (OneDrive), PDF, replays (protocolo `msreplay://`), Pokepaste, torneos, actualización. «Otra ventana» (`openExtra`): la misma página con `?w=2&view=…`, sin Showdown, en el otro monitor o al lado (con un monitor, las dos se reparten la pantalla); `notify` avisa a todas y la que no hizo el cambio lo recibe con `other: true`. Modo pruebas con variables `MACAR_*` |
| `preload.js` | Puente seguro (`window.macar`). Nada de Node en la página |
| `src/parser.js` | Lector de registros de Showdown → resumen de partida |
| `src/store.js` | Guardado: una partida por archivo (con `notes`, `replay`, `session` y `mark` = {r: good/meh/bad, a: true = por analizar · 'done' = analizada}) + colecciones (`equipos`, `pc`, `docs`, `partidaTeam`, `liveNotes`, `sesiones`, `bo3Notes`, `matchups`) y ajustes (`sessionId` = sesión abierta) |
| `src/capture.js` | Captura: guarda cada combate al terminar |
| `src/sdapp.js` | Los dos clientes de Showdown: el de siempre (`window.app`) y el nuevo (`window.PS`, con `/newclient` o la cookie `preactalpha`). `SDAPP` devuelve el cargado con la forma del de siempre; captura, notas, calculadora, replay y «Mandar mi equipo» leen siempre a través de él |
| `src/live.js` | Lee el combate abierto para la calculadora en directo (también la hoja de equipo, línea showteam, de cada lado). `READ` es el lector; `LIVE` lo usa en Showdown y `REPLAY(lado)` en el reproductor de replays (`Replays.battle`) |
| `src/media.js` | Combate actual (notas y grabación) y subida de replays (`/savereplay`) |
| `src/usage.js` | Sets más usados de Smogon (chaos, 1760+), en caché en `<datos>/uso` |
| `src/extensions.js` | Extensiones de Chrome para la sesión de Showdown (Chrome Web Store, .crx/.zip, carpeta), en `<userData>/extensiones` |
| `src/macardex.js` | Datos de la Macar Dex (https://macar218.github.io/macar-dex/: moves, sets, items, meta, es, data = habilidades), en `<datos>/macardex`, renovados como mucho una vez al día. Se leen con `vm` (solo `window`) |
| `src/tournaments.js` | Torneos online de Limitless (API pública, M-C, 30 días, ≥16 jugadores): sets de torneo y equipos del top 8, en `<datos>/torneos.json` |
| `renderer/app.js` | Navegación, filtros (`F`) y qué partidas cuentan (sesión, equipo o todas), panel de partida (notas y notas finales), importar, Ajustes |
| `renderer/dash.js` | Dashboard: Resumen, Partidas, Rivales, Tu equipo y Hábitos con los mismos filtros |
| `renderer/start.js` | Pantalla de inicio: cargar una sesión de un equipo o crear una nueva (equipo existente o Pokepaste) |
| `renderer/myteam.js` | Tu equipo: ficha de cada Pokémon del equipo de la sesión, usuario de Showdown, Pokepaste, cambiarlo |
| `renderer/stats.js` | Estadísticas (también en Node para los tests) |
| `renderer/poke.js` | Piezas comunes: datos del motor, sets Showdown, daño/velocidad, editor de Pokémon, selector de movimientos (`movePanel`) y de objetos (`itemPanel`), datos de uso y de torneo, Team Box, Mi PC |
| `renderer/calc.js` / `multicalc.js` | Dos calculadoras independientes de `makeCalc`: `CalcLive` (cajón de Jugar: sigue el combate, hoja de equipo del rival, se vacía al acabar) y `CalcStudy` (página Calculadora: equipos, Mi PC, rivales de partidas). `Calc` reparte las llamadas de fuera. Hay una tercera, `CalcReplay`, en el visor de replays. Pestañas Daño (estilo calculadora de Showdown: filas de 6 con × arriba y «+ Añadir» en la etiqueta; arena y velocidad | ataques, fijos arriba al bajar en la página Calculadora; el cálculo a todo el ancho; Pokémon · campo (tabla tu lado / su lado) · Pokémon, con puntos y niveles con flechas, «→ Mi PC» con nombre y «Cálculo a Mi PC» por Pokémon, guardado con `k` = off/def según ataque o reciba; `P.calcRole` deduce los antiguos; objeto con `P.itemPanel` ahí mismo; «↺ Como en tu equipo»; columna base a nivel 50), Multicalc y Árbol; la Multicalc guarda su estado en cada calculadora (`S.multi`). En estudio, los de un equipo quitados con × van en `S.hide` |
| `renderer/team.js` | Teambuilder: pestañas de los 6 y editor en la página (puntos estilo Showdown primero; el editor completo en «Más opciones») |
| `renderer/matchups.js` | Matchups: tu equipo (Pokepaste, código) y por rival sus 6, arquetipo (`P.archetypeOf`), Pokepaste, código, Plan A / Plan B (2 leads + 2 atrás) y «A tener en cuenta», con tu récord (partidas con ≥ 4 de sus Pokémon) y «Plan de tus victorias». Se guarda en `matchups` por equipo; «Llevar al documento» (`Doc.putMatchups`) pone la guía en el documento |
| `renderer/pc.js`, `optimizer.js`, `doc.js`, `play.js`, `sessions.js` | Mi PC (una caja por cada equipo tuyo, puesta al día al abrir: `auto` = equipo|especie, `abox` = caja puesta sola), Optimizador SP, Documento (índice a la izquierda; hojas con `title`: Resumen, una por Pokémon con sus cálculos de Mi PC —si no caben, más hojas con el Pokémon pequeño—, guía de matchups de 3 en 3, replays, otros cálculos; nada inventado: lo automático solo con «Auto-build» (`generate(team, true)`); en cada caja «+ Cálculo» y «+ Replay» (`calcPicker`, `repPicker`, `putLines`); lo de Matchups lleva `mu: true` y `Doc.putMatchups` lo rehace), Jugar (notas, sonido, buscar partida, aviso de versión), Sesiones (abrir, guardar) |
| `renderer/undo.js` | Deshacer (Ctrl+Z o «Deshacer» del aviso): copia de `pc` o `equipos` antes de borrar o cambiar algo en Mi PC y el Teambuilder (`Undo.snap`) |
| `renderer/tour.js` | Tutorial: recorrido paso a paso que resalta cada parte. Se abre con `data-tourstart` (inicio y Ajustes) |
| `renderer/notehl.js` | Notas con la marca de turno `[T5] …:` en amarillo (capa detrás del textarea) en Jugar y en el visor |
| `renderer/transcript.js` | Transcripción de una partida desde su registro (también en Node para los tests) |
| `renderer/replay.js` | Visor de replays: la partida guardada en el reproductor oficial de Showdown (`msreplay://r/<id>`, webview en `persist:replay`, sin subirla), con sonido apagado al empezar; debajo del combate la transcripción y debajo las notas (marcas `[T5]` que saltan a ese turno); a la derecha la hoja de equipo por leads, reserva y no salieron (`P.sheetCard` con `abbr`). «Calculadora de este turno»: `CalcReplay` (calc.js, `cfg.source` = `Viewer.battle()`) se mueve de `#rvCalcHold` al visor y sigue el turno |
| `renderer/i18n.js` | Idiomas: la interfaz se escribe en español; en inglés se traduce lo que se ve (diccionario de frases, frases con números `#` y trozos seguros). Textos nuevos: añadir su traducción aquí |
| `renderer/items-data.js` | Objetos de Champions (nombre EN/ES, descripción EN/ES, grupo, icono), sacados de la Macar Dex |
| `renderer/index.html`, `style.css` | Marcado y estilos |

## Reglas que no se pueden romper
- Daño: siempre `@smogon/calc` 0.12.0, generación 0 = Champions, nivel 50. Nunca una fórmula propia de daño. El motor no cuenta la Sitrus Berry en los KO: `sitrusKO` (poke.js) lo rehace con sus tiradas.
- Stats nivel 50: PS = base + 75 + SP; resto = ⌊(base + 20 + SP) × naturaleza⌋. 66 SP en total, 32 como máximo por stat. En los textos de Showdown los SP van en la línea `EVs:`.
- El motor de daño de Champions solo trae una habilidad por Pokémon: las posibles salen de la Macar Dex (`data.js`, `P.abilitiesOf`), y la más usada de sus sets (`P.topAbility`).
- Muchos movimientos de estado vienen sin categoría (o ni vienen) en los datos del motor: usar siempre `P.moveOf()`, que los completa (y su prioridad).
- Con su megapiedra, el Pokémon se calcula en forma Mega con la habilidad de la Mega (`P.megaOf`).
- Datos del usuario en la carpeta de datos (por defecto `%APPDATA%\Macar Showdown\datos`, o la de OneDrive que elija): formatos compatibles siempre.
- Los webviews solo pueden ser Showdown (`persist:showdown`, solo en la ventana principal; en la otra ventana `#sd` se cambia por un div), el visor de replays (`msreplay://` en `persist:replay`, que carga el reproductor de play.pokemonshowdown.com) o la Macar Dex (`persist:dex`, solo https://macar218.github.io/macar-dex/; la sección la abre en su versión incrustable `?embed=1`: Dex, Items, Abilities, Moves, Type chart y Natures, sin quiz, Speed, Calc ni Teams); la página de la app no navega a ningún sitio; CSP sin scripts externos.
- Replays: solo de combates del usuario y si `autoReplay` está activado. No se graba vídeo (se quitó en la 0.7 a petición del usuario). Showdown y las replays arrancan silenciados.
- Aspecto: estilo propio de la Macar Dex (tiras de datos, tablas y barras). Nada de copiar el aspecto de Flinched (tarjetas grandes con el nombre de fondo, escenarios…). Sprites fijos de Showdown (`gen5`), nunca animados.
- Estilos nuevos: comprobar que el nombre de clase no existe ya en `style.css` (en la 0.7 chocaron `.dres`, `.mrow`, `.dbar` y `.dteam`).
- El tamaño de Showdown solo lo cambia el usuario (− / + de Jugar, Ctrl + / − / 0; sin Ctrl + rueda, porque el evento 'zoom-changed' entraba en bucle; se recuerda en `msSdZoom`). Nunca ajustarlo solo: en la 0.11.0 la ampliación automática al empezar el combate, en monitores grandes, dejó a la app sin leer el combate (ni captura, ni notas, ni calculadora). Las lecturas de Showdown van con límite de tiempo (`capture.run`). Las pruebas de interfaz usan una ventana pequeña: lo que dependa del tamaño de pantalla hay que probarlo también con la ventana grande.
- Showdown puede abrir su cliente nuevo: nunca leer `window.app` directamente, siempre `SDAPP` (src/sdapp.js). En la 0.11.3 la app no capturaba nada con el cliente nuevo.
- Documento: no inventar texto, cálculos ni replays. Lo que no ponga el usuario queda en blanco (`fill`); lo automático va solo con «Auto-build».
- Otra ventana: nunca leer Showdown ni capturar desde ella; las pantallas se pintan cuando ya están cargados todos los archivos (`window` 'load').
- Ninguna ventana (`#modal`, visor de replays) se cierra con un clic fuera ni con Esc: solo con sus botones (Cerrar, ← Atrás, Guardar, Quitar). Toda ventana nueva necesita su botón Cerrar (`#mClose`).
- Nada de `prompt()` (Electron no lo tiene): formularios propios. `confirm()` sí funciona (y se traduce).
- Idioma: cada texto nuevo de la interfaz necesita su traducción en `renderer/i18n.js`. No traducir trozos de una sola palabra corriente (cambiarían nombres puestos por el usuario).

## Probar
```
npm install            # con npm 11 puede no bajar Electron: node node_modules/electron/install.js
npm test               # 25 pruebas: lector, transcripción, Sitrus Berry, hoja de equipo, notas, marcas, Macar Dex (y habilidades), guardado, estadísticas, Dashboard, sesiones, torneos, motor, sintaxis de la interfaz
npm start
```
Pruebas de interfaz sin tocar datos reales: `MACAR_PERFIL=<carpeta>` (perfil de Electron aparte: sin tu sesión de Showdown ni tus extensiones), `MACAR_DATOS=<carpeta>` (datos), `MACAR_PDF=<archivo>` (PDF sin diálogo), `MACAR_CAPTURAS=<carpeta>` + `MACAR_PASOS=<pasos.json>` (guion `[{js, wait, shot, size}]`, `size` = [ancho, alto] de la ventana que guarda capturas y `consola.txt`; la app arranca en la pantalla de inicio: `Start.hide()` para saltarla). Para probar en directo sin jugar: en un paso, `app.send('/cmd roomlist gen9championsvgc2026regmc')` desde el webview y `app.joinRoom(id)` de un combate público (solo mirar; salir con `app.leaveRoom`). `MACAR_UNAPANTALLA=1` hace como si hubiera un solo monitor (para probar «Otra ventana» al lado). La otra ventana se prueba en la misma con `location.href = location.pathname + '?w=2&view=pc'`.

## Pendiente / ideas
- Probar con un combate jugado por el usuario: subida de replay al terminar.
- Sin ver por el usuario: «Otra ventana» en su segundo monitor y en el portátil/Surface (pantalla dividida, menú solo con iconos por debajo de 1100 px).
- Sin probar contra el servicio real: «Crear Pokepaste» (POST a pokepast.es/create; los campos del formulario se comprobaron).
- La primera actualización automática real se verá al publicar la 0.4.1 o posterior.
- Sin probar con la cuenta del usuario: «Buscar partida (Reg M-C)» (usa `/utm` + `/search`) y añadir una extensión real desde la Chrome Web Store.
- Fuera a propósito (no son utilidades): mascota, sonidos, cuenta y plan de pago, modo del juego real (OCR). El tutorial sí está (0.12, a petición del usuario).
