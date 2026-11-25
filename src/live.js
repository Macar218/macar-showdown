'use strict';
const { SDAPP } = require('./sdapp');
/*
 * Macar Showdown · combate en directo.
 * Lee del cliente de Showdown (la página del webview) el estado del combate que tienes delante:
 * tus Pokémon (con estadísticas exactas, objetos y movimientos), los del rival (lo que se ha visto),
 * quién está en el campo, PS, niveles de características, clima, campo y pantallas.
 * Solo lee: no toca nada de la página.
 */

const LIVE = `(() => {
  try {
    const a = ${SDAPP};
    if (!a || !a.rooms) return { ok: false, why: 'Showdown aún no ha cargado' };
    const isBattle = r => r && r.battle && Array.isArray(r.battle.stepQueue);
    let room = [a.curRoom, a.curSideRoom].find(isBattle);
    if (!room) {
      // Si no estás mirando un combate, el último que esté abierto y sin terminar.
      for (const id in a.rooms) if (isBattle(a.rooms[id]) && !a.rooms[id].battle.ended) room = a.rooms[id];
    }
    if (!room) return { ok: true, battle: null };
    const b = room.battle;
    const mon = (p, req) => {
      if (!p) return null;
      const o = {
        species: p.speciesForme || p.species || '',
        name: p.name || '',
        level: p.level || 50,
        hp: p.maxhp ? Math.round((p.hp / p.maxhp) * 1000) / 10 : 100,
        fainted: !!p.fainted || p.hp === 0,
        status: p.status || '',
        boosts: Object.assign({}, p.boosts || {}),
        item: p.item || '',
        ability: p.ability || p.baseAbility || '',
        moves: (p.moveTrack || []).map(m => m[0]),
        mega: /-Mega/.test(p.speciesForme || ''),
        ident: p.ident || ''
      };
      if (req) {
        o.exact = true;
        o.stats = req.stats || null;
        o.item = req.item || o.item;
        o.ability = req.ability || req.baseAbility || o.ability;
        o.moves = (req.moves || []).slice();
        const c = String(req.condition || '');
        const m = c.match(/^(\\d+)\\/(\\d+)/);
        if (m) { o.hp = Math.round((+m[1] / +m[2]) * 1000) / 10; o.hpAbs = [+m[1], +m[2]]; }
        if (/ fnt$/.test(c) || c === '0 fnt') o.fainted = true;
        const st = c.split(' ')[1];
        if (st && st !== 'fnt') o.status = st;
      }
      return o;
    };
    const reqMons = (room.request && room.request.side && room.request.side.pokemon) || b.myPokemon || [];
    const findReq = p => reqMons.find(r => r.ident && p.ident && r.ident.replace(/^(p\\d)[a-z]?:/, '$1:') === p.ident.replace(/^(p\\d)[a-z]?:/, '$1:'))
      || reqMons.find(r => String(r.details || '').split(',')[0] === (p.speciesForme || ''));
    const side = (s, mine) => {
      if (!s) return null;
      const team = (s.pokemon || []).map(p => mon(p, mine ? findReq(p) : null));
      // Tus Pokémon que aún no han salido (solo están en la petición del servidor).
      if (mine) for (const r of reqMons) {
        const sp = String(r.details || '').split(',')[0];
        if (!team.some(t => t && (t.ident === r.ident || t.species === sp))) {
          const t = mon({ speciesForme: sp, ident: r.ident, name: String(r.ident || '').replace(/^p\\d[a-z]?: /, '') }, r);
          if (t) team.push(t);
        }
      }
      const active = (s.active || []).map(p => (p ? (s.pokemon || []).indexOf(p) : -1));
      const sc = {};
      for (const k in (s.sideConditions || {})) sc[k] = true;
      // Hoja de equipo abierta (OTS): objeto, habilidad, naturaleza y movimientos de los 6.
      const pre = '|showteam|' + (s.sideid || '') + '|';
      const sl = (b.stepQueue || []).find(l => typeof l === 'string' && l.startsWith(pre));
      return { name: s.name || '', team, active, cond: sc, sheet: sl ? sl.slice(pre.length) : '' };
    };
    const me = b.mySide || b.nearSide || (b.sides && b.sides[0]);
    const foe = (me && me.foe) || b.farSide || (b.sides && b.sides[1]);
    return {
      ok: true,
      battle: {
        id: room.id,
        format: b.tier || '',
        gameType: b.gameType || 'doubles',
        turn: b.turn || 0,
        ended: !!b.ended,
        weather: b.weather || '',
        pseudo: (b.pseudoWeather || []).map(x => x[0]),
        spectator: !b.mySide || !reqMons.length,
        me: side(me, true),
        foe: side(foe, false)
      }
    };
  } catch (e) { return { ok: false, why: String((e && e.message) || e) }; }
})()`;

module.exports = { LIVE };
