'use strict';
/*
 * Macar Showdown · piezas comunes de Pokémon.
 * Datos del motor de Smogon (Champions = gen 0, nivel 50, puntos SP), sets en formato Showdown,
 * cálculo de daño y velocidad, el editor de un Pokémon y los datos guardados (equipos, Mi PC, documentos).
 * Lo usan la Calculadora, la Multicalc, el Teambuilder, Mi PC, el Optimizador y el Documento.
 */
/* global calc, api, $, $$, esc, spr, closeModal */

/* ---------- datos guardados (en la carpeta de datos: se sincronizan si está en OneDrive) ---------- */
const DB = (() => {
  const cache = {};
  const subs = new Set();
  return {
    async get(key) { if (!(key in cache)) cache[key] = await api.data(key); return cache[key]; },
    async set(key, value) { cache[key] = value; await api.setData(key, value); subs.forEach(f => f(key)); return value; },
    peek: key => cache[key],
    clear() { for (const k of Object.keys(cache)) delete cache[k]; },
    onChange(f) { subs.add(f); }
  };
})();
const newId = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const P = (() => {
  const G = calc.Generations.get(0);
  const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const SL = { hp: 'PS', atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DfE', spe: 'Vel' };
  const PS_STAT = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  const SP_MAX = 32, SP_TOTAL = 66;
  const STATUS = [['', 'Sano'], ['brn', 'Quemado'], ['par', 'Paralizado'], ['psn', 'Envenenado'], ['tox', 'Gravemente env.'], ['slp', 'Dormido'], ['frz', 'Congelado']];
  const WEATHERS = [['', 'Sin clima'], ['Sun', 'Sol'], ['Rain', 'Lluvia'], ['Sand', 'Arena'], ['Snow', 'Nieve'], ['Harsh Sunshine', 'Sol abrasador'], ['Heavy Rain', 'Diluvio']];
  const TERRAINS = [['', 'Sin campo'], ['Electric', 'Eléctrico'], ['Grassy', 'Hierba'], ['Psychic', 'Psíquico'], ['Misty', 'Niebla']];
  const SIDE_FX = [['ref', 'Reflejo'], ['ls', 'Pantalla Luz'], ['veil', 'Velo Aurora'], ['tw', 'Viento Afín'], ['hh', 'Mano Amiga'], ['fg', 'Compiescolta']];
  const TYPES_ES = { Normal: 'Normal', Fire: 'Fuego', Water: 'Agua', Grass: 'Planta', Electric: 'Eléctrico', Ice: 'Hielo', Fighting: 'Lucha', Poison: 'Veneno', Ground: 'Tierra', Flying: 'Volador', Psychic: 'Psíquico', Bug: 'Bicho', Rock: 'Roca', Ghost: 'Fantasma', Dragon: 'Dragón', Dark: 'Siniestro', Steel: 'Acero', Fairy: 'Hada' };
  const TYPES = Object.keys(TYPES_ES);

  const NATURES = [...G.natures].map(n => ({ name: n.name, plus: n.plus, minus: n.minus })).sort((a, b) => a.name.localeCompare(b.name));
  const NAT = Object.fromEntries(NATURES.map(n => [n.name, n]));
  const SPECIES = [...G.species].map(s => s.name).sort();
  // La tabla del motor no trae muchos movimientos de estado: se añaden los habituales en VGC para el autocompletado.
  const STATUS_MOVES = ['Tailwind', 'Trick Room', 'Protect', 'Detect', 'Spiky Shield', 'Baneful Bunker', 'Silk Trap', 'Burning Bulwark', "King's Shield", 'Follow Me', 'Rage Powder', 'Spotlight', 'Ally Switch', 'Helping Hand', 'Wide Guard', 'Quick Guard', 'Spore', 'Sleep Powder', 'Yawn', 'Hypnosis', 'Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Glare', 'Taunt', 'Encore', 'Disable', 'Imprison', 'Haze', 'Clear Smog', 'Reflect', 'Light Screen', 'Aurora Veil', 'Swords Dance', 'Nasty Plot', 'Calm Mind', 'Dragon Dance', 'Bulk Up', 'Quiver Dance', 'Shell Smash', 'Belly Drum', 'Coaching', 'Decorate', 'Howl', 'Iron Defense', 'Amnesia', 'Recover', 'Roost', 'Slack Off', 'Soft-Boiled', 'Moonlight', 'Morning Sun', 'Synthesis', 'Wish', 'Life Dew', 'Pollen Puff', 'Heal Pulse', 'Sunny Day', 'Rain Dance', 'Sandstorm', 'Snowscape', 'Electric Terrain', 'Grassy Terrain', 'Psychic Terrain', 'Misty Terrain', 'Gravity', 'Magic Room', 'Wonder Room', 'Perish Song', 'Substitute', 'Parting Shot', 'Scary Face', 'Charm', 'Feather Dance', 'Screech', 'Fake Tears', 'Metal Sound', 'String Shot', 'Cotton Spore', 'Stun Spore', 'Poison Powder', 'Confuse Ray', 'Swagger', 'Snarl', 'Trick', 'Switcheroo', 'Skill Swap', 'Entrainment', 'Instruct', 'After You', 'Quash', 'Mean Look', 'Leech Seed', 'Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web', 'Defog', 'Rapid Spin', 'Court Change', 'Destiny Bond', 'Memento', 'Healing Wish', 'Lunar Dance', 'Teleport', 'Sketch', 'Transform', 'Shed Tail', 'Tidy Up', 'Victory Dance', 'Shelter', 'Take Heart', 'Jungle Healing', 'Chilly Reception', 'Doodle', 'Lunar Blessing'];
  const MOVES = [...new Set([...[...G.moves].filter(m => m.name && m.name !== '(No Move)').map(m => m.name), ...STATUS_MOVES])].sort();
  const ITEMS = [...G.items].map(i => i.name).sort();
  const spOf = name => G.species.get(toID(name));
  // Datos de un movimiento. Los de estado vienen sin categoría (o ni vienen): se completan aquí, con su prioridad.
  const STATUS_PRIO = { protect: 4, detect: 4, spikyshield: 4, banefulbunker: 4, silktrap: 4, burningbulwark: 4, kingsshield: 4, obstruct: 4, wideguard: 3, quickguard: 3, helpinghand: 5, followme: 2, ragepowder: 2, spotlight: 3, allyswitch: 2, trickroom: -7, magicroom: -7, wonderroom: -7 };
  const moveCache = new Map();
  const moveOf = name => {
    if (!name) return null;
    const id = toID(name);
    if (moveCache.has(id)) return moveCache.get(id);
    let d = G.moves.get(id) || null;
    if (d && !d.category) d = { ...d, category: 'Status', priority: STATUS_PRIO[id] ?? d.priority ?? 0, target: d.target || 'self' };
    if (!d) {
      const known = STATUS_MOVES.find(x => toID(x) === id);
      if (known) {
        let type = 'Normal';
        try { type = new calc.Move(G, known).type || 'Normal'; } catch (e) { /* nada */ }
        d = { name: known, category: 'Status', type, basePower: 0, priority: STATUS_PRIO[id] ?? 0, target: 'self' };
      }
    }
    moveCache.set(id, d);
    return d;
  };
  const nameOf = (table, idOrName) => {
    if (!idOrName) return '';
    const x = G[table].get(toID(idOrName));
    if (x) return x.name;
    if (table === 'moves') { const k = STATUS_MOVES.find(m => toID(m) === toID(idOrName)); if (k) return k; }
    return String(idOrName);
  };
  const natLabel = n => { const x = NAT[n]; return x && x.plus && x.plus !== x.minus ? `${n} (+${SL[x.plus]} −${SL[x.minus]})` : `${n} (neutra)`; };
  const natMult = (n, stat) => { const x = NAT[n]; if (!x || x.plus === x.minus) return 1; return x.plus === stat ? 1.1 : x.minus === stat ? 0.9 : 1; };
  const abilitiesOf = species => { const s = spOf(species); return s && s.abilities ? Object.values(s.abilities) : []; };
  const typesOf = species => { const s = spOf(species); return s ? s.types.slice() : []; };
  const effectiveness = (atkType, defTypes) => defTypes.reduce((m, t) => m * ((G.types.get(toID(atkType)) || { effectiveness: {} }).effectiveness[t] ?? 1), 1);

  /** Nombre que entiende el motor (formas que Showdown escribe distinto). */
  function calcSpecies(name) {
    if (!name) return null;
    if (spOf(name)) return spOf(name).name;
    const base = String(name).split('-')[0];
    if (spOf(base)) return spOf(base).name;
    return null;
  }
  const baseSpecies = name => { const s = spOf(name); return s && s.baseSpecies ? s.baseSpecies : String(name).split('-')[0]; };

  const blankMon = species => {
    const m = { species, item: '', ability: '', nature: 'Hardy', sp: [0, 0, 0, 0, 0, 0], boosts: {}, hp: 100, status: '', moves: ['', '', '', ''], src: 'manual' };
    if (species) m.ability = abilitiesOf(species)[0] || '';
    return m;
  };
  const clone = m => JSON.parse(JSON.stringify(m));
  const cleanSet = m => ({ species: m.species, item: m.item || '', ability: m.ability || '', nature: m.nature || 'Hardy', sp: (m.sp || []).slice(0, 6).map(x => +x || 0), moves: [...(m.moves || []), '', '', '', ''].slice(0, 4), nick: m.nick || '' });

  /* ---------- formato Showdown ---------- */
  function parseSet(block) {
    const lines = String(block || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    let first = lines[0], item = '';
    const at = first.lastIndexOf(' @ ');
    if (at >= 0) { item = first.slice(at + 3).trim(); first = first.slice(0, at).trim(); }
    first = first.replace(/\s*\((M|F)\)\s*$/, '');
    const paren = first.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    const species = calcSpecies((paren ? paren[2] : first).trim());
    if (!species) return { bad: lines[0] };
    const m = blankMon(species);
    if (paren && paren[1]) m.nick = paren[1];
    m.item = item ? nameOf('items', item) : '';
    m.src = 'pegado';
    const mv = [];
    for (const l of lines.slice(1)) {
      let x;
      if ((x = l.match(/^Ability:\s*(.+)$/i))) m.ability = nameOf('abilities', x[1]);
      else if ((x = l.match(/^(EVs|SPs?):\s*(.+)$/i))) {
        for (const part of x[2].split('/')) {
          const y = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
          if (y) { const k = Object.keys(PS_STAT).find(s => PS_STAT[s].toLowerCase() === y[2].toLowerCase()); m.sp[STATS.indexOf(k)] = Math.min(SP_MAX, +y[1]); }
        }
      } else if ((x = l.match(/^(\w+) Nature$/i))) { const n = x[1][0].toUpperCase() + x[1].slice(1).toLowerCase(); m.nature = NAT[n] ? n : 'Hardy'; }
      else if ((x = l.match(/^[-~]\s*(.+)$/))) mv.push(nameOf('moves', x[1].replace(/\s*\[.*\]$/, '')));
    }
    m.moves = [...mv, '', '', '', ''].slice(0, 4);
    return m;
  }
  function parseTeam(text) {
    const sets = [], bad = [];
    for (const block of String(text || '').replace(/\r/g, '').split(/\n\s*\n/)) {
      const b = block.replace(/^===.*$/gm, '').trim();
      if (!b) continue;
      const r = parseSet(b);
      if (!r) continue;
      if (r.bad) bad.push(r.bad); else sets.push(r);
    }
    return { sets, bad };
  }
  function exportSet(m) {
    const sp = STATS.map((s, i) => (m.sp[i] ? `${m.sp[i]} ${PS_STAT[s]}` : '')).filter(Boolean).join(' / ');
    const head = m.nick && m.nick !== m.species ? `${m.nick} (${m.species})` : m.species;
    return [`${head}${m.item ? ` @ ${m.item}` : ''}`, m.ability ? `Ability: ${m.ability}` : '', 'Level: 50', sp ? `EVs: ${sp}` : '', `${m.nature} Nature`, ...m.moves.filter(Boolean).map(x => `- ${x}`)].filter(Boolean).join('\n');
  }
  const exportTeam = sets => sets.map(exportSet).join('\n\n');

  /* ---------- estadísticas ---------- */
  function stats(m) {
    const s = spOf(m.species);
    if (!s) return null;
    const b = s.baseStats, o = {};
    for (let i = 0; i < 6; i++) {
      const k = STATS[i];
      o[k] = i === 0 ? b.hp + 75 + (m.sp[i] || 0) : Math.floor((b[k] + 20 + (m.sp[i] || 0)) * natMult(m.nature, k));
    }
    return o;
  }
  /** De unas estadísticas exactas (las de Showdown) a naturaleza y puntos. */
  function solveSP(species, st, maxhp) {
    const sp = spOf(species);
    if (!sp || !st) return null;
    const b = sp.baseStats;
    let best = null;
    for (const n of NATURES) {
      const out = [0, 0, 0, 0, 0, 0];
      let ok = true;
      if (maxhp) out[0] = Math.max(0, Math.min(SP_MAX, maxhp - b.hp - 75));
      for (let i = 1; i < 6 && ok; i++) {
        const k = STATS[i], mult = natMult(n.name, k);
        let f = -1;
        for (let s = 0; s <= SP_MAX; s++) if (Math.floor((b[k] + 20 + s) * mult) === st[k]) { f = s; break; }
        if (f < 0) ok = false; else out[i] = f;
      }
      if (!ok) continue;
      const tot = out.reduce((a, c) => a + c, 0);
      const neutral = n.plus === n.minus ? 1 : 0;
      if (!best || tot < best.tot || (tot === best.tot && neutral < best.neutral)) best = { nature: n.name, sp: out, tot, neutral };
    }
    return best;
  }

  /* ---------- motor de daño ---------- */
  const blankSide = () => ({ ref: false, ls: false, veil: false, tw: false, hh: false, fg: false });
  const blankField = () => ({ weather: '', terrain: '', tr: false, grav: false, crit: false, me: blankSide(), foe: blankSide() });
  function mkPoke(m) {
    const evs = {}, boosts = {};
    STATS.forEach((s, i) => { evs[s] = (m.sp && m.sp[i]) || 0; if (i) boosts[s] = (m.boosts && m.boosts[s]) || 0; });
    const pk = new calc.Pokemon(G, m.species, {
      level: 50, nature: m.nature || 'Hardy', ability: m.ability || undefined, item: m.item || undefined,
      evs, boosts, status: m.status || '', abilityOn: !!m.abilityOn
    });
    const hp = m.hp == null ? 100 : m.hp;
    if (m.curHP != null) pk.originalCurHP = Math.max(1, Math.min(pk.maxHP(), m.curHP));
    else if (hp < 100) pk.originalCurHP = Math.max(1, Math.floor((pk.maxHP() * hp) / 100));
    return pk;
  }
  const sideObj = x => new calc.Side({ isReflect: !!x.ref, isLightScreen: !!x.ls, isAuroraVeil: !!x.veil, isTailwind: !!x.tw, isHelpingHand: !!x.hh, isFriendGuard: !!x.fg });
  function mkField(f, attSide) {
    f = f || blankField();
    return new calc.Field({
      gameType: 'Doubles', weather: f.weather || undefined, terrain: f.terrain || undefined, isGravity: !!f.grav,
      attackerSide: sideObj(f[attSide] || {}), defenderSide: sideObj(f[attSide === 'me' ? 'foe' : 'me'] || {})
    });
  }
  /** Daño de un movimiento. f = estado del campo; attSide = 'me' o 'foe' (lado del atacante). */
  function damage(att, def, moveName, f, attSide = 'me', opts = {}) {
    if (!moveName) return null;
    const md = moveOf(moveName);
    if (md && md.category === 'Status') return null;
    try {
      const A = mkPoke(att), D = mkPoke(def);
      const mv = new calc.Move(G, moveName, { isCrit: !!(f && f.crit) || !!opts.crit, isSpread: opts.spread });
      const r = calc.calculate(G, A, D, mv, mkField(f, attSide));
      const dmg = r.damage;
      const flat = Array.isArray(dmg) ? (Array.isArray(dmg[0]) ? dmg[0].map((_, i) => dmg.reduce((a, d) => a + d[i], 0)) : dmg) : [dmg];
      const max = D.maxHP(), cur = D.originalCurHP != null ? D.originalCurHP : max;
      const lo = Math.min(...flat), hi = Math.max(...flat);
      let ko = '', kon = 0, koc = 0;
      try { if (hi > 0) { const k = r.kochance(); ko = k.text || ''; kon = k.n || 0; koc = k.chance || 0; } } catch (e) { ko = ''; }
      let desc = '';
      try { desc = r.desc(); } catch (e) { desc = ''; }
      return { lo, hi, max, cur, pLo: (lo / max) * 100, pHi: (hi / max) * 100, ko, kon, koc, desc, cat: mv.category, type: mv.type, rolls: flat, priority: mv.priority || 0, target: mv.target };
    } catch (e) { return { err: e.message }; }
  }
  function speed(m, f, side) {
    try {
      const pk = mkPoke(m);
      let v = pk.rawStats.spe;
      const b = (m.boosts && m.boosts.spe) || 0;
      v = Math.floor(v * (b >= 0 ? (2 + b) / 2 : 2 / (2 - b)));
      const w = f ? f.weather : '', t = f ? f.terrain : '', ab = m.ability, it = m.item;
      if (it === 'Choice Scarf') v = Math.floor(v * 1.5);
      if (it === 'Iron Ball') v = Math.floor(v / 2);
      if ((ab === 'Swift Swim' && /Rain/.test(w)) || (ab === 'Chlorophyll' && /Sun/.test(w)) || (ab === 'Sand Rush' && w === 'Sand') || (ab === 'Slush Rush' && w === 'Snow') || (ab === 'Surge Surfer' && t === 'Electric') || (ab === 'Unburden' && m.abilityOn)) v *= 2;
      if (ab === 'Quick Feet' && m.status) v = Math.floor(v * 1.5); else if (m.status === 'par') v = Math.floor(v / 2);
      if (f && f[side] && f[side].tw) v *= 2;
      return v;
    } catch (e) { return 0; }
  }

  /** Clima y campo que ponen las habilidades de los que están en el campo (el más lento lo pone el último y manda). */
  const WEATHER_AB = { Drought: 'Sun', Drizzle: 'Rain', 'Sand Stream': 'Sand', 'Snow Warning': 'Snow', 'Orichalcum Pulse': 'Sun', 'Desolate Land': 'Harsh Sunshine', 'Primordial Sea': 'Heavy Rain' };
  const TERRAIN_AB = { 'Electric Surge': 'Electric', 'Grassy Surge': 'Grassy', 'Psychic Surge': 'Psychic', 'Misty Surge': 'Misty', 'Hadron Engine': 'Electric' };
  function autoField(mons) {
    const by = mons.filter(Boolean).map(m => ({ m, s: speed({ ...m, boosts: {} }, null, 'me') })).sort((a, b) => b.s - a.s);
    let weather = '', terrain = '';
    for (const { m } of by) { if (WEATHER_AB[m.ability]) weather = WEATHER_AB[m.ability]; if (TERRAIN_AB[m.ability]) terrain = TERRAIN_AB[m.ability]; }
    return { weather, terrain };
  }

  /* ---------- textos y piezas de interfaz ---------- */
  const pct = x => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toString().replace('.', ',');
  const koClass = ko => (/guaranteed OHKO|^OHKO/i.test(ko) ? 'k1' : /OHKO/i.test(ko) ? 'k1p' : /2HKO/i.test(ko) ? 'k2' : /3HKO/i.test(ko) ? 'k3' : '');
  function koEs(ko) {
    return String(ko || '')
      .replace(/guaranteed OHKO/i, 'KO seguro').replace(/guaranteed (\d)HKO/i, 'KO seguro en $1')
      .replace(/([\d.]+)% chance to OHKO/i, (_, p) => `${p.replace('.', ',')}% de KO`)
      .replace(/([\d.]+)% chance to (\d)HKO/i, (_, p, n) => `${p.replace('.', ',')}% de KO en ${n}`)
      .replace(/possible (\d)HKO/i, 'KO posible en $1').replace(/possible OHKO/i, 'KO posible')
      .replace(/(\d)HKO/i, 'KO en $1').replace(/OHKO/i, 'KO')
      .replace(/after ([^,]+)$/i, 'tras $1').replace(/ and /g, ' y ');
  }
  function bar(r) {
    if (!r || r.err || r.hi <= 0) return '<div class="dbar"><i class="left" style="width:100%"></i></div>';
    const cur = (r.cur / r.max) * 100;
    const lo = Math.min(cur, r.pLo), hi = Math.min(cur, r.pHi);
    return `<div class="dbar" title="Le quedan ${pct(cur)}% de PS"><i class="left" style="width:${Math.max(0, cur - hi)}%"></i><i class="maybe" style="width:${hi - lo}%"></i><i class="sure" style="width:${lo}%"></i></div>`;
  }
  function cell(r) {
    if (!r) return '<td class="dm none">—</td>';
    if (r.err) return `<td class="dm none" title="${esc(r.err)}">no calcula</td>`;
    if (r.hi <= 0) return `<td class="dm none" title="${esc(r.desc)}">0%</td>`;
    return `<td class="dm ${koClass(r.ko)}" title="${esc(r.desc)}"><b>${pct(r.pLo)}–${pct(r.pHi)}%</b>${bar(r)}<small>${esc(koEs(r.ko)) || '&nbsp;'}</small></td>`;
  }
  const typeDot = t => `<span class="ty t-${esc(t || '')}" title="${esc(TYPES_ES[t] || t || '')}"></span>`;
  const typeBadge = t => `<span class="tyb t-${esc(t)}">${esc(TYPES_ES[t] || t)}</span>`;
  const spLine = m => STATS.map((s, i) => (m.sp[i] ? `${m.sp[i]} ${SL[s]}` : '')).filter(Boolean).join(' · ') || 'sin puntos';

  /* ---------- sets más usados (Smogon) ---------- */
  const usageCache = new Map();
  function usage(format = '') {
    if (!usageCache.has(format)) usageCache.set(format, api.usage(format).then(r => (r && r.ok && r.sets ? r : null)).catch(() => null));
    return usageCache.get(format);
  }
  function usageOf(U, species) {
    if (!U || !U.sets) return null;
    return U.sets[species] || U.sets[String(species).replace(/-Mega(-[XY])?$/, '')] || U.sets[baseSpecies(species)] || null;
  }
  function usageSet(U, species) {
    const u = usageOf(U, species);
    if (!u) return null;
    const m = blankMon(species);
    m.src = 'uso';
    const sp = u.spreads[0];
    if (sp) { m.nature = NAT[sp.nature] ? sp.nature : 'Hardy'; m.sp = sp.sp.map(x => Math.min(SP_MAX, x || 0)); }
    m.item = u.items[0] ? nameOf('items', u.items[0][0]) : '';
    m.ability = u.abilities[0] ? nameOf('abilities', u.abilities[0][0]) : m.ability;
    m.moves = [...u.moves.slice(0, 4).map(x => nameOf('moves', x[0])), '', '', '', ''].slice(0, 4);
    return m;
  }
  /** Lista ordenada por uso de los Pokémon del formato. */
  const usageRank = U => (U && U.sets ? Object.entries(U.sets).sort((a, b) => b[1].usage - a[1].usage).map(([k]) => k) : []);

  /* ---------- equipos (Team Box) y Mi PC ---------- */
  async function teams() { return (await DB.get('equipos')) || []; }
  async function teamById(id) { return (await teams()).find(t => t.id === id) || null; }
  async function saveTeam(t) {
    const list = (await teams()).slice();
    const i = list.findIndex(x => x.id === t.id);
    const v = { id: t.id || newId('t'), name: String(t.name || 'Equipo').slice(0, 100), notes: String(t.notes || '').slice(0, 5000), side: t.side === 'foe' ? 'foe' : 'me', text: String(t.text || '').slice(0, 20000), up: Date.now() };
    if (i >= 0) list[i] = { ...list[i], ...v }; else list.unshift(v);
    await DB.set('equipos', list);
    return v;
  }
  async function removeTeam(id) { await DB.set('equipos', (await teams()).filter(t => t.id !== id)); }
  async function myTeam() {
    const s = await api.settings();
    const t = s.teamId ? await teamById(s.teamId) : null;
    return t ? { team: t, sets: parseTeam(t.text).sets } : { team: null, sets: [] };
  }
  async function pcList() { return (await DB.get('pc')) || []; }
  async function pcAdd(set, { name = '', notes = '', side = 'me', box = '' } = {}) {
    const list = (await pcList()).slice();
    const text = exportSet(set);
    if (list.some(x => x.text === text && x.side === side)) return { ok: false, why: 'Ese set ya está en tu PC.' };
    const v = { id: newId('s'), name: String(name || '').slice(0, 80), notes: String(notes || '').slice(0, 3000), side, box: String(box || '').slice(0, 40), text, up: Date.now() };
    list.unshift(v);
    await DB.set('pc', list);
    return { ok: true, item: v };
  }

  /* ---------- editor de un Pokémon ---------- */
  function datalists() {
    if ($('#dlSpecies')) return;
    const dl = (id, list) => `<datalist id="${id}">${list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
    document.body.insertAdjacentHTML('beforeend', dl('dlSpecies', SPECIES) + dl('dlMoves', MOVES) + dl('dlItems', ITEMS));
  }
  function statTiles(m) {
    try {
      const st = stats(m);
      return STATS.map((s, i) => `<span class="${natMult(m.nature, s) > 1 ? 'up' : natMult(m.nature, s) < 1 ? 'dn' : ''}"><small>${SL[s]}</small><b>${st[s]}</b><i style="width:${Math.min(100, (m.sp[i] / SP_MAX) * 100)}%"></i></span>`).join('');
    } catch (e) { return ''; }
  }
  /**
   * Abre el editor. opts: { title, set, side ('me'|'foe'), usage (datos de uso), live (muestra PS/estado),
   *   onSave(set), onDelete(), deleteLabel }
   */
  async function openEditor(opts) {
    datalists();
    const m = clone(opts.set || blankMon(''));
    m.boosts = m.boosts || {};
    if (m.hp == null) m.hp = 100;
    const side = opts.side || 'me';
    const U = opts.usage === undefined ? await usage() : opts.usage;
    const PC = await pcList();
    const box = $('#modalBox');
    let msg = '';
    const draw = () => {
      const tot = m.sp.reduce((a, b) => a + b, 0);
      const u = m.species ? usageOf(U, m.species) : null;
      const mine = PC.filter(x => !m.species || toID(baseSpecies((parseSet(x.text) || {}).species || '')) === toID(baseSpecies(m.species)));
      box.innerHTML = `<button class="btn x" id="mClose">Cerrar</button>
        <h2>${esc(opts.title || (m.species ? `Editar ${m.species}` : 'Añadir Pokémon'))} <span class="note">${side === 'me' ? 'tuyo' : 'rival'}</span></h2>
        <div class="edtop">${m.species ? spr(m.species) : ''}<div class="edtypes">${m.species ? typesOf(m.species).map(typeBadge).join('') : ''}</div></div>
        <div class="ed">
          <label class="field">Pokémon<input list="dlSpecies" id="eSp" value="${esc(m.species)}" autocomplete="off" placeholder="Nombre en inglés: Garchomp…"></label>
          <label class="field">Mote<input id="eNick" value="${esc(m.nick || '')}" autocomplete="off"></label>
          <label class="field">Objeto<input list="dlItems" id="eIt" value="${esc(m.item)}" autocomplete="off" placeholder="Sin objeto"></label>
          <label class="field">Habilidad<select id="eAb">${[...new Set([m.ability, ...abilitiesOf(m.species)].filter(Boolean))].map(a => `<option${a === m.ability ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
          <label class="field">Naturaleza<select id="eNat">${NATURES.map(n => `<option value="${n.name}"${n.name === m.nature ? ' selected' : ''}>${esc(natLabel(n.name))}</option>`).join('')}</select></label>
        </div>
        <div class="flabel" style="margin-top:12px">Puntos (SP) · <span class="${tot > SP_TOTAL ? 'errmsg' : ''}">${tot}/${SP_TOTAL}</span> · máximo ${SP_MAX} por característica</div>
        <div class="sps">${STATS.map((s, i) => `<label><small>${SL[s]}</small><input type="number" min="0" max="${SP_MAX}" value="${m.sp[i]}" data-sp="${i}"></label>`).join('')}<button class="btn sm" id="eSp0">A 0</button></div>
        <div class="statl">${m.species ? statTiles(m) : ''}</div>
        <div class="flabel" style="margin-top:12px">Movimientos</div>
        <div class="ed mvs">${m.moves.map((x, i) => `<input list="dlMoves" data-mv="${i}" value="${esc(x)}" autocomplete="off" placeholder="Movimiento ${i + 1}">`).join('')}</div>
        ${opts.live ? `<div class="ed" style="margin-top:12px">
          <label class="field">Estado<select id="eSt">${STATUS.map(([k, l]) => `<option value="${k}"${k === m.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">PS (%)<input type="number" id="eHp" min="0" max="100" value="${Math.round(m.hp)}"></label></div>` : ''}
        ${u ? `<div class="flabel" style="margin-top:14px">Más usados en Smogon <span class="note">· pulsa para ponerlo</span></div><div class="uset">
          <div><small>Repartos</small>${u.spreads.map((s, i) => `<button class="chipbtn" data-spread="${i}">${esc(s.nature)} ${s.sp.join('/')} <em>${String(s.pc).replace('.', ',')}%</em></button>`).join('')}</div>
          <div><small>Objetos</small>${u.items.map(([k, pc]) => `<button class="chipbtn" data-uitem="${esc(nameOf('items', k))}">${esc(nameOf('items', k))} <em>${String(pc).replace('.', ',')}%</em></button>`).join('')}</div>
          <div><small>Habilidades</small>${u.abilities.map(([k, pc]) => `<button class="chipbtn" data-uab="${esc(nameOf('abilities', k))}">${esc(nameOf('abilities', k))} <em>${String(pc).replace('.', ',')}%</em></button>`).join('')}</div>
          <div><small>Movimientos</small>${u.moves.map(([k, pc]) => `<button class="chipbtn" data-umove="${esc(nameOf('moves', k))}">${esc(nameOf('moves', k))} <em>${String(pc).replace('.', ',')}%</em></button>`).join('')}</div></div>` : ''}
        ${mine.length ? `<div class="flabel" style="margin-top:14px">En Mi PC</div><div class="pcpick">${mine.slice(0, 30).map(x => { const s = parseSet(x.text) || {}; return `<button class="chipbtn" data-pc="${esc(x.id)}" title="${esc(x.notes || '')}">${s.species ? spr(s.species, 'xs') : ''}${esc(x.name || s.species || '')}</button>`; }).join('')}</div>` : ''}
        <details class="pastebox"><summary>Pegar o copiar el set (formato Showdown)</summary>
          <textarea id="ePaste" rows="5" placeholder="Pega aquí un Pokémon exportado de Showdown">${esc(m.species ? exportSet(m) : '')}</textarea>
          <div class="row-btns"><button class="btn sm" id="ePasteGo">Usar el texto</button><button class="btn sm" id="eCopy">Copiar</button></div></details>
        <div class="row-btns"><button class="btn" id="ePC">Guardar en Mi PC</button><span class="pcname hide" id="ePCRow"><input id="ePCName" placeholder="Nombre en Mi PC (opcional)" value="${esc(m.nick || '')}"><button class="btn sm primary" id="ePCOk">Guardar</button></span><span class="note" id="eMsg">${esc(msg)}</span>
          <span style="flex:1"></span>${opts.onDelete ? `<button class="btn danger" id="eDel">${esc(opts.deleteLabel || 'Quitar')}</button>` : ''}<button class="btn primary" id="eOk">Guardar</button></div>`;
      $('#mClose').onclick = closeModal;
    };
    const readForm = () => {
      const sp = calcSpecies($('#eSp').value.trim());
      if (sp && sp !== m.species) {
        const prev = m.species;
        m.species = sp;
        if (!prev) {
          const d = (side === 'foe' && usageSet(U, sp)) || blankMon(sp);
          Object.assign(m, { ...d, hp: m.hp, status: m.status, boosts: m.boosts, nick: m.nick });
          return;
        }
        const ab = abilitiesOf(sp); if (!ab.includes(m.ability)) m.ability = ab[0] || '';
      }
      m.nick = $('#eNick').value.trim();
      m.item = $('#eIt').value.trim() ? nameOf('items', $('#eIt').value.trim()) : '';
      if ($('#eAb') && $('#eAb').value) m.ability = $('#eAb').value;
      m.nature = $('#eNat').value;
      $$('[data-sp]', box).forEach(x => { m.sp[+x.dataset.sp] = Math.max(0, Math.min(SP_MAX, Math.round(+x.value || 0))); });
      $$('[data-mv]', box).forEach(x => { m.moves[+x.dataset.mv] = x.value.trim() ? nameOf('moves', x.value.trim()) : ''; });
      if ($('#eSt')) m.status = $('#eSt').value;
      if ($('#eHp')) m.hp = Math.max(0, Math.min(100, +$('#eHp').value || 0));
    };
    const redraw = () => { const f = document.activeElement && document.activeElement.id; draw(); if (f && $(`#${f}`)) $(`#${f}`).focus(); };
    draw();
    box.onchange = e => { if (e.target.id === 'ePaste') return; readForm(); redraw(); };
    box.onclick = async e => {
      const t = e.target.closest('button');
      if (!t) return;
      const u = usageOf(U, m.species);
      if (t.dataset.spread != null) { readForm(); const s = u.spreads[+t.dataset.spread]; m.nature = NAT[s.nature] ? s.nature : m.nature; m.sp = s.sp.map(x => Math.min(SP_MAX, x || 0)); draw(); }
      else if (t.dataset.uitem != null) { readForm(); m.item = t.dataset.uitem; draw(); }
      else if (t.dataset.uab != null) { readForm(); m.ability = t.dataset.uab; draw(); }
      else if (t.dataset.umove != null) { readForm(); if (!m.moves.includes(t.dataset.umove)) { const i = m.moves.indexOf(''); m.moves[i >= 0 ? i : 3] = t.dataset.umove; } draw(); }
      else if (t.dataset.pc != null) { const x = PC.find(y => y.id === t.dataset.pc); const s = x && parseSet(x.text); if (s && !s.bad) { Object.assign(m, s, { hp: m.hp, status: m.status, boosts: m.boosts, src: 'pc' }); msg = `Cargado de Mi PC: ${x.name || s.species}`; draw(); } }
      else if (t.id === 'eSp0') { readForm(); m.sp = [0, 0, 0, 0, 0, 0]; draw(); }
      else if (t.id === 'ePasteGo') {
        const r = parseSet($('#ePaste').value);
        if (!r || r.bad) { $('#eMsg').textContent = r && r.bad ? `No conozco: ${r.bad}` : 'Pega un Pokémon en formato Showdown.'; return; }
        Object.assign(m, r, { hp: m.hp, status: m.status, boosts: m.boosts }); msg = ''; draw();
      } else if (t.id === 'eCopy') { readForm(); navigator.clipboard.writeText(exportSet(m)).then(() => { $('#eMsg').textContent = 'Copiado.'; }).catch(() => { $('#eMsg').textContent = 'No se pudo copiar.'; }); }
      else if (t.id === 'ePC') { $('#ePCRow').classList.remove('hide'); $('#ePCName').focus(); }
      else if (t.id === 'ePCOk') {
        readForm();
        if (!m.species) { $('#eMsg').textContent = 'Elige un Pokémon.'; return; }
        const name = $('#ePCName') ? $('#ePCName').value.trim() : '';
        const r = await pcAdd(cleanSet(m), { name, side });
        draw();
        $('#eMsg').textContent = r.ok ? 'Guardado en Mi PC.' : r.why;
        if (r.ok) PC.unshift(r.item);
      } else if (t.id === 'eDel') { closeModal(); opts.onDelete(); }
      else if (t.id === 'eOk') {
        readForm();
        if (!m.species) { $('#eMsg').textContent = 'Elige un Pokémon.'; return; }
        closeModal();
        opts.onSave(m);
      }
    };
    $('#modal').classList.remove('hide');
    $('#modalBox').scrollTop = 0;
    if (!m.species) $('#eSp').focus();
  }

  return {
    G, toID, STATS, SL, PS_STAT, SP_MAX, SP_TOTAL, STATUS, WEATHERS, TERRAINS, SIDE_FX, TYPES, TYPES_ES,
    NATURES, NAT, SPECIES, MOVES, ITEMS, spOf, moveOf, nameOf, natLabel, natMult, abilitiesOf, typesOf, effectiveness,
    calcSpecies, baseSpecies, blankMon, clone, cleanSet, parseSet, parseTeam, exportSet, exportTeam, stats, solveSP,
    blankSide, blankField, mkPoke, mkField, damage, speed, autoField,
    pct, koClass, koEs, bar, cell, typeDot, typeBadge, spLine,
    usage, usageOf, usageSet, usageRank,
    teams, teamById, saveTeam, removeTeam, myTeam, pcList, pcAdd,
    openEditor, datalists
  };
})();
