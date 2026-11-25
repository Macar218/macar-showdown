'use strict';
/*
 * Macar Showdown · tutorial.
 * Un recorrido por la app paso a paso: resalta cada parte (lo demás se oscurece) y explica para qué sirve.
 * Se abre desde la pantalla de inicio o desde Ajustes. Flechas o Intro para avanzar, Esc para salir.
 */
/* global $, esc, show, Start, I18N */

const Tour = (() => {
  const STEPS = [
    { t: 'Macar Showdown en 2 minutos', d: 'Juegas en Showdown dentro de la app y ella guarda cada partida, te deja apuntar notas y calcular daño mientras juegas, y te ayuda a preparar el equipo. Vamos parte por parte.' },
    { sel: '#sessBtn', t: 'Tu sesión', d: 'Las partidas se apuntan en la sesión abierta (un equipo y un objetivo). Pulsa aquí para cambiar de sesión o crear una nueva.' },
    { v: 'jugar', sel: '#sd', t: 'Jugar', d: 'Showdown, tal cual. Juega como siempre: al terminar cada combate la partida se guarda sola, con su registro completo. Con − / + (o Ctrl + / Ctrl −) cambias su tamaño.' },
    { v: 'jugar', sel: '#capState', t: 'Captura', d: 'Aquí ves si la app está leyendo Showdown y cuántas partidas ha guardado hoy. Si pone algo en rojo, recarga Showdown con ⟳.' },
    { v: 'jugar', sel: '#notesBar', t: 'Notas de la partida', d: 'Apunta mientras juegas. «+ Nota del turno» empieza una línea con el turno de ahora ([T5]) en amarillo; luego, en la replay, esa línea salta a ese turno.' },
    { v: 'jugar', sel: '#calcToggle', t: 'Calculadora en directo', d: 'Ábrela con este botón o con Ctrl+K. Sigue el combate: tus Pokémon con sus stats reales y los del rival con su hoja de equipo o los sets más usados. «Más ancha» la abre más.' },
    { v: 'dash', sel: '#v-dash', t: 'Dashboard', d: 'Tus resultados con los mismos filtros en todas las pestañas: Resumen, Partidas, Rivales, Tu equipo y Hábitos. En Partidas filtras por tus marcas (buenas, malas, para analizar, con notas) y abres cada replay.' },
    { v: 'dash', sel: '#v-dash', t: 'Marcar partidas', d: 'Al acabar un Bo3 sale un aviso para marcar cada partida como buena, indiferente o mala y si hay que analizarla. También lo puedes hacer después, al abrir la partida.' },
    { v: 'miequipo', sel: '#v-miequipo', t: 'Tu equipo', d: 'La ficha de cada Pokémon del equipo de tu sesión: stats, objeto, habilidad y movimientos.' },
    { v: 'equipo', sel: '#v-equipo', t: 'Teambuilder', d: 'Crea y cambia equipos: puntos (SP), objeto, habilidad y movimientos. «Llevar mi equipo a Showdown» lo deja en su teambuilder.' },
    { v: 'pc', sel: '#v-pc', t: 'Mi PC', d: 'Tus sets y los de rivales, en cajas. La × encima de un Pokémon lo borra; si te equivocas, Ctrl+Z (o «Deshacer») lo devuelve. Doble clic en el nombre para cambiarlo.' },
    { v: 'calc', sel: '#v-calc', t: 'Calculadora de estudio', d: 'Para preparar: con tu equipo o con los Pokémon que tú elijas, contra equipos rivales, Mi PC o los rivales de tus partidas. Daño, Multicalc y Árbol de jugadas.' },
    { v: 'opt', sel: '#v-opt', t: 'Optimizador SP y Documento', d: 'El optimizador reparte los puntos para sobrevivir o ganar en velocidad a lo que elijas. El documento monta tu preparación y lo puedes sacar en PDF.' },
    { sel: '.nav [data-v="dex"]', t: 'Macar Dex', d: 'La Pokédex, objetos, habilidades, movimientos, tabla de tipos y naturalezas, sin salir de la app.' },
    { sel: '.nav [data-v="ajustes"]', t: 'Ajustes', d: 'Tu usuario de Showdown, el idioma, la carpeta de datos (por ejemplo en OneDrive), las replays y las extensiones. Desde aquí puedes repetir este tutorial.' }
  ];
  let i = 0, el = null, back = '';

  function place() {
    const s = STEPS[i];
    const target = s.sel ? document.querySelector(s.sel) : null;
    const r = target && target.getBoundingClientRect();
    const hole = el.querySelector('.tourhole'), card = el.querySelector('.tourcard');
    if (r && r.width && r.height) {
      const pad = 6;
      Object.assign(hole.style, { display: 'block', left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      el.classList.remove('center');
      // La ficha al lado del hueco donde quepa (derecha, izquierda, debajo, encima), dentro de la ventana.
      const cw = card.offsetWidth, ch = card.offsetHeight, W = window.innerWidth, H = window.innerHeight, g = 16;
      let x, y;
      if (r.right + g + cw < W) { x = r.right + g; y = r.top; }
      else if (r.left - g - cw > 0) { x = r.left - g - cw; y = r.top; }
      else if (r.bottom + g + ch < H) { x = r.left; y = r.bottom + g; }
      else if (r.top - g - ch > 0) { x = r.left; y = r.top - g - ch; }
      else { x = (W - cw) / 2; y = (H - ch) / 2; }
      card.style.left = `${Math.max(12, Math.min(W - cw - 12, x))}px`;
      card.style.top = `${Math.max(12, Math.min(H - ch - 12, y))}px`;
    } else {
      hole.style.display = 'none';
      el.classList.add('center');
      card.style.left = ''; card.style.top = '';
    }
  }

  function paint() {
    const s = STEPS[i];
    if (s.v && typeof show === 'function') show(s.v);
    el.querySelector('.tourcard').innerHTML = `<small>${i + 1} / ${STEPS.length}</small><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p>
      <div class="tourbtns"><button class="btn sm" data-tour="end">Salir</button><span style="flex:1"></span>${i ? '<button class="btn sm" data-tour="prev">◀ Anterior</button>' : ''}<button class="btn sm primary" data-tour="next">${i === STEPS.length - 1 ? 'Terminar' : 'Siguiente ▶'}</button></div>`;
    // Esperar a que la pantalla se pinte antes de medir.
    requestAnimationFrame(() => requestAnimationFrame(place));
  }

  function key(e) {
    if (!el) return;
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (i) { i--; paint(); } }
  }
  function next() { if (i < STEPS.length - 1) { i++; paint(); } else end(); }

  function start() {
    if (el) return;
    try { if (typeof Start !== 'undefined' && Start.hide) Start.hide(); } catch (e) { /* nada */ }
    back = document.querySelector('.view.on') ? document.querySelector('.view.on').id.replace(/^v-/, '') : 'jugar';
    i = 0;
    el = document.createElement('div');
    el.className = 'tour';
    el.innerHTML = '<div class="tourhole"></div><div class="tourcard" role="dialog" aria-label="Tutorial"></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-tour]');
      if (!b) return;
      if (b.dataset.tour === 'next') next();
      else if (b.dataset.tour === 'prev') { i = Math.max(0, i - 1); paint(); }
      else end();
    });
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', place);
    paint();
  }
  function end() {
    if (!el) return;
    el.remove(); el = null;
    document.removeEventListener('keydown', key, true);
    window.removeEventListener('resize', place);
    try { localStorage.setItem('msTourDone', '1'); } catch (e) { /* nada */ }
    if (back && typeof show === 'function') show(back);
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-tourstart]')) start(); });
  return { start, end, steps: STEPS };
})();
