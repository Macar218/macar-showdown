'use strict';
/*
 * Macar Showdown · idiomas (español / English).
 * La interfaz se escribe en español. En inglés, este archivo traduce lo que se ve: textos, títulos y
 * marcadores de las pantallas (también lo que aparece después), con un diccionario de frases, frases con
 * números y trozos dentro de textos con nombres de Pokémon. No toca lo que escribes tú (notas, documento)
 * ni Showdown. Los nombres de Pokémon, movimientos, objetos y habilidades ya están en inglés.
 */
const I18N = (() => {
  let lang = 'en';
  try { lang = localStorage.getItem('msLang2') === 'es' ? 'es' : 'en'; } catch (e) { /* nada */ }
  document.documentElement.lang = lang;

  /* ---------- frases exactas ---------- */
  const D = {
    // navegación y barra lateral
    'Jugar': 'Play', 'Dashboard': 'Dashboard', 'Partidas': 'Matches', 'Equipo': 'Team', 'Teambuilder': 'Teambuilder', 'Mi PC': 'My PC', 'Calculadora': 'Calculator', 'Optimizador SP': 'SP Optimizer', 'Documento': 'Document', 'Ajustes': 'Settings',
    'Tu sesión': 'Your session', 'Sin sesión': 'No session', 'Comprobando Showdown…': 'Checking Showdown…', 'Esperando a Showdown…': 'Waiting for Showdown…', 'Captura activa': 'Capture on',
    'Tu sesión: aquí se apuntan las partidas. Cambia a otra o crea una nueva.': 'Your session: matches are logged here. Switch to another or create a new one.',
    'Partida no guardada en ninguna sesión: abre o crea una.': 'Matches are not logged in any session: open or create one.',
    // Jugar
    'Juega como siempre: al terminar cada combate, la partida se guarda sola.': 'Play as usual: every battle is saved when it ends.',
    'Llevar mi equipo a Showdown': 'Send my team to Showdown', 'Buscar partida (Reg M-C)': 'Find a battle (Reg M-C)', 'Cancelar búsqueda': 'Cancel search', 'Búsqueda cancelada.': 'Search cancelled.',
    'Busca partida en el ladder con tu equipo': 'Search a ladder battle with your team', 'Tu equipo, en la carpeta «Macar Showdown» del teambuilder de Showdown': 'Your team, in the «Macar Showdown» folder of the Showdown teambuilder',
    'Recargar Showdown': 'Reload Showdown', 'Grabando el combate': 'Recording the battle', 'Abrir o cerrar la calculadora (Ctrl+K)': 'Open or close the calculator (Ctrl+K)',
    'Notas de la partida': 'Match notes', 'Abre un combate para tomar notas': 'Open a battle to take notes', 'Mostrar u ocultar las notas': 'Show or hide notes', 'Última partida': 'Last match',
    'Apunta mientras juegas: qué ha traído, qué ha hecho, sets que has visto, errores… Se guarda con la partida.': 'Write while you play: what they brought, what they did, sets you saw, mistakes… It is saved with the match.',
    'Guardado': 'Saved', 'En combate': 'In battle', 'Terminado': 'Finished', 'terminado': 'finished', 'espectador': 'spectator', 'Combate': 'Battle',
    'Primero elige tu equipo en el Teambuilder (Usar como mi equipo).': 'First pick your team in the Teambuilder (Use as my team).',
    'Se instala al cerrar la app.': 'It installs when you close the app.', 'Reiniciar ahora': 'Restart now',
    // calculadora
    'Calculadora de daño': 'Damage calculator', 'MANUAL': 'MANUAL', 'EN DIRECTO': 'LIVE', 'Sin combate abierto': 'No open battle', 'Seguir el combate': 'Follow the battle',
    'Cargar lo que pasa en el combate abierto en Jugar': 'Load what happens in the battle open in Play', 'Pokédex': 'Pokédex', 'Info Pokémon': 'Pokémon info',
    'Info Pokémon: busca por nombre o número': 'Pokémon info: search by name', 'Info Pokémon: stats, tipos, velocidad y lo que lleva en torneos': 'Pokémon info: stats, types, speed and what it runs in tournaments',
    'Tu equipo…': 'Your team…', 'Equipo rival…': 'Rival team…', '+ Rival': '+ Rival', 'Pegar o traer de Pokepaste un equipo rival': 'Paste or fetch a rival team from Pokepaste',
    'Tu equipo (si no hay combate, o si eres espectador)': 'Your team (when there is no battle, or you are spectating)', 'Equipo del rival: sus sets mandan sobre los más usados': 'Rival team: its sets win over the most used ones',
    'Sets del rival que no conoces:': 'Rival sets you do not know:', 'Torneos': 'Tournaments', 'Smogon': 'Smogon',
    'Tus Pokémon': 'Your Pokémon', 'Sus Pokémon': 'Their Pokémon', 'Añadir un Pokémon a mano': 'Add a Pokémon by hand', 'Daño': 'Damage', 'Multicalc': 'Multicalc',
    'Editar': 'Edit', 'Sin objeto': 'No item', 'VS': 'VS', 'exacto': 'exact', 'Smogon ': 'Smogon ', 'de torneo': 'tournament', 'pegado': 'pasted', 'de tu equipo': 'from your team', 'a mano': 'manual', 'combate': 'battle', 'sin datos': 'no data',
    'Aún no se ha visto: es lo más probable': 'Not seen yet: most likely', 'Elige tu Pokémon': 'Pick your Pokémon', 'Elige el rival': 'Pick the rival', 'o añade uno con +.': 'or add one with +.',
    'Tus ataques': 'Your attacks', 'Sus ataques': 'Their attacks', 'estado': 'status', 'no calcula': 'cannot calc', 'No lo ha usado todavía': 'Not used yet',
    'Sin movimientos. Pulsa Editar para ponerlos.': 'No moves. Press Edit to add them.', 'Empate de velocidad': 'Speed tie', 'Espacio Raro': 'Trick Room',
    'Campo y pantallas': 'Field and screens', 'Sin clima': 'No weather', 'Sol': 'Sun', 'Lluvia': 'Rain', 'Arena': 'Sand', 'Nieve': 'Snow', 'Sol abrasador': 'Harsh sunshine', 'Diluvio': 'Heavy rain',
    'Sin campo': 'No terrain', 'Eléctrico': 'Electric', 'Hierba': 'Grassy', 'Psíquico': 'Psychic', 'Niebla': 'Misty', 'Gravedad': 'Gravity', 'Golpe crítico': 'Critical hit', 'Crítico': 'Crit',
    'Tu lado': 'Your side', 'Su lado': 'Their side', 'Reflejo': 'Reflect', 'Pantalla Luz': 'Light Screen', 'Velo Aurora': 'Aurora Veil', 'Viento Afín': 'Tailwind', 'Mano Amiga': 'Helping Hand', 'Compiescolta': 'Friend Guard',
    'Clima, campo, pantallas y Viento Afín se copian del combate en cada turno.': 'Weather, terrain, screens and Tailwind are copied from the battle every turn.',
    'Cargando sets más usados…': 'Loading most used sets…', 'Cómo sale el daño': 'How the damage comes out', 'Pulsa para ver cómo sale el daño': 'Click to see how the damage comes out', 'Cerrar': 'Close',
    'Elegir tu Pokémon': 'Pick your Pokémon', 'Elegir rival': 'Pick rival', 'Elige un Pokémon': 'Pick a Pokémon', 'Más usados': 'Most used', 'Todos': 'All', 'Buscar por nombre…': 'Search by name…', 'Pegar un set…': 'Paste a set…',
    'Elige un set: uno de los más llevados en los torneos, uno de tu PC o cualquiera (luego lo retocas en Editar).': 'Pick a set: one of the most used in tournaments, one from your PC or any (then tweak it in Edit).',
    'Nada coincide con esa búsqueda.': 'Nothing matches that search.', 'Tipos contra él': 'Types against it', 'Todo le hace daño normal.': 'Everything does normal damage.',
    'Velocidad a nivel 50': 'Speed at level 50', 'Sin puntos, naturaleza que la baja': 'No points, lowering nature', 'Sin puntos': 'No points', '32 SP': '32 SP', '32 SP y naturaleza que la sube': '32 SP and boosting nature',
    'Máxima con Viento Afín': 'Max with Tailwind', 'Máxima con Pañuelo': 'Max with Scarf', 'En torneos': 'In tournaments', 'En Smogon': 'On Smogon', 'Objetos': 'Items', 'Naturalezas': 'Natures', 'Movimientos': 'Moves', 'Suele ir con': 'Usually with', 'Repartos': 'Spreads', 'Habilidades': 'Abilities',
    // editor
    'Añadir Pokémon': 'Add Pokémon', 'tuyo': 'yours', 'rival': 'rival', 'Pokémon': 'Pokémon', 'Mote': 'Nickname', 'Objeto': 'Item', 'Habilidad': 'Ability', 'Naturaleza': 'Nature', 'Elegir': 'Pick', 'Elige el objeto': 'Pick the item',
    'Nombre en inglés: Garchomp…': 'Name: Garchomp…', 'Puntos (SP) ·': 'Points (SP) ·', '· máximo': '· max', 'por característica': 'per stat', 'A 0': 'To 0', 'Estado': 'Status', 'PS (%)': 'HP (%)',
    'Sano': 'Healthy', 'Quemado': 'Burned', 'Paralizado': 'Paralyzed', 'Envenenado': 'Poisoned', 'Gravemente env.': 'Badly poisoned', 'Dormido': 'Asleep', 'Congelado': 'Frozen',
    'Más llevados en torneos': 'Most used in tournaments', 'Más usados en Smogon': 'Most used on Smogon', '· pulsa para ponerlo': '· click to set it', 'Poner el set de torneo entero': 'Use the whole tournament set',
    'En Mi PC': 'In My PC', 'Pegar o copiar el set (formato Showdown)': 'Paste or copy the set (Showdown format)', 'Pega aquí un Pokémon exportado de Showdown': 'Paste a Pokémon exported from Showdown here',
    'Usar el texto': 'Use the text', 'Copiar': 'Copy', 'Copiado.': 'Copied.', 'Copiado': 'Copied', 'No se pudo copiar.': 'Could not copy.', 'Guardar en Mi PC': 'Save to My PC', 'Nombre en Mi PC (opcional)': 'Name in My PC (optional)',
    'Guardar': 'Save', 'Quitar': 'Remove', 'Guardado en Mi PC.': 'Saved to My PC.', 'Ese set ya está en tu PC.': 'That set is already in your PC.', 'Elige un Pokémon.': 'Pick a Pokémon.',
    'Pega un Pokémon en formato Showdown.': 'Paste a Pokémon in Showdown format.', 'Quitar de la calculadora': 'Remove from the calculator', 'Quitar del equipo': 'Remove from team',
    'Por grupo': 'By group', 'Bayas de resistencia': 'Resist berries', 'Por tipo': 'By type', 'Buscar objeto…': 'Search item…', 'Sin resultados.': 'No results.', 'En Smogon y su megapiedra': 'On Smogon and its Mega Stone',
    'Elige antes un Pokémon para ver sus objetos más usados.': 'Pick a Pokémon first to see its most used items.', 'Aguante': 'Bulk', 'Bayas': 'Berries', 'Velocidad': 'Speed', 'Campo': 'Field', 'Utilidad': 'Utility', 'Megapiedras': 'Mega Stones',
    // multicalc
    'Peor caso': 'Worst case', 'Normal': 'Normal', 'Mejor caso': 'Best case', 'Siguiente turno': 'Next turn', 'Reiniciar turnos': 'Reset turns', 'Vuelve al turno 1 con los PS de ahora': 'Back to turn 1 with the current HP',
    'Qué pasa este turno': 'What happens this turn', 'Nadie ataca este turno.': 'Nobody attacks this turn.', 'No hace nada': 'Does nothing', 'área': 'spread', 'Vacío': 'Empty',
    'Cae este turno': 'Faints this turn', 'Aguanta el turno': 'Survives the turn', 'No recibe daño': 'Takes no damage', 'ya debilitado': 'already fainted',
    'Todas las opciones (tabla)': 'All options (table)', 'Recalcular la tabla': 'Recalculate the table', 'Todas las opciones, turno a turno': 'All options, turn by turn', 'Recalcular el árbol': 'Recalculate the tree',
    'Todas tus jugadas contra todas las del rival, y qué pasa en cada caso': 'All your plays against all the rival plays, and what happens in each case',
    'Tus mejores jugadas, lo que puede responder el rival y qué pasa después, turno a turno': 'Your best plays, what the rival can answer and what happens next, turn by turn',
    'Todas tus jugadas contra todas las suyas': 'All your plays against all of theirs', 'Tu jugada': 'Your play', 'su mejor respuesta, malas tiradas': 'their best answer, bad rolls', 'Usarla': 'Use it',
    'Si el rival hace': 'If the rival does', 'Si el rival hace:': 'If the rival does:', 'Y luego ▸': 'And then ▸', 'Ocultar': 'Hide', 'Usarlo este turno': 'Use it this turn', 'Pone este turno (PS y movimientos) en la Multicalc': 'Puts this turn (HP and moves) in the Multicalc',
    'Ningún KO': 'No KO', 'Ver G#': 'View G#', 'Todos los equipos': 'All teams', 'Peor caso': 'Worst case', 'Su respuesta más dura': 'Their strongest answer', 'Orden': 'Order', 'Viento Afín': 'Tailwind', 'Espacio Raro': 'Trick Room', 'Espacio Raro · Viento Afín': 'Trick Room · Tailwind', 'Turno # ▸': 'Turn # ▸', 'Faltan Pokémon o movimientos para ver las opciones.': 'Pokémon or moves are missing to see the options.',
    'Faltan Pokémon: carga tu equipo y el rival (o abre un combate) para usar la Multicalc.': 'Pokémon missing: load your team and the rival (or open a battle) to use the Multicalc.',
    // dashboard
    'Partidas seguidas': 'Back-to-back matches', 'Récord': 'Record', 'Victorias': 'Wins', 'Derrotas': 'Losses', 'ELO': 'ELO', 'GXE': 'GXE', 'Racha': 'Streak', 'Turnos': 'Turns', 'Apuros de tiempo': 'Time trouble',
    'último conocido': 'last known', 'de media': 'on average', '≤10 s en algún turno': '≤10 s in some turn', 'ladder Reg M-C': 'Reg M-C ladder', 'Resultado': 'Result', 'Todas': 'All', 'Fechas': 'Dates', 'Todo': 'All', 'Hoy': 'Today', '7 días': '7 days', '30 días': '30 days', 'Elegir fechas': 'Pick dates',
    'Desde': 'From', 'Hasta': 'To', 'Sesión': 'Session', 'Todas las partidas': 'All matches', 'Tu equipo': 'Your team', 'Formato': 'Format', 'Tu lead': 'Your lead', 'Rival con': 'Rival with', 'Cualquiera': 'Any', 'Quitar el filtro': 'Clear filters',
    'Tu MVP': 'Your MVP', 'Con él': 'With it', 'Sin él': 'Without it', 'Juega unas partidas y aquí sale tu MVP.': 'Play a few matches and your MVP shows up here.', 'Tu resumen': 'Your summary', 'Aún hay pocas partidas para saberlo.': 'Too few matches to tell yet.',
    'Lo que más usas': 'What you use most', '¿Abriendo o desde atrás?': 'Leading or from the back?', 'De lead': 'As lead', 'De reserva': 'In the back', 'Tus parejas de leads': 'Your lead pairs', 'Con quién funciona': 'Who it works with',
    'Contra quién brilla · sufre': 'Who it beats · struggles with', 'Contra quién brilla': 'Who it beats', 'Contra quién sufre': 'Who it struggles with', 'Pocas partidas aún.': 'Few matches yet.', 'Sus movimientos:': 'Their moves:',
    'Los rivales': 'The rivals', 'Los que más ves': 'What you see most', 'Contra lo que más ganas': 'What you beat most', 'Lo que más te cuesta': 'What you struggle with most', 'Cómo te abren': 'How they lead against you',
    'Sus movimientos': 'Their moves', 'Megas rivales': 'Rival Megas', 'Ningún rival ha megaevolucionado.': 'No rival has Mega Evolved.', 'Cómo juegas': 'How you play', 'Tu mejor hora': 'Your best time', 'Por día de la semana': 'By day of the week',
    'Lunes': 'Monday', 'Martes': 'Tuesday', 'Miércoles': 'Wednesday', 'Jueves': 'Thursday', 'Viernes': 'Friday', 'Sábado': 'Saturday', 'Domingo': 'Sunday',
    'Cortas o largas': 'Short or long', 'Tras ganar': 'After a win', 'Tras perder': 'After a loss', 'Primeras 5 de la sesión': 'First 5 of the session', 'De la 6.ª en adelante': 'From the 6th on',
    'En el Bo3': 'In Bo3', 'Sets': 'Sets', 'Win % de sets': 'Set win %', 'Cierras tras ganar G1': 'You close after winning G1', 'Remontas tras perder G1': 'You come back after losing G1', 'Sin series Bo3 todavía.': 'No Bo3 sets yet.',
    'Últimas partidas': 'Latest matches', 'Sin datos.': 'No data.', 'Hacen falta al menos 2 partidas.': 'At least 2 matches needed.', 'Hacen falta al menos 2 partidas con la misma pareja.': 'At least 2 matches with the same pair needed.',
    'Hace falta más de un dato de ELO para dibujar la evolución.': 'More than one ELO value is needed to draw the trend.', 'Sin ELO': 'No ELO',
    'Victoria': 'Win', 'Derrota': 'Loss', 'Empate': 'Tie', 'Sin identificar': 'Unknown', 'PDF de preparación': 'Prep PDF', 'Objetivo de la sesión': 'Session goal', 'En la sesión': 'In the session',
    'Con una sola partida, tu estadística es o perfecta o un desastre. Juega más antes de sacar conclusiones.': 'With a single match, your stats are either perfect or a disaster. Play more before drawing conclusions.',
    'Tu Dashboard se llena solo con cada partida que juegues.': 'Your Dashboard fills itself with every match you play.', 'Aún no hay partidas con estos filtros.': 'No matches with these filters yet.',
    'Pon tu usuario de Showdown para saber qué jugador eres en cada partida.': 'Set your Showdown username so it knows which player you are in each match.', 'Ir a Ajustes': 'Go to Settings', 'Ir a Jugar': 'Go to Play', 'Ir a Equipo': 'Go to Team', 'Ir al Teambuilder': 'Go to the Teambuilder',
    'Juega en la pestaña Jugar: ladder, torneos o retos. Cada combate se guarda al terminar.': 'Play in the Play tab: ladder, tournaments or challenges. Every battle is saved when it ends.',
    '¿Tienes replays de antes? Impórtalos y también cuentan.': 'Have older replays? Import them and they count too.',
    'Perder no te afecta: mantienes el nivel en la siguiente.': 'Losing does not affect you: you keep your level in the next one.', 'Ganas más en las partidas largas: tu fuerte es el final.': 'You win more in long matches: your strength is the endgame.',
    'Ganas más cuando la partida va rápida: tu fuerte es el principio.': 'You win more when the match is fast: your strength is the early game.', 'Rindes igual en partidas cortas y largas.': 'You do the same in short and long matches.',
    'Aguantas bien las sesiones largas.': 'You hold up well in long sessions.',
    // partidas
    'Importar replays': 'Import replays', 'Buscar': 'Search', 'Rival, Pokémon o notas…': 'Rival, Pokémon or notes…', 'Rondas y notas del match': 'Rounds and match notes', 'Faltan rondas por registrar': 'Rounds still missing',
    'Todavía no hay partidas. Juega desde la pestaña Jugar o importa tus replays.': 'No matches yet. Play from the Play tab or import your replays.',
    'Tus leads': 'Your leads', 'Tu reserva': 'Your back', 'Sus leads': 'Their leads', 'Su reserva': 'Their back', 'Mega rival': 'Rival Mega', 'Notas de esta ronda': 'Notes for this round', 'Qué pasó en esta ronda…': 'What happened this round…',
    'Hoja de equipo del rival': "Rival's team sheet", 'Rival en la calculadora': 'Rival in the calculator', 'Conclusiones del set': 'Set conclusions', 'Conclusiones del set: qué funcionó, qué cambiar…': 'Set conclusions: what worked, what to change…',
    'Notas guardadas': 'Notes saved', 'Ver replay': 'Watch replay', 'Ver partida': 'View match', 'Ver replay en Showdown': 'Watch replay on Showdown', 'Copiar enlace': 'Copy link', 'Enlace copiado': 'Link copied', 'Subir replay': 'Upload replay', 'Subiendo…': 'Uploading…', 'Replay subida.': 'Replay uploaded.',
    'Solo funciona si la sala del combate sigue abierta en Jugar': 'Only works while the battle room is still open in Play', 'Descargar replay': 'Download replay', 'Replay guardada.': 'Replay saved.',
    'Guarda la replay en un archivo .html que se abre en el navegador': 'Saves the replay as an .html file that opens in the browser', 'Abrir carpeta de vídeos': 'Open videos folder', 'Borrar vídeo': 'Delete video',
    'Sesión de esta partida': 'Session of this match', 'Tu equipo en esta partida': 'Your team in this match', 'Sin asignar': 'Unassigned', 'Sesión cambiada': 'Session changed', 'Equipo guardado': 'Team saved',
    'Notas de la partida…': 'Match notes…', 'Qué viste del rival, errores, ideas para la próxima…': 'What you saw from the rival, mistakes, ideas for next time…', 'Borrar partida': 'Delete match', '¿Seguro? Pulsa otra vez para borrar': 'Sure? Press again to delete',
    'Tú': 'You', 'Rival': 'Rival', 'Jugador 1': 'Player 1', 'Jugador 2': 'Player 2', 'Equipo rival': 'Rival team', 'Equipo rival:': 'Rival team:', 'Sin movimientos registrados.': 'No moves recorded.',
    'Importar replays de Showdown': 'Import Showdown replays', 'Un enlace por línea. Para replays privados copia el enlace completo (incluye la contraseña al final).': 'One link per line. For private replays copy the full link (it includes the password at the end).',
    'Elegir archivos .html…': 'Choose .html files…', 'Importar enlaces': 'Import links', 'Primero pon tu usuario de Showdown para saber qué jugador eres en cada replay.': 'First set your Showdown username so it knows which player you are in each replay.',
    'importada': 'imported', 'guardada al jugar': 'saved while playing',
    // teambuilder
    'Nuevo equipo': 'New team', 'Importar equipo': 'Import team', 'Equipos de torneo': 'Tournament teams', 'Equipos del top cut de los torneos, listos para cargar': 'Top cut teams from tournaments, ready to load',
    'Tus equipos. El marcado como': 'Your teams. The one marked as', 'es el que usan el Dashboard, la Calculadora y el Documento.': 'is the one used by the Dashboard, the Calculator and the Document.',
    'mi equipo': 'my team', 'Mi equipo': 'My team', 'Tu usuario de Showdown': 'Your Showdown username', 'Para saber qué jugador eres en cada partida': 'So it knows which player you are in each match',
    'Aún no tienes equipos. Crea uno o impórtalo.': 'You have no teams yet. Create one or import it.', 'Usar como mi equipo': 'Use as my team', 'Enviar a Showdown': 'Send to Showdown', 'Sets a Mi PC': 'Sets to My PC', 'A la calculadora': 'To the calculator', 'Borrar': 'Delete',
    'Lo añade a tu teambuilder de Showdown (pestaña Jugar)': 'Adds it to your Showdown teambuilder (Play tab)', 'Guarda cada Pokémon como un set en Mi PC': 'Saves each Pokémon as a set in My PC', 'Abrirlo en la Calculadora como tu equipo': 'Open it in the Calculator as your team',
    'Nombre del equipo': 'Team name', 'Mover a la izquierda': 'Move left', 'Mover a la derecha': 'Move right', 'Añadir Pokémon al equipo': 'Add Pokémon to the team',
    'Defensa: qué te hace daño': 'Defense: what hurts you', 'Cobertura de tus ataques': 'Your attack coverage', 'Tipos a los que pegas supereficaz con algún movimiento.': 'Types you hit super effectively with some move.', 'Cubres todos los tipos.': 'You cover every type.',
    'Velocidades': 'Speeds', 'Revisión': 'Review', 'Notas del equipo': 'Team notes', 'Idea del equipo, leads, planes…': 'Team idea, leads, plans…', 'Elige un equipo o crea uno nuevo.': 'Pick a team or create a new one.',
    'Sin control de velocidad (Tailwind, Trick Room, Icy Wind…)': 'No speed control (Tailwind, Trick Room, Icy Wind…)', 'Sin redirección (Follow Me / Rage Powder)': 'No redirection (Follow Me / Rage Powder)', 'Sin Fake Out': 'No Fake Out',
    'Sin debilidades compartidas graves': 'No serious shared weaknesses', 'Nombre (si lo dejas vacío, el del Pokepaste)': 'Name (if empty, the Pokepaste one)', 'De quién': 'Whose', 'Mío': 'Mine', 'De un rival': "A rival's",
    'Enlace de pokepast.es': 'pokepast.es link', 'O pega el equipo en formato Showdown (hasta 6 Pokémon)': 'Or paste the team in Showdown format (up to 6 Pokémon)', 'Traer Pokepaste': 'Fetch Pokepaste', 'Guardar equipo': 'Save team',
    'Trayendo…': 'Fetching…', 'Listo. Revisa y guarda.': 'Done. Check and save.', '¿Borrar este equipo?': 'Delete this team?',
    // Mi PC
    'Tus sets y repartos guardados, y todos tus equipos. Se guardan en tu carpeta de datos.': 'Your saved sets and spreads, and all your teams. Stored in your data folder.',
    'Buscar: nombre, Pokémon, objeto, movimiento, notas…': 'Search: name, Pokémon, item, move, notes…', 'Tuyos y de rivales': 'Yours and rivals', 'Tuyos': 'Yours', 'De rivales': "Rivals'", 'Todas las cajas': 'All boxes',
    'Más nuevos': 'Newest', 'Más antiguos': 'Oldest', 'A → Z': 'A → Z', 'Z → A': 'Z → A', 'Añadir sets': 'Add sets', 'Tuyo': 'Yours', 'Añadir sets a Mi PC': 'Add sets to My PC',
    'Ningún set coincide con estos filtros.': 'No set matches these filters.', 'A un equipo': 'To a team', 'Ponerlo en un equipo': 'Put it in a team', 'Duplicar': 'Duplicate', 'Hace una copia para probar variantes': 'Makes a copy to try variants',
    '◀ Caja anterior': '◀ Previous box', 'Caja siguiente ▶': 'Next box ▶', '◀ Página anterior': '◀ Previous page', 'Página siguiente ▶': 'Next page ▶', 'Abrirlo en la Calculadora': 'Open it in the Calculator',
    'Añadir un equipo al Team Box': 'Add a team to the Team Box', 'Exportar el Team Box': 'Export the Team Box', 'Abrir en el Teambuilder': 'Open in the Teambuilder', 'La Calculadora usará sus sets': 'The Calculator will use its sets',
    'Pasar a rival': 'Move to rivals', 'Pasar a mío': 'Move to mine', 'Todavía no hay equipos.': 'No teams yet.', 'Guardar en Team Box': 'Save to Team Box', 'Usarlo yo': 'Use it myself', 'Lo guarda como tuyo y lo abre en el Teambuilder': 'Saves it as yours and opens it in the Teambuilder',
    'Buscar: Pokémon, jugador o torneo…': 'Search: Pokémon, player or tournament…', 'Con alguno de mis Pokémon': 'With any of my Pokémon', 'Ningún equipo cumple estos filtros.': 'No team matches these filters.', 'Actualizar': 'Refresh', 'Actualizando…': 'Refreshing…', 'Reintentar': 'Retry',
    'Ej.: Incineroar de lluvia': 'E.g.: Rain Incineroar', 'Caja': 'Box', 'Ej.: Lluvia para el Regional': 'E.g.: Rain for the Regional', 'Notas': 'Notes', 'Para qué formato es, contra qué va bien, de dónde lo sacaste…': 'Which format, what it beats, where you got it…',
    'Nombre y notas': 'Name and notes', 'Nombre': 'Name', 'Cambiar el set…': 'Change the set…', 'Contra qué va bien, qué cálculos aguanta, de dónde lo sacaste…': 'What it beats, which calcs it survives, where you got it…',
    'Añadir al equipo': 'Add to team', 'No tienes equipos: crea uno en el Teambuilder.': 'You have no teams: create one in the Teambuilder.', 'Ya tiene 6': 'Already has 6', '¿Borrar este set de Mi PC?': 'Delete this set from My PC?', 'Esos sets ya están en tu PC.': 'Those sets are already in your PC.',
    // optimizador
    'Busca el mejor reparto de puntos y naturaleza para un Pokémon de tu equipo contra los rivales que elijas.': 'Finds the best point spread and nature for a Pokémon on your team against the rivals you choose.',
    'Primero crea o importa tu equipo en el Teambuilder.': 'First create or import your team in the Teambuilder.', 'Contra': 'Against', 'Los más llevados en torneos': 'The most used in tournaments', 'Los más usados en Smogon': 'The most used on Smogon', 'Equipos rivales del Team Box': 'Rival teams from the Team Box',
    'Cuántos': 'How many', 'Prioridad': 'Priority', 'Equilibrado': 'Balanced', 'Con Viento Afín': 'With Tailwind', 'Buscar repartos': 'Find spreads', 'Optimizar todo el equipo': 'Optimize the whole team', 'Busca el mejor reparto de los seis y te da el equipo listo para exportar': 'Finds the best spread for all six and gives you the team ready to export',
    'Calculando los repartos…': 'Calculating spreads…', 'Elige al menos un equipo rival.': 'Pick at least one rival team.', 'Propuestas': 'Proposals', 'Tu reparto': 'Your spread', 'La mejor': 'The best', 'Comparativa': 'Comparison', 'tus puntos (gris) y la propuesta (color)': 'your points (grey) and the proposal (colour)',
    'Tu naturaleza ya es la que mejor sale contra estos rivales.': 'Your nature is already the best against these rivals.', 'Ponerlo en mi equipo': 'Put it on my team', 'Puesto en tu equipo.': 'Put on your team.',
    'Velocidad ': 'Speed ', 'Su golpe más fuerte': 'Their strongest hit', 'Tu mejor golpe': 'Your best hit', 'Te mueves antes': 'You move first', 'Él se mueve antes': 'It moves first', 'No te hace daño': 'Does not hurt you', 'te tumba': 'KOs you',
    'Rivales que superas en velocidad': 'Rivals you outspeed', 'Golpes más fuertes de cada rival que aguantas sin caer': 'Strongest hit of each rival that you survive', 'Rivales a los que haces KO de un golpe (tirada mínima)': 'Rivals you OHKO (min roll)',
    'Exportar con los repartos': 'Export with the spreads', 'Ahora': 'Now', 'Propuesta': 'Proposal', 'Copiar al portapapeles': 'Copy to clipboard', 'Copiado: impórtalo en Showdown.': 'Copied: import it in Showdown.', 'Copiado al portapapeles': 'Copied to clipboard',
    'Todavía no hay equipos rivales. Añádelos en Mi PC → Team Box (pegando su texto o su enlace de Pokepaste).': 'No rival teams yet. Add them in My PC → Team Box (pasting their text or Pokepaste link).',
    // documento
    'Documento de preparación': 'Prep document', 'de preparación': '· prep', 'Tu PDF de preparación, listo para retocar. Escribe directamente en la hoja.': 'Your prep PDF, ready to tweak. Write directly on the sheet.',
    'Carga tu equipo en el Teambuilder para ver aquí los sets.': 'Load your team in the Teambuilder to see the sets here.', 'Un prep doc guarda y comparte lo importante de un equipo de VGC. Sirve sobre todo en dos casos:': 'A prep doc keeps and shares what matters about a VGC team. It is useful mainly in two cases:',
    'Te estás preparando en serio para algo importante: un Regional, una subida en el ladder, una partida decisiva.': 'You are preparing seriously for something big: a Regional, a ladder climb, a decisive match.', 'Trabajas el equipo con más gente.': 'You work on the team with other people.',
    'Se monta con tus datos: tu equipo, cálculos clave contra lo que más se ve en torneos, tus matchups con récord y replays. Luego lo retocas escribiendo en la hoja.': 'It is built with your data: your team, key calcs against what is most seen in tournaments, your matchups with record and replays. Then you tweak it by writing on the sheet.',
    'Montar el documento con mis datos': 'Build the document with my data', 'Editar ': 'Edit ', 'Ver como PDF': 'View as PDF', 'Volver a editar': 'Back to editing', 'Ver la hoja como saldrá en el PDF: sin los huecos que no has rellenado': 'See the sheet as it will be in the PDF: without the blanks you have not filled',
    'Estilo Macar': 'Macar style', 'Estilo clásico': 'Classic style', 'Oscuro, como el Dashboard': 'Dark, like the Dashboard', 'Fondo blanco, para imprimir': 'White background, for printing', 'Añadir a la página…': 'Add to the page…', 'Añadir a la página': 'Add to the page',
    'Texto normal': 'Normal text', 'Caja con título': 'Box with title', 'Idea clave': 'Key idea', 'Lista': 'List', 'Tabla…': 'Table…', 'Imagen…': 'Image…', 'Sprites…': 'Sprites…', 'Otro cálculo': 'Another calc', 'Página nueva': 'New page',
    'Un hueco para escribir': 'A space to write', 'Un recuadro con su título': 'A box with its title', 'Una idea clave, en amarillo claro': 'A key idea, in light yellow', 'Una lista para ir apuntando': 'A list to keep notes', 'Insertar una tabla del tamaño que quieras': 'Insert a table of any size',
    'Una imagen de tu ordenador (también puedes pegarla con Ctrl+V)': 'An image from your computer (you can also paste it with Ctrl+V)', 'Sprites de Pokémon: en la línea del texto o en una fila': 'Pokémon sprites: inline with the text or in a row', 'Una línea de cálculo de daño': 'A damage calc line', 'Lo que sigue, en otra hoja': 'What follows, on another sheet',
    'Zoom de la hoja': 'Sheet zoom', 'Ancho': 'Width', 'Hoja': 'Sheet', 'La hoja a todo el ancho': 'Sheet at full width', 'La hoja entera en pantalla': 'Whole sheet on screen', 'Volver a generar': 'Generate again', 'Pulsa otra vez: se pierden tus cambios': 'Press again: your changes will be lost',
    'Documento montado otra vez con tus datos de ahora': 'Document rebuilt with your current data', 'Guardar PDF': 'Save PDF', 'Creando el PDF…': 'Creating the PDF…', 'PDF de preparación guardado.': 'Prep PDF saved.', 'Recién montado con tus datos': 'Freshly built with your data', 'Montando…': 'Building…',
    'Quitar esta página': 'Remove this page', 'Va en el PDF: pulsa para dejarla fuera': 'In the PDF: click to leave it out', 'No va en el PDF: pulsa para incluirla': 'Not in the PDF: click to include it', 'Subir': 'Move up', 'Bajar': 'Move down',
    'Imagen:': 'Image:', 'A la izquierda': 'Left', 'A la derecha': 'Right', 'Centrada': 'Centred', 'En línea': 'Inline', 'A la izquierda, con el texto al lado': 'Left, with text beside it', 'A la derecha, con el texto al lado': 'Right, with text beside it', 'Centrada, sola en su línea': 'Centred, on its own line', 'En la línea del texto': 'Inline with the text',
    'Tamaño': 'Size', 'Quitar la imagen': 'Remove the image', 'Quitar la imagen (Supr)': 'Remove the image (Del)', 'Tabla:': 'Table:', 'Fila encima': 'Row above', 'Fila debajo': 'Row below', 'Columna a la izquierda': 'Column left', 'Columna a la derecha': 'Column right',
    'Quitar esta fila': 'Remove this row', 'Quitar esta columna': 'Remove this column', 'Quitar la tabla entera': 'Remove the whole table', 'Arrastra el borde de una columna para cambiar su ancho': 'Drag a column border to change its width', 'Arrastra para cambiar el tamaño': 'Drag to resize',
    'Elige el tamaño': 'Pick the size', 'Tamaño de la tabla:': 'Table size:', 'Sprites': 'Sprites', 'Añadir': 'Add', 'Añade uno o varios Pokémon.': 'Add one or more Pokémon.', 'Fila de sprites': 'Sprite row', 'Con nombres': 'With names',
    'Pon antes el cursor dentro de un texto de la hoja': 'First put the cursor inside a text on the sheet', 'Sentido': 'Direction', 'Tu ataque': 'Your attack', 'Te atacan (aguante)': 'They attack you (bulk)', 'Tu Pokémon': 'Your Pokémon', 'Movimiento': 'Move',
    'Mi equipo ': 'My team ', 'Historia y concepto del equipo': 'Team history and concept', 'Por qué este equipo.': 'Why this team.', 'Cómo gana.': 'How it wins.', 'Gracias a…': 'Thanks to…', 'Huecos para rellenar:': 'Blanks to fill:',
    'Qué viste en el metajuego y qué querías aprovechar.': 'What you saw in the metagame and what you wanted to exploit.', 'El plan principal y los alternativos. Sus puntos fuertes y débiles.': 'The main plan and the alternatives. Its strengths and weaknesses.', 'Quién te ha ayudado o de dónde salió la idea.': 'Who helped you or where the idea came from.',
    'Sets y cálculos clave de cada Pokémon': 'Sets and key calcs for each Pokémon', 'Para qué está pensado este reparto.': 'What this spread is for.', 'Qué aguanta, a quién supera en velocidad y qué KOs busca.': 'What it survives, what it outspeeds and which KOs it aims for.',
    'Cálculos ofensivos clave:': 'Key offensive calcs:', 'Cálculos defensivos clave:': 'Key defensive calcs:', 'Guía de matchups': 'Matchup guide', 'Lo más jugado.': 'Most played.', 'Claves para ganar el matchup.': 'Keys to win the matchup.', 'La idea clave.': 'The key idea.',
    'Ganas con:': 'You win with:', 'Récord:': 'Record:', 'Te abre con:': 'Leads with:', 'Replays ganadas:': 'Replays won:', 'Replays perdidas:': 'Replays lost:', 'aún sin partidas': 'no matches yet', 'tu lead y lo que traes atrás': 'your lead and what you bring in the back',
    'Pokepaste del equipo:': 'Team Pokepaste:', 'pega aquí el enlace': 'paste the link here', 'Código de alquiler:': 'Rental code:', 'Récord con Macar Showdown:': 'Record with Macar Showdown:', 'Escribe aquí…': 'Write here…', 'Título': 'Title', 'Primer punto': 'First point', 'Segundo punto': 'Second point',
    'Tu equipo lleva Tailwind: la Velocidad cuenta la mitad con él puesto.': 'Your team has Tailwind: Speed counts half with it up.', 'Tu equipo lleva Trick Room: los lentos no gastan en Velocidad.': 'Your team has Trick Room: slow ones do not invest in Speed.', 'Hecho con Macar Showdown': 'Made with Macar Showdown',
    '¿Quitar esta página con todo lo que tiene?': 'Remove this page and everything on it?', 'Añadir a la página ': 'Add to the page ',
    // sesiones
    'Tus sesiones': 'Your sessions', 'Elige con qué sesión sigues: su equipo pasa a ser el tuyo y el Dashboard enseña solo sus partidas.': 'Pick which session you continue with: its team becomes yours and the Dashboard shows only its matches.',
    'Buscar: sesión, equipo o Pokémon': 'Search: session, team or Pokémon', 'Nueva sesión': 'New session', 'Cargar': 'Load', 'Cambiar': 'Change', 'Borrar sesión': 'Delete session', 'abierta': 'open', 'Sin objetivo': 'No goal', 'Jugar sin sesión': 'Play without a session',
    'Las partidas no se apuntan en ninguna sesión': 'Matches are not logged in any session', 'Ahora juegas sin sesión: las partidas se guardan, pero sin sesión.': 'You are playing without a session: matches are saved, but without a session.', 'Aún no tienes sesiones.': 'You have no sessions yet.',
    'Ninguna sesión coincide con la búsqueda.': 'No session matches the search.', 'Sesión borrada.': 'Session deleted.', 'Objetivo': 'Goal', 'Sin equipo': 'No team',
    'Una sesión nueva: le pones nombre, un objetivo y, si quieres, el equipo. Equipo nuevo, sesión nueva: así no se mezclan las derrotas del anterior con las de este.': 'A new session: give it a name, a goal and, if you want, the team. New team, new session: so the losses of the old one do not mix with this one.',
    'Ej.: Regional de Madrid': 'E.g.: Madrid Regional', '¿Qué quieres conseguir?': 'What do you want to achieve?', 'Ej.: Top 8 en el Regional de Madrid · Aprender a jugar contra Trick Room': 'E.g.: Top 8 at the Madrid Regional · Learn to play against Trick Room',
    'Vacío: empiezas sin equipo y lo cargas luego en el Teambuilder': 'Empty: start without a team and load it later in the Teambuilder', 'Paste de base (pegar o Pokepaste)…': 'Base paste (paste or Pokepaste)…', '…o pega el equipo exportado de Showdown': '…or paste the team exported from Showdown',
    'Crear la sesión': 'Create the session', 'Ponle un nombre.': 'Give it a name.', 'Trayendo el equipo…': 'Fetching the team…', 'No se ha encontrado ningún Pokémon en el paste.': 'No Pokémon found in the paste.',
    // ajustes
    'Sirve para saber qué jugador eres en cada partida. Si tienes varias cuentas, sepáralas con comas. El usuario con el que estés conectado en Showdown se detecta solo.': 'It tells which player you are in each match. If you have several accounts, separate them with commas. The user logged in on Showdown is detected automatically.',
    'Por ejemplo: toto110': 'For example: toto110', 'Guardado. Partidas actualizadas.': 'Saved. Matches updated.',
    'Archivos de replay descargados de Showdown (.html) o enlaces de replay.pokemonshowdown.com. Si una partida ya estaba, no se duplica.': 'Replay files downloaded from Showdown (.html) or replay.pokemonshowdown.com links. A match already saved is not duplicated.',
    'Elegir archivos…': 'Choose files…', 'Importar enlace': 'Import link', 'Partida importada.': 'Match imported.', 'Esa partida ya estaba guardada.': 'That match was already saved.',
    'Captura automática': 'Automatic capture', 'Activa': 'On', 'Conectado como': 'Logged in as', 'Combates abiertos': 'Open battles', 'Guardadas en esta sesión': 'Saved this session', 'Última comprobación': 'Last check',
    'Replays y vídeo': 'Replays and video', 'Subir la replay de cada combate a Showdown': 'Upload every battle replay to Showdown', 'Al acabar tus combates se sube sola (quien tenga el enlace puede verla) y queda enlazada en la partida.': 'When your battles end it uploads itself (anyone with the link can watch it) and is linked in the match.',
    'Grabar en vídeo cada combate': 'Record every battle on video', 'Graba solo Showdown (sin la calculadora). Los vídeos se quedan en este ordenador:': 'Records only Showdown (without the calculator). Videos stay on this computer:', 'Carpeta': 'Folder', 'Cambiar carpeta…': 'Change folder…', 'Abrir carpeta': 'Open folder',
    'Extensiones de Chrome': 'Chrome extensions', 'Se usan dentro de Showdown en la pestaña Jugar (por ejemplo, Showdex). Añádelas desde la Chrome Web Store, un .crx/.zip o una carpeta.': 'Used inside Showdown in the Play tab (for example, Showdex). Add them from the Chrome Web Store, a .crx/.zip or a folder.',
    'Todavía no has añadido ninguna extensión.': 'You have not added any extension yet.', 'Enlace de la Chrome Web Store o su identificador': 'Chrome Web Store link or its ID', 'Añadir desde la Chrome Web Store': 'Add from the Chrome Web Store', 'O desde tu ordenador:': 'Or from your computer:', '.crx o .zip…': '.crx or .zip…', 'Carpeta descomprimida…': 'Unpacked folder…',
    'Descargando…': 'Downloading…', '¿Quitar esta extensión?': 'Remove this extension?', 'Quitada. Showdown se ha recargado.': 'Removed. Showdown has been reloaded.',
    'Tus datos en todos tus ordenadores': 'Your data on all your computers', 'Partidas, equipos, Mi PC, documentos y ajustes viven en una carpeta. Ponla en OneDrive y elige la misma carpeta en cada ordenador donde juegues: verás lo mismo en todos. Al volver a la ventana de la app se leen los cambios del otro ordenador.': 'Matches, teams, My PC, documents and settings live in one folder. Put it in OneDrive and choose the same folder on every computer you play on: you will see the same everywhere. Changes from the other computer are read when you come back to the app window.',
    'En OneDrive: se sincroniza': 'In OneDrive: synced', 'Solo en este ordenador': 'Only on this computer', 'Usar OneDrive': 'Use OneDrive', 'Elegir carpeta…': 'Choose folder…', 'Volver a la de este ordenador': 'Back to this computer\'s folder', 'Modo de pruebas: carpeta fija.': 'Test mode: fixed folder.',
    'Al cambiar, se copia lo que tengas aquí a la carpeta nueva (sin pisar lo que ya haya) y la app se reinicia.': 'When changing, what you have here is copied to the new folder (without overwriting what is there) and the app restarts.', 'Ya estás usando esa carpeta.': 'You are already using that folder.',
    'Idioma': 'Language', 'El idioma de toda la app. Al cambiarlo, la app se recarga.': 'The language of the whole app. Changing it reloads the app.',
    // tipos
    'Normal ': 'Normal ', 'Fuego': 'Fire', 'Agua': 'Water', 'Planta': 'Grass', 'Hielo': 'Ice', 'Lucha': 'Fighting', 'Veneno': 'Poison', 'Tierra': 'Ground', 'Volador': 'Flying', 'Bicho': 'Bug', 'Roca': 'Rock', 'Fantasma': 'Ghost', 'Dragón': 'Dragon', 'Siniestro': 'Dark', 'Acero': 'Steel', 'Hada': 'Fairy',
    // stats
    'PS': 'HP', 'Atq': 'Atk', 'AtE': 'SpA', 'DfE': 'SpD', 'Vel': 'Spe', 'Total': 'Total'
  };

  // Frases con números (# = un número).
  Object.assign(D, {
    '# partidas': '# matches', '# partida': '# match', '# partidas identificadas': '# identified matches', '# partida identificada': '# identified match', '# partidas con él': '# matches with it',
    '# partidas guardadas': '# matches saved', '# guardadas': '# saved', 'Turno #': 'Turn #', 'turno #': 'turn #', '# turnos': '# turns', 'Página # de #': 'Page # of #', 'Caja # de #': 'Box # of #',
    '# equipos': '# teams', '# sesiones': '# sessions', '# rivales': '# rivals', 'contra # rivales': 'against # rivals', '# partidas · #%': '# matches · #%', '#% de los equipos': '#% of teams', '#% de los equipos · # equipos': '#% of teams · # teams',
    '# nueva': '# new', '# nuevas': '# new', 'Importando # de #…': 'Importing # of #…', '# importada': '# imported', '# importadas': '# imported', 'Sets (#)': 'Sets (#)', 'Team Box (#)': 'Team Box (#)', 'Mi PC (#)': 'My PC (#)',
    'Calculando los repartos… #%': 'Calculating spreads… #%', '# de # tiradas lo dejan KO de un golpe.': '# of # rolls OHKO it.', '# de # tiradas lo dejan KO de un golpe (con golpe crítico).': '# of # rolls OHKO it (with a critical hit).',
    'Tirada # de #': 'Roll # of #',
    '#% de victorias': '#% wins', 'Opción #': 'Option #', 'Arrastra para cambiar el ancho': 'Drag to change the width', 'Equipo rival (en gris, los que no salieron)': 'Rival team (greyed out: not brought)',
    'GXE del ladder de Showdown (probabilidad de ganar a un rival cualquiera)': 'Showdown ladder GXE (chance of beating a random opponent)', 'Tu lead': 'Your lead',
    'lo que está en gris cursiva no sale en el PDF hasta que lo escribas. Cada parte sale en el PDF: quítala con el ojo (👁) o con × si no la quieres.': 'grey italic text is not in the PDF until you write it. Every part goes in the PDF: remove it with the eye (👁) or with × if you do not want it.',
    'Tu equipo': 'Your team', '# de victorias': '# wins', 'Optimizador: Equilibrado, contra # rivales.': 'Optimizer: Balanced, against # rivals.',
    'mejor +# · peor -#': 'best +# · worst -#', 'mejor +# · peor #': 'best +# · worst #', 'ladder · #–#': 'ladder · #–#', 'Partidas (#)': 'Matches (#)',
    'Torneos: # equipos de # torneos (Limitless, # días) · Smogon: #-#, #+': 'Tournaments: # teams from # tournaments (Limitless, # days) · Smogon: #-#, #+',
    'Torneos: # equipos de # torneos (Limitless, # días)': 'Tournaments: # teams from # tournaments (Limitless, # days)', 'Smogon: #-#, #+': 'Smogon: #-#, #+',
    'y # más': 'and # more', '· máximo # por característica': '· max # per stat', '· # equipos de los últimos # días (Limitless) · pulsa para ponerlo': '· # teams from the last # days (Limitless) · click to set it',
    '# set guardado en Mi PC.': '# set saved to My PC.', '# sets guardados en Mi PC.': '# sets saved to My PC.', 'Guardado (# Pokémon).': 'Saved (# Pokémon).',
    'Top # de # torneos online de los últimos # días (Limitless) · # equipos': 'Top # of # online tournaments from the last # days (Limitless) · # teams',
    '# tuyas × # suyas · las # mejores': '# yours × # theirs · the best #', 'Hasta # %': 'Up to # %', 'Página # de #': 'Page # of #',
    'Listo (# archivos copiados). Reiniciando…': 'Done (# files copied). Restarting…', 'Listo (# archivo copiados). Reiniciando…': 'Done (# file copied). Restarting…', '# golpes': '# hits', 'Página # de # ': 'Page # of # ', 'Bo3 #–#': 'Bo3 #–#', '# KO': '# KO', 'T#': 'T#', '# partida · #%': '# match · #%'
  });

  /* ---------- trozos dentro de textos más largos (frases con nombres o números) ---------- */
  const PH = [
    ['guardada al jugar', 'saved while playing'], ['perdió por tiempo', 'lost on time'], ['abandonó', 'forfeited'], [' · importada', ' · imported'],
    ['Si el rival hace:', 'If the rival does:'],
    ['Sus movimientos:', 'Moves:'], ['en el campo', 'on the field'], ['clic derecho: sacarlo al campo o retirarlo', 'right click: put it on the field or take it off'], ['de victorias', 'wins'],
    ['usa', 'uses'], ['le queda', 'left:'], ['frente a', 'vs'], ['Editar', 'Edit'], ['Añadir', 'Add'], ['ya está en tu PC', 'is already in your PC'],
    ['Tu sesión:', 'Your session:'], ['Ningún KO', 'No KO'], ['pierdes', 'you lose'], ['Tu PC está vacío.', 'Your PC is empty.'],
    ['Añade sets con «Añadir sets», o guárdalos desde el Teambuilder y la Calculadora (botón «Guardar en Mi PC» del editor).', 'Add sets with «Add sets», or save them from the Teambuilder and the Calculator («Save to My PC» button in the editor).'],
    ['partidas con él', 'matches with it'], ['partidas guardadas', 'matches saved'], ['guardadas hoy', 'saved today'],
    ['(+Atq', '(+Atk'], ['(+AtE', '(+SpA'], ['(+Def', '(+Def'], ['(+DfE', '(+SpD'], ['(+Vel', '(+Spe'], ['−Atq)', '−Atk)'], ['−AtE)', '−SpA)'], ['−Def)', '−Def)'], ['−DfE)', '−SpD)'], ['−Vel)', '−Spe)'], ['(neutra)', '(neutral)'],
    ['PS ·', 'HP ·'], ['Atq ·', 'Atk ·'], ['AtE ·', 'SpA ·'], ['DfE ·', 'SpD ·'], ['· Vel', '· Spe'], ['sin puntos', 'no points'], ['de los equipos', 'of teams'], ['torneos online de los últimos', 'online tournaments from the last'], ['de KO en', 'chance to KO in'],
    ['se mueve antes', 'moves first'], ['Velocidad:', 'Speed:'], ['con Pañuelo', 'with Scarf'], ['con Viento Afín', 'with Tailwind'], ['partidas identificadas', 'identified matches'], ['partida identificada', 'identified match'],
    ['partidas con él', 'matches with it'], ['guardadas hoy', 'saved today'], ['guardada hoy', 'saved today'], ['combates abiertos', 'open battles'], ['combate abierto', 'open battle'], ['Captura activa', 'Capture on'],
    ['Sets del rival sin datos: los más usados en Smogon', 'Unknown rival sets: the most used on Smogon'], 
    ['de KO en', 'chance to KO in'], ['de KO', 'chance to KO'], ['KO seguro en', 'guaranteed KO in'], ['KO seguro', 'guaranteed KO'], ['KO posible en', 'possible KO in'], ['KO posible', 'possible KO'], ['KO en', 'KO in'], 
    ['le quedan', 'it has'], ['Le quedan', 'It has'], ['de PS', 'HP left'], ['de 16 tiradas lo dejan KO de un golpe', 'of 16 rolls OHKO it'], 
    ['se protege', 'protects itself'], ['retrocede: no ataca', 'flinches: no attack'], ['no le afecta', 'not affected'], ['CAE', 'FAINTS'], ['no queda objetivo', 'no target left'], ['falla (no es su primer turno)', 'fails (not its first turn)'],
    ['cuenta desde el turno siguiente', 'counts from next turn'], ['el orden cambia el turno siguiente', 'order changes next turn'], 
    ['pierdes', 'you lose'], ['peor caso:', 'worst case:'], ['tuyas', 'yours'], ['suyas', 'theirs'], ['las 40 mejores', 'the best 40'], ['Viento Afín tuyo', 'your Tailwind'], ['Viento Afín rival', 'rival Tailwind'],
    ['tus 4 mejores jugadas (por su peor caso) y las 3 respuestas del rival que más te duelen', 'your 4 best plays (by worst case) and the 3 rival answers that hurt you most'], ['los que caen no se sustituyen', 'fainted ones are not replaced'],
    ['sesiones (una sesión acaba tras 45 min sin jugar).', 'sessions (a session ends after 45 min without playing).'],
    ['Después de perder te cuesta: ganas', 'After losing it gets harder: you win'], ['tras ganar,', 'after a win,'], ['Una pausa corta puede ayudar.', 'A short break may help.'], ['En sesiones largas bajas:', 'You drop in long sessions:'],
    ['desde la 6.ª partida frente a', 'from the 6th match vs'], ['en las primeras', 'in the first ones'], ['Tu mejor hora:', 'Your best time:'], ['rinde más abriendo', 'does better leading'], ['rinde más desde atrás', 'does better from the back'],
    ['rinde igual abriendo que desde atrás', 'does the same leading or from the back'], ['Tu lead más usado,', 'Your most used lead,'], ['gana el', 'wins'], ['Lo que más te cuesta:', 'What you struggle with most:'], 
    ['Hay movimientos que nunca usas: quizá te sirva más otro.', 'There are moves you never use: maybe another one helps more.'], ['Tus leads contra', 'Your leads against'], ['Visto en', 'Seen in'],
    ['sin identificar: no sé qué jugador eras. Pon tu usuario de Showdown en el Teambuilder o en Ajustes.', 'unidentified: I do not know which player you were. Set your Showdown username in the Teambuilder or Settings.'],
    ['de los equipos', 'of teams'], ['Más llevados en torneos', 'Most used in tournaments'], ['torneos online de los últimos', 'online tournaments from the last'],
    ['Bo3 vs', 'Bo3 vs'], ['match Bo3', 'Bo3 match'], ['matches Bo3', 'Bo3 matches'], ['win % de sets', 'set win %'], ['pulsa una para ver el detalle', 'click one to see details'], ['Pulsa G1, G2 o G3 para ver su partida, o el match para ver sus rondas y notas.', 'Click G1, G2 or G3 to see its match, or the match to see its rounds and notes.'],
    ['= tiene replay en Showdown.', '= has a replay on Showdown.'], ['Sets incompletos: este match no trae hoja de equipo; en cada partida ves lo que usó.', 'Incomplete sets: this match has no team sheet; each match shows what they used.'],
    ['% = tus victorias en las partidas donde aparece.', '% = your wins in matches where it appears.'], ['Verde ≥55 % y rojo ≤45 % solo con 3 partidas o más.', 'Green ≥55% and red ≤45% only with 3 matches or more.'], ['"Tus Pokémon" cuenta los que salieron al combate.', '"Your Pokémon" counts those brought to battle.'],
    ['No se pudieron leer:', 'Could not read:'], ['Importando', 'Importing'],
    ['sin sesión', 'no session'], ['Sin sesión', 'No session'], ['Pulsa para cambiar a otra o crear una nueva.', 'Click to switch to another or create a new one.'],
    ['Descargando la versión', 'Downloading version'], 
    ['Añadida:', 'Added:'], ['Showdown se ha recargado para usarla.', 'Showdown has been reloaded to use it.'], ['archivos copiados', 'files copied'], ['Reiniciando…', 'Restarting…'], 
    ['Buscando una partida de la Reg M-C con', 'Searching a Reg M-C battle with'], ['Ese es tu equipo, en la carpeta «Macar Showdown» de Showdown:', 'That is your team, in the «Macar Showdown» folder of Showdown:'], ['No se ha podido llevar el equipo a Showdown:', 'Could not send the team to Showdown:'], ['No se ha podido buscar la partida:', 'Could not search a battle:'],
    ['Sin datos de uso (¿sin conexión?). El rival sale sin puntos hasta que lo edites.', 'No usage data (offline?). The rival has no points until you edit it.'],
    ['Control de velocidad:', 'Speed control:'], ['Redirección:', 'Redirection:'], ['Intimidación:', 'Intimidate:'], ['Sin Protección:', 'No Protect:'], ['Objeto repetido (no se puede en VGC):', 'Duplicate item (not allowed in VGC):'],
    ['Varias Megapiedras: solo megaevoluciona uno por combate', 'Several Mega Stones: only one Mega Evolves per battle'], ['Debilidad compartida:', 'Shared weakness:'], ['Sin supereficaz contra:', 'No super effective against:'],
    ['débiles', 'weak'], ['débil', 'weak'], ['resisten', 'resist'], ['resiste', 'resists'], ['inmunes', 'immune'], ['inmune', 'immune'],
    ['Con Pañuelo', 'With Scarf'], ['Te mueves antes', 'You move first'], ['Él se mueve antes', 'It moves first'], 
    ['Optimizador:', 'Optimizer:'], ['El mejor reparto de cada uno (prioridad', 'The best spread for each one (priority'], ['Revisa y cópialo a Showdown o ponlo en tu equipo.', 'Check it and copy it to Showdown or put it on your team.'],
    ['Documento de preparación', 'Prep document'], ['Lo que más te encuentras:', 'What you face most:'], ['Cómo te suelen abrir:', 'How they usually lead:'], ['Equipo rival:', 'Rival team:'],
    ['Añade equipos rivales en Mi PC → Team Box (o juega partidas con este equipo) y aquí salen sus matchups con tu récord, con qué ganas y sus replays.', 'Add rival teams in My PC → Team Box (or play matches with this team) and their matchups appear here with your record, what you win with and their replays.'],
    ['Cargado de Mi PC:', 'Loaded from My PC:'], ['No conozco:', 'Unknown:'], ['Desconocidos:', 'Unknown:'], ['No reconocidos', 'Not recognised'], 
    ['jugadores', 'players'], ['De un rival', "A rival's"], 
    ['Habilidades:', 'Abilities:'], ['neutra', 'neutral'], ['sin puntos', 'no points'], ['Puntos (SP)', 'Points (SP)'], 
    ['En combate', 'In battle']
  ];
  // Más largos primero, y como palabras enteras.
  PH.sort((a, b) => b[0].length - a[0].length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const PHRE = PH.map(([a, b]) => [new RegExp(`(^|[^\\p{L}])${esc(a)}(?=$|[^\\p{L}])`, 'gu'), b]);
  // Frases con números: la clave lleva # donde va cada número.
  const NUM = /\d+(?:[.,]\d+)?/g;
  const DN = {};
  for (const [k, v] of Object.entries(D)) if (/#/.test(k)) DN[k] = v;

  const RX = [
    [/\(ganas ([\d.,]+)% en (\d+)\)/g, '(you win $1% in $2)'],
    [/(\d+) partidas\b/g, '$1 matches'], [/(\d+) partida\b/g, '$1 match'], [/\ben (\d+) (matches|match)\b/g, 'in $1 $2'], [/(\d+) turnos\b/g, '$1 turns'], [/(\d+) equipos\b/g, '$1 teams'],
    [/(\d+) jugadores\b/g, '$1 players'], [/(\d+) torneos\b/g, '$1 tournaments'], [/(\d+) días\b/g, '$1 days'], [/(\d+) golpes\b/g, '$1 hits'], [/(\d+) sesiones\b/g, '$1 sessions'],
    [/(\d+) rivales\b/g, '$1 rivals'], [/(\d+) PS\b/g, '$1 HP'], [/(\d+) Atq\b/g, '$1 Atk'], [/(\d+) AtE\b/g, '$1 SpA'], [/(\d+) DfE\b/g, '$1 SpD'], [/(\d+) Vel\b/g, '$1 Spe'], [/(\d+) guardadas?\b/g, '$1 saved'], [/(\d+) nuevas?\b/g, '$1 new'], [/\bTurno (\d+)/g, 'Turn $1'], [/\bturno (\d+)/g, 'turn $1'], [/(\d+) t\b/g, '$1 t']
  ];
  function tr(text) {
    if (lang !== 'en' || !text) return text;
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2];
    if (!core || !/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(core)) return text;
    if (D[core] != null) return m[1] + D[core] + m[3];
    // Con números
    const nums = core.match(NUM);
    if (nums) { const key = core.replace(NUM, '#'); if (D[key] != null) { let i = 0; return m[1] + D[key].replace(/#/g, () => nums[i++]) + m[3]; } }
    // Trozos
    let out = core;
    for (const [re, b] of PHRE) out = out.replace(re, (all, pre) => pre + b);
    for (const [re, b] of RX) out = out.replace(re, b);
    return m[1] + out + m[3];
  }
  /* títulos de página (dos colores) */
  const H1 = { 'Partidas': ['Mat', 'ches'], 'Ajustes': ['Sett', 'ings'], 'Mi PC': ['My ', 'PC'], 'Documento de preparación': ['Prep ', 'document'], 'Optimizador SP': ['SP ', 'Optimizer'] };
  const SKIP = '.dcontent, textarea, [contenteditable], webview, .dcalc, .dcalcprev, script, style, .nolang, #opTxt, .pastebox textarea';
  function trNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentElement;
      if (!p || p.closest(SKIP)) return;
      const v = tr(n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
    } else if (n.nodeType === 1) {
      if (n.tagName === 'H1' && H1[n.textContent.trim()]) { const [x, y] = H1[n.textContent.trim()]; n.innerHTML = `${x}<span>${y}</span>`; return; }
      if (n.matches && n.matches(SKIP) && n.tagName !== 'TEXTAREA') return;
      for (const a of ['title', 'placeholder', 'aria-label']) if (n.hasAttribute && n.hasAttribute(a)) { const v = tr(n.getAttribute(a)); if (v !== n.getAttribute(a)) n.setAttribute(a, v); }
      if (n.tagName === 'TEXTAREA' || n.tagName === 'INPUT') return;
      for (const c of n.childNodes) trNode(c);
    }
  }
  /** Traducir un trozo de HTML (para lo que se guarda, como el documento al montarlo). */
  function trHTML(html) {
    if (lang !== 'en') return html;
    const t = document.createElement('template');
    t.innerHTML = html;
    const walk = n => { if (n.nodeType === 3) n.nodeValue = tr(n.nodeValue); else n.childNodes.forEach(walk); };
    t.content.childNodes.forEach(walk);
    return t.innerHTML;
  }
  if (lang === 'en') {
    const start = () => {
      trNode(document.body);
      new MutationObserver(list => {
        for (const r of list) {
          if (r.type === 'characterData') trNode(r.target);
          else if (r.type === 'attributes') { if (!r.target.closest || !r.target.closest(SKIP)) { const v = tr(r.target.getAttribute(r.attributeName)); if (v !== r.target.getAttribute(r.attributeName)) r.target.setAttribute(r.attributeName, v); } }
          else r.addedNodes.forEach(trNode);
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder'] });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    // Avisos del sistema (confirmar).
    const c = window.confirm.bind(window);
    window.confirm = msg => c(tr(String(msg)));
    D['¿Borrar el vídeo de esta partida?'] = 'Delete the video of this match?';
    D['¿Borrar esta partida?'] = 'Delete this match?';
    D['Se monta con tus datos de ahora y se pierden tus cambios. ¿Seguir?'] = 'It is rebuilt with your current data and your changes are lost. Continue?';
    D['¿Quitar este bloque?'] = 'Remove this block?';
  }
  function setLang(v) { try { localStorage.setItem('msLang2', v === 'en' ? 'en' : 'es'); } catch (e) { /* nada */ } location.reload(); }
  return { lang, tr, trHTML, setLang, t: tr };
})();
