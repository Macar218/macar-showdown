# Macar Showdown — notas para Claude Code

Dueño: Arturo (Macar). Háblale en español de España: frases cortas, al grano, una recomendación cuando pide decidir, honesto, sin halagos. La app sale en inglés por defecto (Arturo juega Showdown en inglés); se puede pasar a español en Settings. El código y los textos fuente están en español y `renderer/i18n.js` los traduce. Los nombres de Pokémon, movimientos, objetos y habilidades, siempre en inglés.

## Qué es
App de escritorio para Windows (Electron) para jugar Pokémon Champions VGC (Reg M-C, nivel 50) en Pokémon Showdown y prepararse: pantalla de inicio con sesiones por equipo, Showdown dentro de la app, captura automática de partidas, Dashboard (Resumen, Partidas, Rivales, Tu equipo, Hábitos), Tu equipo, calculadora con Multicalc, Teambuilder, Mi PC, Optimizador SP y documento de preparación (prep doc). Los equipos de torneo (top teams) no se enseñan aquí: eso va en la Macar Dex; los datos de torneo solo sirven para los sets del rival en la calculadora. Uso personal. Inspirada en las funciones de la app Flinched (instalada en `C:\Program Files\Flinched`), pero con código propio y el estilo de la Macar Dex: nunca copiar su código, imágenes ni textos.

Repositorio: `Macar218/macar-showdown` (público). Cada push a `main` compila el instalador en GitHub Actions y publica la versión `v<package.json version>` con `Macar-Showdown-Setup-x.y.z.exe`, `.blockmap` y `latest.yml`. Las apps instaladas se actualizan solas (electron-updater) desde la 0.4.0. Para que una versión llegue a los usuarios hay que subir la versión en `package.json` (y `package-lock.json`).

## Archivos
| Archivo | Qué |
|---|---|
| `main.js` | Proceso principal: ventana, webview de Showdown, IPC, carpeta de datos (OneDrive), PDF, replays (protocolo `msreplay://`), Pokepaste, torneos, actualización. Modo pruebas con variables `MACAR_*` |
| `preload.js` | Puente seguro (`window.macar`). Nada de Node en la página |
| `src/parser.js` | Lector de registros de Showdown → resumen de partida |
| `src/store.js` | Guardado: una partida por archivo + colecciones (`equipos`, `pc`, `docs`, `partidaTeam`, `liveNotes`, `sesiones`, `bo3Notes`) y ajustes (`sessionId` = sesión abierta) |
| `src/capture.js` | Captura: guarda cada combate al terminar |
| `src/live.js` | Lee el combate abierto para la calculadora en directo |
| `src/media.js` | Combate actual (notas y grabación) y subida de replays (`/savereplay`) |
| `src/usage.js` | Sets más usados de Smogon (chaos, 1760+), en caché en `<datos>/uso` |
| `src/extensions.js` | Extensiones de Chrome para la sesión de Showdown (Chrome Web Store, .crx/.zip, carpeta), en `<userData>/extensiones` |
| `src/tournaments.js` | Torneos online de Limitless (API pública, M-C, 30 días, ≥16 jugadores): sets de torneo y equipos del top 8, en `<datos>/torneos.json` |
| `renderer/app.js` | Navegación, filtros (`F`) y qué partidas cuentan (sesión, equipo o todas), panel de partida (notas y notas finales), importar, Ajustes |
| `renderer/dash.js` | Dashboard: Resumen, Partidas, Rivales, Tu equipo y Hábitos con los mismos filtros |
| `renderer/start.js` | Pantalla de inicio: cargar una sesión de un equipo o crear una nueva (equipo existente o Pokepaste) |
| `renderer/myteam.js` | Tu equipo: ficha de cada Pokémon del equipo de la sesión, usuario de Showdown, Pokepaste, cambiarlo |
| `renderer/stats.js` | Estadísticas (también en Node para los tests) |
| `renderer/poke.js` | Piezas comunes: datos del motor, sets Showdown, daño/velocidad, editor de Pokémon, selector de movimientos (`movePanel`) y de objetos (`itemPanel`), datos de uso y de torneo, Team Box, Mi PC |
| `renderer/calc.js` / `multicalc.js` | Calculadora (cajón en Jugar y página propia), pestañas Daño (estilo calculadora de Showdown, edición en el sitio), Multicalc y Árbol (`Multi.renderTree`) |
| `renderer/team.js` | Teambuilder: pestañas de los 6 y editor en la página (puntos estilo Showdown primero; el editor completo en «Más opciones») |
| `renderer/pc.js`, `optimizer.js`, `doc.js`, `play.js`, `sessions.js` | Mi PC, Optimizador SP, Documento, Jugar (notas, sonido, buscar partida, aviso de versión), Sesiones (abrir, guardar) |
| `renderer/replay.js` | Visor de replays: la partida guardada en el reproductor oficial de Showdown (`msreplay://r/<id>`, webview en `persist:replay`, sin subirla), con sonido apagado al empezar, leads/reserva y notas con marcas `[T5]` que saltan a ese turno |
| `renderer/i18n.js` | Idiomas: la interfaz se escribe en español; en inglés se traduce lo que se ve (diccionario de frases, frases con números `#` y trozos seguros). Textos nuevos: añadir su traducción aquí |
| `renderer/items-data.js` | Objetos de Champions (nombre EN/ES, descripción EN/ES, grupo, icono), sacados de la Macar Dex |
| `renderer/index.html`, `style.css` | Marcado y estilos |

## Reglas que no se pueden romper
- Daño: siempre `@smogon/calc` 0.12.0, generación 0 = Champions, nivel 50. Nunca una fórmula propia de daño.
- Stats nivel 50: PS = base + 75 + SP; resto = ⌊(base + 20 + SP) × naturaleza⌋. 66 SP en total, 32 como máximo por stat. En los textos de Showdown los SP van en la línea `EVs:`.
- Muchos movimientos de estado vienen sin categoría (o ni vienen) en los datos del motor: usar siempre `P.moveOf()`, que los completa (y su prioridad).
- Con su megapiedra, el Pokémon se calcula en forma Mega con la habilidad de la Mega (`P.megaOf`).
- Datos del usuario en la carpeta de datos (por defecto `%APPDATA%\Macar Showdown\datos`, o la de OneDrive que elija): formatos compatibles siempre.
- Los webviews solo pueden ser Showdown (`persist:showdown`) o el visor de replays (`msreplay://` en `persist:replay`, que carga el reproductor de play.pokemonshowdown.com); la página de la app no navega a ningún sitio; CSP sin scripts externos.
- Replays: solo de combates del usuario y si `autoReplay` está activado. No se graba vídeo (se quitó en la 0.7 a petición del usuario). Showdown y las replays arrancan silenciados.
- Aspecto: estilo propio de la Macar Dex (tiras de datos, tablas y barras). Nada de copiar el aspecto de Flinched (tarjetas grandes con el nombre de fondo, escenarios…). Sprites fijos de Showdown (`gen5`), nunca animados.
- Estilos nuevos: comprobar que el nombre de clase no existe ya en `style.css` (en la 0.7 chocaron `.dres`, `.mrow`, `.dbar` y `.dteam`).
- Nada de `prompt()` (Electron no lo tiene): formularios propios. `confirm()` sí funciona (y se traduce).
- Idioma: cada texto nuevo de la interfaz necesita su traducción en `renderer/i18n.js`. No traducir trozos de una sola palabra corriente (cambiarían nombres puestos por el usuario).

## Probar
```
npm install            # con npm 11 puede no bajar Electron: node node_modules/electron/install.js
npm test               # 18 pruebas: lector, guardado, estadísticas, Dashboard, sesiones, torneos, motor, sintaxis de la interfaz
npm start
```
Pruebas de interfaz sin tocar datos reales: `MACAR_PERFIL=<carpeta>` (perfil de Electron aparte: sin tu sesión de Showdown ni tus extensiones), `MACAR_DATOS=<carpeta>` (datos), `MACAR_PDF=<archivo>` (PDF sin diálogo), `MACAR_CAPTURAS=<carpeta>` + `MACAR_PASOS=<pasos.json>` (guion `[{js, wait, shot}]` que guarda capturas y `consola.txt`; la app arranca en la pantalla de inicio: `Start.hide()` para saltarla). Para probar en directo sin jugar: en un paso, `app.send('/cmd roomlist gen9championsvgc2026regmc')` desde el webview y `app.joinRoom(id)` de un combate público (solo mirar; salir con `app.leaveRoom`).

## Pendiente / ideas
- Probar con un combate jugado por el usuario: subida de replay al terminar.
- Sin probar contra el servicio real: «Crear Pokepaste» (POST a pokepast.es/create; los campos del formulario se comprobaron).
- La primera actualización automática real se verá al publicar la 0.4.1 o posterior.
- Sin probar con la cuenta del usuario: «Buscar partida (Reg M-C)» (usa `/utm` + `/search`) y añadir una extensión real desde la Chrome Web Store.
- Fuera a propósito (no son utilidades): mascota y tour, sonidos, idiomas, cuenta y plan de pago, modo del juego real (OCR).
