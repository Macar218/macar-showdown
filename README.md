# Macar Showdown

App de escritorio para Windows: juegas en Pokémon Showdown desde dentro y cada combate se guarda solo al terminar, con un Dashboard de estadísticas. Mismo estilo que la Macar Dex.

## Instalar

1. Ve a **Releases** en este repositorio y descarga `Macar-Showdown-Setup-x.y.z.exe` (solo la primera vez: después se actualiza sola).
2. Ábrelo. Windows avisará de "editor desconocido" porque el instalador no está firmado: pulsa **Más información → Ejecutar de todas formas**.

Cada cambio en `main` también genera el instalador en **Actions** (artefacto `macar-showdown-instalador`).

## Qué hace (versión 0.11)

- **Dos calculadoras independientes**: la de **Jugar** sigue el combate (tus Pokémon con sus stats reales y la naturaleza de tu equipo; los del rival con su **hoja de equipo (OTS)**: objeto, habilidad, naturaleza y movimientos, y el reparto más común con esa naturaleza) y se vacía al acabar. La página **Calculadora** es para estudiar: tus equipos, Mi PC, el Teambuilder y los **rivales de tus partidas** («De una partida»). Arena con el rival arriba y tú abajo, cada lado en su franja; editar cada Pokémon también desde la Multicalc y «← Daño» para volver.
- **Visor de replays**: sin hueco entre la partida y los turnos; **hoja de equipo** del rival a la vista (pestaña para ver la tuya); la transcripción se pone sola en el turno que ves; en las notas, la marca del turno en amarillo y lo tuyo en blanco.
- **Jugar**: notas más grandes y «+ Nota del turno».
- **0.15.0**: Dashboard con las 6 cajas grandes (3 + 3, el % de victorias primero; fuera OTS) y partidas por columnas, con tu equipo y el del rival enteros uno encima del otro (raya amarilla: lead; azul: salió detrás). Visor de replays: combate, transcripción debajo y notas debajo; a la derecha leads, reserva y la hoja de equipo pequeña (3 + 3, ataques solo con su color). Hoja rival más clara en la partida y «Equipo a Mi PC (Team Box)». Teambuilder: «Set a Mi PC» con solo ese Pokémon. Matchups: «⤢ Abrir» lo enseña en grande. Mi PC: una caja por cada equipo tuyo. Calculadora más compacta (arena pequeña, nombres grandes, campo ordenado y arena y ataques fijos arriba al bajar a los puntos); en el editor, lo que lleva el set sale en verde y se quita pulsándolo. Documento con índice a la izquierda: resumen, una hoja por Pokémon, guía de matchups, replays por matchup y cálculos de supervivencia.
- **0.14.0**: calculadora nueva, al estilo de la de Showdown: tus Pokémon y los del rival en filas de 6 con × para quitarlos, arena con la velocidad debajo y los ataques al lado, el cálculo en una línea entera y debajo tu Pokémon, el campo y el rival; puntos y niveles con flechas y aviso si sobran o faltan puntos; al cambiar un ataque, el de ahora fijo arriba con lo que hace; «→ Mi PC» con nombre y «Cálculo a Mi PC» para cada Pokémon. Editor que no se cierra solo y ataques que se quitan con × y se añaden en el primer hueco. Partidas: «Por analizar» (amarillo) pasa a «Analizada» (verde) y las partidas con notas llevan «✎ Notas».
- **0.13.0**: pantalla Matchups (tu plan contra cada equipo: sus 6 y arquetipo, Pokepaste y código, Plan A / Plan B y «A tener en cuenta», con tu récord y el plan de tus victorias) que se lleva al documento; arquetipo en la guía de matchups; calculadora del combate con ancho libre; nota del turno a la izquierda; descripción de los ataques en Tu equipo.
- **0.12.0**: notas de combate con el botón «+ Nota del turno» dentro del cuadro; calculadora del cajón más ancha («Más ancha») y cada equipo en una fila de 6 con nombre y PS; hoja de equipo del visor en fichas claras; al acabar un Bo3, aviso para marcar cada partida (buena, indiferente, mala, para analizar) y filtro «Marcas» en Partidas; todas las habilidades en el Teambuilder; × para borrar en Mi PC y Ctrl+Z para deshacer; calculadora de estudio con tu equipo o los Pokémon que tú elijas; tutorial de la app.
- **0.11.4**: la app funciona también con el cliente nuevo de Showdown: captura de partidas, notas, calculadora en directo, replay y «Mandar mi equipo».
- **0.11.3**: icono nuevo: una Poké Ball con «PS!» en el centro y las tres luces de la Pokédex.
- **0.11.2**: tamaño de Showdown a mano, como en el navegador: botones − / + en Jugar (pulsar el % lo vuelve al 100%) y Ctrl + / Ctrl − / Ctrl 0. Se recuerda.
- **0.11.1**: arreglada la captura en monitores grandes (la ampliación del combate dejaba a la app sin leer Showdown: se ha quitado) y cada lectura de Showdown tiene límite de tiempo.
- **Tu equipo**: sprites más grandes, objeto con su descripción, estadísticas en tabla (valor, barra, base y SP, ▲▼ de naturaleza) y ataques con el color de su tipo en el borde, sin marear.
- **Mi PC**: se ve grande en monitores grandes; doble clic en el nombre para cambiarlo; equipo nuevo con un clic y nunca dos veces el mismo Pokémon en un equipo; **sets de rivales** (desde la hoja de equipo de una partida, «→ Mi PC», sin reparto: se estima el más común); notas más grandes y **cálculos guardados** («Guardar en Mi PC» desde la Calculadora).
- **Teambuilder**: no deja repetir un Pokémon en el equipo.

- **Macar Dex dentro**: sección «Macar Dex» con tu web, y sus datos (sets de Smogon del mes, objeto y reparto más usados, movimientos con descripción y lo que aprende cada Pokémon) se bajan solos cada día. La Calculadora usa sus sets para el rival (por defecto) y el Teambuilder sus movimientos con descripción.
- **Sitrus Berry**: el motor no la cuenta en los KO; ahora sí (golpe a golpe con sus 16 tiradas), también en la Multicalc.
- **Transcripción de la replay**: debajo de la partida, turno a turno con sprites, movimiento, objetivo y qué pasa (daño en %, KO, subidas, crítico, eficacia, protección…). Pulsar un turno o una línea apunta una nota enlazada a ese momento.
- **Calculadora**: resultado siempre a la vista, página en tres columnas (tú · ataques y resultado · rival) y **arena** con los que están en el campo, también en la Multicalc.
- **Mi PC como caja de los juegos**, con los sets de tus sesiones guardados solos y añadir a un equipo o crear uno nuevo.
- **Dashboard**: porcentajes explicados («% de victorias · de cuántas partidas»), MVP más grande, buscar cualquier rival, y Tu equipo en fichas de 3 en 3.

- **Dashboard más visual**: filtros en una sola línea, tira de datos con anillo de victorias, OTS/CTS en barras y la línea del ELO. **Hábitos** en tarjetas con gráfico y una frase que lo explica: mejor hora, día de la semana, después de perder, sesiones largas, cortas o largas (7 turnos), Bo3, con él o sin él y movimientos que nunca usas. En Tu equipo, con quién funciona y contra quién brilla o sufre cada uno.
- **Teambuilder**: botones − y + en cada estadística (con Mayús, de 4 en 4), + / − de naturaleza y elegir movimiento como en Showdown (los más llevados por ese Pokémon y buscador con tipo, categoría y potencia). El análisis del equipo, plegado y más pequeño.
- **Calculadora**: los movimientos se cambian con el mismo selector.
- **Tu equipo**: puntos en barras y movimientos grandes con el color de su tipo.

- **Menú con aspecto de Pokédex**: carcasa azul, lente y luces, y las secciones en una pantalla numerada.
- **Calculadora estilo Showdown**: los 4 movimientos de cada lado con su %, el cálculo completo del elegido (texto de Showdown, KO y tiradas), los dos Pokémon editables ahí mismo (objeto, habilidad, naturaleza, estado, SP, niveles, PS y movimientos) y el campo con botones. Pestañas **Daño**, **Multicalc** y **Árbol** (tus mejores jugadas, sus respuestas y el turno siguiente).

- **Teambuilder estilo Showdown**: pestañas con tus 6 Pokémon y, debajo, el elegido: primero sus puntos (base, deslizador, número, estadística final, «Quedan X de 66» y + / − de naturaleza), luego objeto, habilidad y movimientos. Se guarda solo.

- **Inicio**: al abrir la app eliges **Cargar sesión** (las sesiones de cada uno de tus equipos) o **Nueva sesión**: con un equipo que ya tienes o con uno nuevo pegando su Pokepaste. La sesión nueva sale con un nombre editable («Sesión 20 Noviembre 2026 (equipo)») y un objetivo. Un equipo tiene sus sesiones: las estadísticas se ven por sesión o de todo el equipo.
- **Dashboard en cinco pestañas**, con los mismos filtros arriba (resultado, fechas, tu lead, tu reserva, rival con, lead rival, ELO mínimo) y la sesión, todo el equipo o todas tus partidas:
  - **Resumen**: % de victorias, OTS/CTS, racha, ELO y GXE, últimas partidas (abren su replay), tu MVP con sus movimientos, contra lo que más ganas y lo que más te cuesta, tus leads más jugados y los que mejor te funcionan, y los rivales que más te encuentras. Pulsar un Pokémon o un lead filtra todo el panel.
  - **Partidas**: por días, cada partida o Bo3 con resultado, leads, el equipo rival y G1/G2/G3 para ver su replay; al pulsarla, sus notas y unas notas finales. Bo3: sets ganados, G1, cierres, remontadas y sets incompletos. Importar replays y exportar CSV.
  - **Rivales**: los que más ves; de cada uno, cómo te va, con quién va, tus leads contra él, cómo abre con él, sus movimientos y las últimas partidas. Cómo te abren y cómo te va.
  - **Tu equipo**: cada Pokémon con cuánto lo llevas, cuánto abre, cómo te va con él, con mega y sus movimientos; tus parejas de leads.
  - **Hábitos**: lo que más te hace ganar y perder frente a tu media (hora, día, tras perder, sesiones largas, hojas abiertas, megaevolucionar, ELO del rival…); se ve claro a partir de 30 partidas.
- **Tu equipo**: una ficha por Pokémon (tipos, objeto, habilidad, naturaleza, puntos, estadísticas y movimientos), tu usuario de Showdown, copiarlo, crear su Pokepaste, llevarlo a Showdown, cambiarlo pegando otro Pokepaste y abrirlo en el Teambuilder.
- **Sin sonido al empezar**: Showdown y las replays arrancan silenciados; el botón del altavoz lo activa.
- **Sin vídeo**: ya no se graba nada; cada partida se ve en el visor de replays con su registro guardado.
- **Visor de replays**: «▶» en cada partida la abre dentro de la app con el reproductor de Showdown, aunque no la hayas subido. Turno a turno, velocidad, cambiar de lado y sonido. Al lado, leads y reserva de los dos y tus notas: «+ Nota» apunta el turno (`[T5]`) y al pulsar esa línea salta allí.
- **Inglés y español**: la app sale en inglés (como Showdown) y se puede pasar a español (Settings → Language). Lo que escribes tú (notas, documento) no se toca; el documento se monta en el idioma elegido.

- **Jugar**: Pokémon Showdown dentro de la app, con tu sesión guardada. La **calculadora es un cajón** que sale y se esconde por la derecha (pestaña «Calculadora» o Ctrl+K) y abajo tienes las **notas de la partida**, que se guardan con ella.
- **Sesiones**: cada sesión tiene nombre, objetivo y equipo. Las partidas se apuntan en la sesión abierta y el Dashboard enseña por defecto las suyas. Se cambia desde arriba a la izquierda (vuelve a la pantalla de inicio).
- **Buscar partida y llevar tu equipo**: en Jugar, «Llevar mi equipo a Showdown» lo deja en la carpeta «Macar Showdown» de su teambuilder y «Buscar partida (Reg M-C)» busca en el ladder con él.
- **Extensiones de Chrome** dentro de Showdown (por ejemplo, Showdex): desde la Chrome Web Store, un .crx/.zip o una carpeta (Ajustes).
- **Replays**: al acabar cada combate tuyo se sube también la replay a Showdown y queda enlazada en la partida (se apaga en Ajustes). La calculadora en directo sigue el combate abierto: tus Pokémon con sus estadísticas exactas, lo que se ve del rival (PS, objeto, habilidad, movimientos, niveles de stats), clima, campo, pantallas y Viento Afín.
- **Captura automática**: al acabar cada combate guarda el registro completo. Si después llega el cambio de ELO, se actualiza.
- **Calculadora**: motor de Smogon (`@smogon/calc`, formato Champions a nivel 50 con SP). Tus ataques contra los dos rivales del campo y los suyos contra los tuyos, KOs, velocidad. Al rival le pone su set de tu Team Box o, si no, el **set de torneo** (lo más llevado en los torneos online de Limitless de los últimos 30 días, con los puntos de Smogon) o el más usado en Smogon.
- **Calculadora (más)**: elegir Pokémon en una rejilla (más llevados en torneos, Mi PC o todos), «Cómo sale el daño» con las 16 tiradas al pulsar una celda, y ficha de cada Pokémon / Pokédex (stats, tipos contra él, velocidades, lo que lleva en torneos y en Smogon).
- **Elegir objeto**: en el editor, «Elegir» abre los objetos con buscador, más usados para ese Pokémon (torneos y Smogon), por grupo, bayas de resistencia y por tipo, con icono y descripción (español e inglés).
- **Multicalc**: los cuatro del campo eligen jugada y se juega el turno (prioridad, velocidad, Espacio Raro, Viento Afín, Protección, Fake Out, ataques en área, clima por habilidad). Siguiente turno con los PS que quedan. «Todas las opciones (tabla)»: todas tus jugadas contra todas las suyas, con peor y mejor caso. «Todas las opciones, turno a turno»: árbol visual (sprites, movimientos con el color de su tipo, barras de PS con lo perdido y orden de ataque) con tus mejores jugadas, las respuestas del rival que más te duelen y «Y luego» (el turno siguiente desde lo que deja esa rama); «Usarlo este turno» lo pone en la Multicalc.
- **Teambuilder**: tus equipos, el tuyo marcado como «mi equipo», editor de cada Pokémon (SP, naturaleza, movimientos, sets más usados), análisis de debilidades, cobertura, velocidades y revisión (control de velocidad, redirección, Fake Out, objetos repetidos). Importar desde texto o Pokepaste y enviar a tu teambuilder de Showdown.
- **Mi PC**: tus sets por cajas, con notas, filtros y búsqueda, y el Team Box con todos los equipos (tuyos y de rivales).
- **Optimizador SP**: el mejor reparto de puntos y naturaleza para un Pokémon de tu equipo contra los más llevados en torneos, los más usados en Smogon o tus equipos rivales (velocidad, aguante y KOs; en «Equilibrado» nunca a costa de hacer menos daño), con comparativa y detalle por rival. «Optimizar todo el equipo» da los seis repartos y el equipo listo para exportar.
- **Documento de preparación**: hojas A4 con la estructura de un prep doc de VGC: tu equipo, historia y concepto, sets y cálculos clave de cada Pokémon y guía de matchups (récord, con qué ganas, claves, replays ganadas y perdidas). Se edita escribiendo en la hoja: texto, cajas, ideas clave, listas, tablas (filas, columnas y anchos), imágenes (pegar, alinear y tamaño), sprites de Pokémon (en la línea del texto o en fila), cálculos y páginas; zoom, estilo oscuro o clásico y **PDF**.
- **Actualización automática**: busca versiones nuevas en GitHub, las descarga sola y se instalan al cerrar la app (o al pulsar «Reiniciar ahora»).
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
npm test       # pruebas del lector, guardado, estadísticas, Dashboard y motor
npm run dist   # crear el instalador en dist/
```

Estructura: `main.js` (proceso principal), `preload.js` (puente seguro), `src/parser.js` (lector de partidas), `src/store.js` (guardado y colecciones), `src/capture.js` (captura), `src/live.js` (combate en directo), `src/usage.js` (sets más usados de Smogon), `renderer/` (interfaz: `poke.js` piezas comunes, `calc.js` y `multicalc.js`, `team.js`, `pc.js`, `optimizer.js`, `doc.js`).

Pruebas de la interfaz sin tocar tus datos: `MACAR_DATOS=<carpeta>` usa otra carpeta de datos, `MACAR_CAPTURAS=<carpeta>` y `MACAR_PASOS=<pasos.json>` recorren pantallas y guardan capturas, `MACAR_PDF=<archivo>` guarda el PDF sin preguntar. Solo funcionan en desarrollo.
