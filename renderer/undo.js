'use strict';
/*
 * Macar Showdown · deshacer.
 * Antes de borrar o cambiar algo de Mi PC o de tus equipos se guarda una copia de esa colección. Ctrl+Z (fuera de
 * un cuadro de texto, que tiene su propio deshacer) o el botón «Deshacer» del aviso la vuelve a poner.
 */
/* global DB, $, esc, VIEWS, VIEW, Calc */

const Undo = (() => {
  const stack = [];
  let timer = null;

  function toast(html, canUndo) {
    let el = $('#undoToast');
    if (!el) { el = document.createElement('div'); el.id = 'undoToast'; el.className = 'undotoast'; document.body.appendChild(el); }
    el.innerHTML = `${html}${canUndo ? '<button class="btn sm" data-undo="1" title="También con Ctrl+Z">Deshacer</button>' : ''}`;
    el.classList.add('on');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('on'), canUndo ? 7000 : 2500);
  }

  /** Guarda cómo está la colección (pc, equipos) antes de cambiarla. */
  async function snap(key, label) {
    const before = JSON.parse(JSON.stringify((await DB.get(key)) || []));
    stack.push({ key, before, label });
    if (stack.length > 40) stack.shift();
    toast(`<span>${esc(label)}</span>`, true);
  }

  async function undo() {
    const x = stack.pop();
    if (!x) { toast('<span>Nada que deshacer</span>', false); return; }
    await DB.set(x.key, x.before);
    if (x.key === 'equipos' && typeof Calc !== 'undefined') Calc.reloadTeams();
    if (typeof VIEWS !== 'undefined' && VIEWS[VIEW]) VIEWS[VIEW]();
    toast(`<b>Deshecho:</b> <span>${esc(x.label)}</span>`, false);
  }

  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
    const t = e.target;
    if (t && (t.closest('input, textarea, select, [contenteditable="true"], webview'))) return;
    e.preventDefault();
    undo();
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-undo]')) undo(); });

  return { snap, undo };
})();
