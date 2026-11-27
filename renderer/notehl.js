'use strict';
/*
 * Macar Showdown · notas con marcas de turno en color.
 * Un textarea normal (se escribe igual) con una capa detrás que pinta cada línea: la marca de turno y lo que
 * pasó ("[T1] Kingambit entra:") en amarillo y lo que escribes tú en blanco. Las de análisis, en rojo (mal hecho) o verde (bien hecho).
 */
/* global esc, Stats */

const NoteHL = (() => {
  const RX = /^(\s*\[T\d+\](?:[^:\n]*:)?)(.*)$/i;
  // Notas de análisis («[T5] Macro: …» o «Macro: …»): en rojo lo mal hecho y en verde lo bien hecho, la línea entera.
  const tag = l => (typeof Stats !== 'undefined' && Stats.tagOf ? Stats.tagOf(l) : null);
  function paint(text) {
    return String(text || '').split('\n').map(l => {
      const a = tag(l);
      if (a) { const i = l.indexOf(':') + 1; return `<span class="nhlan ${a.good ? 'good' : 'bad'}"><span class="nhlak">${esc(l.slice(0, i))}</span>${esc(l.slice(i))}</span>`; }
      const m = l.match(RX);
      return m ? `<span class="nhltag">${esc(m[1])}</span>${esc(m[2])}` : esc(l);
    }).join('\n') + '\n';
  }
  /** Envuelve el textarea (una vez) y lo deja pintado. */
  function wrap(ta) {
    if (!ta) return;
    if (!ta.__nhl) {
      const box = document.createElement('div');
      box.className = 'nhl';
      ta.parentNode.insertBefore(box, ta);
      const back = document.createElement('div');
      back.className = 'nhlback';
      back.setAttribute('aria-hidden', 'true');
      box.appendChild(back);
      box.appendChild(ta);
      ta.classList.add('nhlta');
      ta.__nhl = back;
      const copy = () => {
        const cs = getComputedStyle(ta);
        for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'tabSize']) back.style[k] = cs[k];
      };
      copy();
      ta.addEventListener('input', () => sync(ta));
      ta.addEventListener('scroll', () => { back.scrollTop = ta.scrollTop; });
      new ResizeObserver(() => { copy(); back.scrollTop = ta.scrollTop; }).observe(ta);
    }
    sync(ta);
  }
  function sync(ta) {
    if (!ta || !ta.__nhl) return;
    ta.__nhl.innerHTML = paint(ta.value);
    ta.__nhl.scrollTop = ta.scrollTop;
  }
  return { wrap, sync, paint };
})();
