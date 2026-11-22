/*
 * Macar Showdown · transcripción de una partida a partir de su registro de Showdown.
 * Turno a turno: quién entra, quién usa qué movimiento contra quién y qué pasa (daño en %, KO, subidas y bajadas,
 * crítico, eficacia, protección, estados, curas, objetos, clima, campo y Viento Afín). Sirve en la interfaz y en Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Transcript = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const STAT = { atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DfE', spe: 'Vel', accuracy: 'Prec.', evasion: 'Evas.' };
  const who = s => String(s || '').replace(/^(p\d)[a-z]?:\s*/, '$1: ');
  const sideOf = s => String(s || '').slice(0, 2);
  const fromOf = parts => { const f = parts.find(x => /^\[from\]/.test(x)); return f ? f.replace(/^\[from\]\s*(item:|ability:|move:)?\s*/, '') : ''; };

  function parse(log) {
    const lines = String(log || '').split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.startsWith('|'));
    const species = {}, hp = {};
    const turns = [{ turn: 0, ev: [] }];
    let last = null; // último movimiento: los efectos siguientes van con él
    const cur = () => turns[turns.length - 1];
    const mon = s => ({ side: sideOf(s), sp: species[who(s)] || who(s).split(': ')[1] || '' });
    const pctOf = v => { const m = String(v || '').match(/^(\d+)(?:\/(\d+))?/); if (!m) return null; if (/fnt/.test(v)) return 0; return m[2] ? (+m[1] / +m[2]) * 100 : +m[1]; };
    const push = e => { cur().ev.push(e); return e; };
    const fx = (e, target) => { if (last && !e.standalone) { last.fx.push({ ...e, target }); } else push({ k: 'fx', ...e, target }); };

    for (const line of lines) {
      const p = line.split('|');
      const cmd = p[1];
      switch (cmd) {
        case 'turn': turns.push({ turn: +p[2] || turns.length, ev: [] }); last = null; break;
        case 'switch': case 'drag': case 'replace': {
          const k = who(p[2]);
          species[k] = String(p[3] || '').split(',')[0];
          const h = pctOf(p[4]); if (h != null) hp[k] = h;
          push({ k: 'switch', who: mon(p[2]), hp: hp[k], drag: cmd === 'drag' });
          last = null;
          break;
        }
        case 'detailschange': case '-formechange': { const k = who(p[2]); species[k] = String(p[3] || '').split(',')[0]; break; }
        case '-mega': push({ k: 'mega', who: mon(p[2]), stone: p[4] || '' }); break;
        case 'move': {
          const tgt = p[4] && /^p\d/.test(p[4]) ? mon(p[4]) : null;
          last = push({ k: 'move', who: mon(p[2]), move: p[3], tgt, fx: [], miss: p.includes('[miss]'), still: p.includes('[still]') });
          break;
        }
        case 'cant': push({ k: 'cant', who: mon(p[2]), why: String(p[3] || '').replace(/^move:\s*/, '') }); last = null; break;
        case '-damage': case '-heal': {
          const k = who(p[2]), before = hp[k] != null ? hp[k] : 100, after = pctOf(p[3]);
          if (after == null) break;
          hp[k] = after;
          const from = fromOf(p.slice(4));
          const e = { t: cmd === '-damage' ? 'dmg' : 'heal', who: mon(p[2]), d: Math.round((after - before) * 10) / 10, left: Math.round(after * 10) / 10, from };
          if (from && cmd === '-damage') { push({ k: 'fx', ...e }); } else if (cmd === '-heal' && from) { push({ k: 'fx', ...e }); } else fx(e);
          break;
        }
        case 'faint': fx({ t: 'faint', who: mon(p[2]) }); break;
        case '-boost': case '-unboost': {
          const n = (+p[4] || 0) * (cmd === '-unboost' ? -1 : 1), from = fromOf(p.slice(5));
          const e = { t: 'boost', who: mon(p[2]), stat: STAT[p[3]] || p[3], n, from };
          if (from) push({ k: 'fx', ...e }); else fx(e);
          break;
        }
        case '-crit': fx({ t: 'crit', who: mon(p[2]) }); break;
        case '-supereffective': fx({ t: 'se', who: mon(p[2]) }); break;
        case '-resisted': fx({ t: 'res', who: mon(p[2]) }); break;
        case '-immune': fx({ t: 'imm', who: mon(p[2]) }); break;
        case '-miss': fx({ t: 'miss', who: mon(p[3] || p[2]) }); break;
        case '-fail': fx({ t: 'fail', who: mon(p[2]) }); break;
        case '-activate': {
          const what = String(p[3] || '').replace(/^(move|ability|item):\s*/, '');
          if (/Protect|Detect|Spiky Shield|King's Shield|Baneful Bunker|Silk Trap|Burning Bulwark|Obstruct|Wide Guard|Quick Guard/.test(what)) fx({ t: 'protect', who: mon(p[2]), what });
          else if (what) push({ k: 'fx', t: 'note', who: mon(p[2]), what });
          break;
        }
        case '-status': fx({ t: 'status', who: mon(p[2]), st: p[3] }); break;
        case '-enditem': push({ k: 'fx', t: 'item', who: mon(p[2]), what: p[3], eat: p.includes('[eat]') }); break;
        case '-item': push({ k: 'fx', t: 'item', who: mon(p[2]), what: p[3] }); break;
        case '-ability': push({ k: 'fx', t: 'ability', who: mon(p[2]), what: p[3] }); break;
        case '-weather': if (!p.includes('[upkeep]') && p[2] !== 'none') push({ k: 'field', what: p[2] }); break;
        case '-fieldstart': push({ k: 'field', what: String(p[2] || '').replace(/^move:\s*/, '') }); break;
        case '-fieldend': push({ k: 'field', what: String(p[2] || '').replace(/^move:\s*/, ''), end: true }); break;
        case '-sidestart': push({ k: 'field', what: String(p[3] || '').replace(/^move:\s*/, ''), side: sideOf(p[2]) }); break;
        case '-sideend': push({ k: 'field', what: String(p[3] || '').replace(/^move:\s*/, ''), side: sideOf(p[2]), end: true }); break;
        case 'win': push({ k: 'win', name: p[2] }); break;
      }
    }
    return turns.filter(t => t.ev.length || t.turn > 0);
  }

  return { parse };
});
