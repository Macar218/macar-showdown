# Macar Showdown

App de escritorio para Windows: juegas en Pokémon Showdown desde dentro y cada combate se guarda solo al terminar, con un Dashboard de estadísticas. Mismo estilo que la Macar Dex.

## Instalar

1. Ve a **Releases** en este repositorio y descarga `Macar Showdown Setup x.y.z.exe`.
2. Ábrelo. Windows avisará de "editor desconocido" porque el instalador no está firmado: pulsa **Más información → Ejecutar de todas formas**.

Cada cambio en `main` también genera el instalador en **Actions** (artefacto `macar-showdown-instalador`).

## Qué hace (versión 0.1)

- **Jugar**: Pokémon Showdown dentro de la app, con tu sesión guardada.
- **Captura automática**: al acabar cada combate guarda el registro completo. Si después llega el cambio de ELO, se actualiza.
- **Dashboard**: récord, % de victorias, ELO, turnos, apuros de tiempo, tus Pokémon y leads, rivales y leads rivales, Megas rivales. Filtros por resultado, fechas, formato, tu lead y rival.
- **Partidas**: lista con detalle de cada combate (equipos, leads, Megas, movimientos, reloj) y notas.
- **Importar replays**: archivos `.html` descargados de Showdown o enlaces de `replay.pokemonshowdown.com`. No se duplican.

Todo se guarda solo en tu ordenador, un archivo por partida, en `%APPDATA%\Macar Showdown\datos`.

## Limitaciones conocidas

- De tu equipo solo se ven los Pokémon que salieron al combate (igual que en un replay).
- Iniciar sesión en Showdown con Google abre una ventana externa y puede no funcionar; usa usuario y contraseña de Showdown.
- La captura depende de cómo funciona por dentro el cliente de Showdown. Si cambian algo, puede dejar de guardar: el estado aparece abajo a la izquierda y en Ajustes.

## Desarrollo

```
npm install
npm start      # abrir la app
npm test       # pruebas del lector, guardado y estadísticas
npm run dist   # crear el instalador en dist/
```

Estructura: `main.js` (proceso principal), `preload.js` (puente seguro), `src/parser.js` (lector de partidas), `src/store.js` (guardado), `src/capture.js` (captura), `renderer/` (interfaz).
