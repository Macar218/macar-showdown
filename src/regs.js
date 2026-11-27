'use strict';
/*
 * Macar Showdown · regulación.
 * La regulación con la que juegas (formato de Showdown, nombre y código de Limitless) se elige en Ajustes.
 * Así, cuando cambie la regulación, basta con elegir la nueva (o escribirla) sin esperar a otra versión.
 */
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Las conocidas. La primera es la de por defecto. */
const REGS = [
  { id: 'gen9championsvgc2026regmc', name: 'Reg M-C', limitless: 'M-C' }
];

/** La regulación de los ajustes (o la de por defecto), siempre limpia. */
function regOf(settings) {
  const r = settings && settings.reg;
  if (r && toID(r.id)) return { id: toID(r.id).slice(0, 80), name: String(r.name || r.id).trim().slice(0, 40) || toID(r.id), limitless: String(r.limitless || '').trim().slice(0, 20) };
  return { ...REGS[0] };
}

module.exports = { REGS, regOf, toID };
