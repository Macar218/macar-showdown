# Macar Showdown — notas para Claude Code

Dueño: Arturo (Macar). Háblale en español de España: frases cortas, al grano, una recomendación cuando pide decidir, honesto, sin halagos. La app está en español; los nombres de Pokémon, movimientos, objetos y habilidades, en inglés (como en Showdown).

## Qué es
App de escritorio para Windows (Electron) para jugar Pokémon Champions VGC (Reg M-C, nivel 50) en Pokémon Showdown y prepararse: Showdown dentro de la app, captura automática de partidas, Dashboard, calculadora con Multicalc, Teambuilder, Mi PC, Optimizador SP y documento de preparación (prep doc). Uso personal. Inspirada en las funciones de la app Flinched (instalada en `C:\Program Files\Flinched`), pero con código propio y el estilo de la Macar Dex: nunca copiar su código, imágenes ni textos.

Repositorio: `Macar218/macar-showdown` (público). Cada push a `main` compila el instalador en GitHub Actions y publica la versión `v<package.json version>` con `Macar-Showdown-Setup-x.y.z.exe`, `.blockmap` y `latest.yml`. Las apps instaladas se actualizan solas (electron-updater) desde la 0.4.0. Para que una versión llegue a los usuarios hay que subir la versión en `package.json` (y `package-lock.json`).

## Archivos
| Archivo | Qué |
|---|---|
| `main.js` | Proceso principal: ventana, webview de Showdown, IPC, carpeta de datos (OneDrive), PDF, vídeo (protocolo `msvideo://`), replays, torneos, actualización. Modo pruebas con variables `MACAR_*` |
| `preload.js` | Puente seguro (`window.macar`). Nada de Node en la página |
| `src/parser.js` | Lector de registros de Showdown → resumen de partida |
| `src/store.js` | Guardado: una partida por archivo + colecciones (`equipos`, `pc`, `docs`, `partidaTeam`, `liveNotes`) y ajustes |
| `src/capture.js` | Captura: guarda cada combate al terminar |
| `src/live.js` | Lee el combate abierto para la calculadora en directo |
| `src/media.js` | Combate actual (notas y grabación) y subida de replays (`/savereplay`) |
| `src/usage.js` | Sets más usados de Smogon (chaos, 1760+), en caché en `<datos>/uso` |
| `src/tournaments.js` | Torneos online de Limitless (API pública, M-C, 30 días, ≥16 jugadores): sets de torneo y equipos del top 8, en `<datos>/torneos.json` |
| `renderer/app.js` | Navegación, Dashboard, Partidas, Ajustes |
| `renderer/stats.js` | Estadísticas (también en Node para los tests) |
| `renderer/poke.js` | Piezas comunes: datos del motor, sets Showdown, daño/velocidad, editor de Pokémon, datos de uso y de torneo, Team Box, Mi PC |
| `renderer/calc.js` / `multicalc.js` | Calculadora (cajón en Jugar y página propia) y Multicalc |
| `renderer/team.js`, `pc.js`, `optimizer.js`, `doc.js`, `play.js` | Teambuilder, Mi PC, Optimizador SP, Documento, Jugar (notas, grabación, aviso de versión) |
| `renderer/index.html`, `style.css` | Marcado y estilos |

## Reglas que no se pueden romper
- Daño: siempre `@smogon/calc` 0.12.0, generación 0 = Champions, nivel 50. Nunca una fórmula propia de daño.
- Stats nivel 50: PS = base + 75 + SP; resto = ⌊(base + 20 + SP) × naturaleza⌋. 66 SP en total, 32 como máximo por stat. En los textos de Showdown los SP van en la línea `EVs:`.
- Muchos movimientos de estado vienen sin categoría (o ni vienen) en los datos del motor: usar siempre `P.moveOf()`, que los completa (y su prioridad).
- Con su megapiedra, el Pokémon se calcula en forma Mega con la habilidad de la Mega (`P.megaOf`).
- Datos del usuario en la carpeta de datos (por defecto `%APPDATA%\Macar Showdown\datos`, o la de OneDrive que elija): formatos compatibles siempre. Los ajustes de este ordenador (carpeta de vídeos) van en `local.json` de `userData`, no en la carpeta de datos.
- El webview solo puede ser Showdown; la página de la app no navega a ningún sitio; CSP sin scripts externos.
- Replays: solo de combates del usuario y si `autoReplay` está activado. Vídeo: solo el webview de Showdown, solo si `recordVideo` está activado.
- Nada de `prompt()` (Electron no lo tiene): formularios propios. `confirm()` sí funciona.

## Probar
```
npm install            # con npm 11 puede no bajar Electron: node node_modules/electron/install.js
npm test               # 12 pruebas: lector, guardado, estadísticas, torneos, motor
npm start
```
Pruebas de interfaz sin tocar datos reales: `MACAR_DATOS=<carpeta>` (datos), `MACAR_VIDEOS=<carpeta>`, `MACAR_PDF=<archivo>` (PDF sin diálogo), `MACAR_CAPTURAS=<carpeta>` + `MACAR_PASOS=<pasos.json>` (guion `[{js, wait, shot}]` que guarda capturas y `consola.txt`). Para probar en directo sin jugar: en un paso, `app.send('/cmd roomlist gen9championsvgc2026regmc')` desde el webview y `app.joinRoom(id)` de un combate público (solo mirar; salir con `app.leaveRoom`).

## Pendiente / ideas
- Probar con un combate jugado por el usuario: subida de replay y vídeo al terminar.
- La primera actualización automática real se verá al publicar la 0.4.1 o posterior.
- Posibles mejoras: Bo3 agrupado (G1/G2/G3) en Partidas con notas por ronda; "Objetivo de la sesión" en el Dashboard; vista de equipos de torneo también en el Teambuilder.
