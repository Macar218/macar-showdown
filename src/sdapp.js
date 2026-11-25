'use strict';
/*
 * Macar Showdown · los dos clientes de Showdown.
 * Showdown tiene el cliente de siempre (window.app) y uno nuevo (window.PS, el que sale con /newclient o la
 * cookie preactalpha). Este trozo de JavaScript, que se ejecuta dentro de la página de Showdown, devuelve el
 * cliente cargado con la forma del de siempre (rooms, curRoom, curSideRoom, user.get, send), para que la
 * captura, las notas, la calculadora y la replay lean igual los dos. En los dos, cada sala de combate tiene
 * su `battle` (la misma clase Battle) con `stepQueue`, `request` y `side`.
 */
const SDAPP = `(() => {
  if (window.app && window.app.rooms) return window.app;
  const P = window.PS;
  if (!P || !P.rooms || !P.user) return null;
  const cur = P.room || null;
  const side = [P.leftPanel, P.rightPanel].find(r => r && r !== cur) || null;
  return {
    ps: true,
    rooms: P.rooms,
    curRoom: cur,
    curSideRoom: side,
    user: { get: k => (k === 'name' ? P.user.name : k === 'named' ? !!P.user.named : null), trigger() {} },
    send: (msg, roomid) => P.send(msg, roomid)
  };
})()`;

module.exports = { SDAPP };
