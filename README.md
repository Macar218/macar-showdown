# Macar Showdown

App de escritorio para Windows: juegas en Pokémon Showdown desde dentro y cada combate se guarda solo al terminar, con un Dashboard de estadísticas. Mismo estilo que la Macar Dex.

## Instalar

1. Ve a **Releases** en este repositorio y descarga `Macar-Showdown-Setup-x.y.z.exe` (solo la primera vez: después se actualiza sola).
2. Ábrelo. Windows avisará de "editor desconocido" porque el instalador no está firmado: pulsa **Más información → Ejecutar de todas formas**.

Cada cambio en `main` también genera el instalador en **Actions** (artefacto `macar-showdown-instalador`).

## Qué hace (versión 0.6)

- **Español e inglés**: toda la app en los dos idiomas (Ajustes → Idioma). Lo que escribes tú (notas, documento) no se toca; el documento se monta en el idioma elegido.

- **Jugar**: Pokémon Showdown dentro de la app, con tu sesión guardada. La **calculadora es un cajón** que sale y se esconde por la derecha (pestaña «Calculadora» o Ctrl+K) y abajo tienes las **notas de la partida**, que se guardan con ella.
- **Sesiones**: cada preparación (un Regional, una subida en el ladder…) es una sesión con nombre, objetivo y equipo. Las partidas se apuntan en la sesión abierta y el Dashboard enseña por defecto las suyas, con el objetivo y el récord de la sesión. Se cambia desde arriba a la izquierda.
- **Buscar partida y llevar tu equipo**: en Jugar, «Llevar mi equipo a Showdown» lo deja en la carpeta «Macar Showdown» de su teambuilder y «Buscar partida (Reg M-C)» busca en el ladder con él.
- **Extensiones de Chrome** dentro de Showdown (por ejemplo, Showdex): desde la Chrome Web Store, un .crx/.zip o una carpeta (Ajustes).
- **Replays y vídeo**: al acabar cada combate tuyo se sube la replay a Showdown y queda enlazada en la partida; cada combate se graba en vídeo (solo Showdown, sin la calculadora) en tu carpeta de Vídeos y se ve desde la partida. Las dos cosas se apagan en Ajustes. Sigue el combate abierto: tus Pokémon con sus estadísticas exactas, lo que se ve del rival (PS, objeto, habilidad, movimientos, niveles de stats), clima, campo, pantallas y Viento Afín.
- **Captura automática**: al acabar cada combate guarda el registro completo. Si después llega el cambio de ELO, se actualiza.
- **Calculadora**: motor de Smogon (`@smogon/calc`, formato Champions a nivel 50 con SP). Tus ataques contra los dos rivales del campo y los suyos contra los tuyos, KOs, velocidad. Al rival le pone su set de tu Team Box o, si no, el **set de torneo** (lo más llevado en los torneos online de Limitless de los últimos 30 días, con los puntos de Smogon) o el más usado en Smogon.
- **Calculadora (más)**: elegir Pokémon en una rejilla (más llevados en torneos, Mi PC o todos), «Cómo sale el daño» con las 16 tiradas al pulsar una celda, y ficha de cada Pokémon / Pokédex (stats, tipos contra él, velocidades, lo que lleva en torneos y en Smogon).
- **Elegir objeto**: en el editor, «Elegir» abre los objetos con buscador, más usados para ese Pokémon (torneos y Smogon), por grupo, bayas de resistencia y por tipo, con icono y descripción (español e inglés).
- **Multicalc**: los cuatro del campo eligen jugada y se juega el turno (prioridad, velocidad, Espacio Raro, Viento Afín, Protección, Fake Out, ataques en área, clima por habilidad). Siguiente turno con los PS que quedan. «Todas las opciones (tabla)»: todas tus jugadas contra todas las suyas, con peor y mejor caso. «Todas las opciones, turno a turno»: árbol con tus mejores jugadas, las respuestas del rival que más te duelen y «Y luego» (el turno siguiente desde lo que deja esa rama); «Usarlo este turno» lo pone en la Multicalc.
- **Teambuilder**: tus equipos, el tuyo marcado como «mi equipo», editor de cada Pokémon (SP, naturaleza, movimientos, sets más usados), análisis de debilidades, cobertura, velocidades y revisión (control de velocidad, redirección, Fake Out, objetos repetidos). Importar desde texto o Pokepaste y enviar a tu teambuilder de Showdown.
- **Mi PC**: tus sets por cajas, con notas, filtros y búsqueda, el Team Box con todos los equipos (tuyos y de rivales) y los **equipos de torneo** (top 8 de los torneos online recientes), listos para cargar como rival o usarlos tú.
- **Optimizador SP**: el mejor reparto de puntos y naturaleza para un Pokémon de tu equipo contra los más llevados en torneos, los más usados en Smogon o tus equipos rivales (velocidad, aguante y KOs; en «Equilibrado» nunca a costa de hacer menos daño), con comparativa y detalle por rival. «Optimizar todo el equipo» da los seis repartos y el equipo listo para exportar.
- **Dashboard**: récord, ELO y GXE del ladder, racha, MVP (con él / sin él), tu resumen en frases, abriendo o desde atrás, parejas, contra quién brilla o sufre cada uno, rivales, cómo te abren y tus leads contra eso, sus movimientos, hora y día, cortas o largas, tras ganar / tras perder, sesiones, Bo3 y últimas partidas. Filtros por resultado, fechas (también a mano), equipo, formato, lead y rival.
- **Documento de preparación**: hojas A4 con la estructura de un prep doc de VGC: tu equipo, historia y concepto, sets y cálculos clave de cada Pokémon y guía de matchups (récord, con qué ganas, claves, replays ganadas y perdidas). Se edita escribiendo en la hoja: texto, cajas, ideas clave, listas, tablas (filas, columnas y anchos), imágenes (pegar, alinear y tamaño), sprites de Pokémon (en la línea del texto o en fila), cálculos y páginas; zoom, estilo oscuro o clásico y **PDF**.
- **Actualización automática**: busca versiones nuevas en GitHub, las descarga sola y se instalan al cerrar la app (o al pulsar «Reiniciar ahora»).
- **Partidas**: lista con buscador y filtro por sesión; los Bo3 se agrupan (G1, G2, G3) con sus rondas (tus leads y los suyos, reservas, megas), notas de cada ronda y conclusiones del set; hoja de equipo del rival cuando el combate la trae (y cargarla como rival); descargar la replay en .html; el equipo que usaste se detecta solo. Importar varias replays a la vez (un enlace por línea).
- **Importar replays**: archivos `.html` descargados de Showdown o enlaces de `replay.pokemonshowdown.com`. No se duplican.

### Tus datos en todos tus ordenadores

Todo vive en una carpeta: partidas (un archivo cada una), equipos, Mi PC, documentos y ajustes. En **Ajustes → Usar OneDrive** se mueve a `OneDrive\Macar Showdown`; haz lo mismo en cada ordenador donde juegues y verás lo mismo en todos. Al volver a la ventana de la app se leen los cambios del otro ordenador. Por defecto está en `%APPDATA%\Macar Showdown\datos`.

## Limitaciones conocidas

- De tu equipo solo se ven los Pokémon que salieron al combate (igual que en un replay).
- Iniciar sesión en Showdown con Google abre una ventana externa y puede no funcionar; usa usuario y contraseña de Showdown.
- La captura depende de cómo funciona por dentro el cliente de Showdown. Si cambian algo, puede dejar de guardar: el estado aparece abajo a la izquierda y en Ajustes.

## Desarrollo

```
npm install
npm start      # abrir la app
npm test       # pruebas del lector, guardado, estadísticas y motor
npm run dist   # crear el instalador en dist/
```

Estructura: `main.js` (proceso principal), `preload.js` (puente seguro), `src/parser.js` (lector de partidas), `src/store.js` (guardado y colecciones), `src/capture.js` (captura), `src/live.js` (combate en directo), `src/usage.js` (sets más usados de Smogon), `renderer/` (interfaz: `poke.js` piezas comunes, `calc.js` y `multicalc.js`, `team.js`, `pc.js`, `optimizer.js`, `doc.js`).

Pruebas de la interfaz sin tocar tus datos: `MACAR_DATOS=<carpeta>` usa otra carpeta de datos, `MACAR_CAPTURAS=<carpeta>` y `MACAR_PASOS=<pasos.json>` recorren pantallas y guardan capturas, `MACAR_PDF=<archivo>` guarda el PDF sin preguntar. Solo funcionan en desarrollo.
