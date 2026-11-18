'use strict';
/*
 * Macar Showdown · replays y vídeo.
 * - Al acabar un combate en el que juegas tú, pide a Showdown que suba la replay (/savereplay) y comprueba
 *   que ya está en replay.pokemonshowdown.com.
 * - Lo que el grabador necesita saber del combate que tienes delante (sin leer nada más de la página).
 */

/** Combate que tienes delante: id de la sala, turno, si ha acabado y si juegas tú. */
const CURRENT = `(() => {
  try {
    const a = window.app;
    if (!a || !a.rooms) return null;
    const isBattle = r => r && r.battle && Array.isArray(r.battle.stepQueue);
    let room = [a.curRoom, a.curSideRoom].find(isBattle);
    if (!room) for (const id in a.rooms) if (isBattle(a.rooms[id]) && !a.rooms[id].battle.ended) room = a.rooms[id];
    if (!room) return null;
    const b = room.battle;
    let fin = b.ended === true;
    const q = b.stepQueue;
    for (let i = q.length - 1; !fin && i >= Math.max(0, q.length - 40); i--) if (/^\\|(win|tie)\\|/.test(q[i])) fin = true;
    const me = b.mySide || null, foe = me && me.foe;
    return {
      id: room.id, turn: b.turn || 0, ended: fin,
      player: !!(room.side || room.request || (b.myPokemon && b.myPokemon.length)),
      me: me ? me.name : '', opp: foe ? foe.name : '', format: b.tier || ''
    };
  } catch (e) { return null; }
})()`;

const SAVE_REPLAY = id => `(() => {
  const a = window.app;
  if (!a || !a.rooms || !a.rooms[${JSON.stringify(id)}]) return false;
  a.send('/savereplay', ${JSON.stringify(id)});
  return true;
})()`;

const replayUrl = roomId => `https://replay.pokemonshowdown.com/${String(roomId).replace(/^battle-/, '')}`;

/** Sube la replay y espera a que exista. Devuelve la URL o null. */
async function uploadReplay(contents, roomId) {
  if (!contents || contents.isDestroyed()) return null;
  let sent = false;
  try { sent = await contents.executeJavaScript(SAVE_REPLAY(roomId), false); } catch (e) { sent = false; }
  if (!sent) return null;
  const url = replayUrl(roomId);
  for (const wait of [4000, 8000, 15000, 30000]) {
    await new Promise(r => setTimeout(r, wait));
    try {
      const r = await fetch(`${url}.json`, { method: 'GET', signal: AbortSignal.timeout(15000) });
      if (r.ok) return url;
    } catch (e) { /* reintenta */ }
  }
  return null;
}

module.exports = { CURRENT, uploadReplay, replayUrl };
