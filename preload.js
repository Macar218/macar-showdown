'use strict';
// Lo único que la interfaz puede pedir al proceso principal. Nada de Node en la página.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('macar', {
  list: () => ipcRenderer.invoke('ms:list'),
  get: id => ipcRenderer.invoke('ms:get', id),
  remove: id => ipcRenderer.invoke('ms:delete', id),
  setNotes: (id, text) => ipcRenderer.invoke('ms:notes', id, text),
  settings: () => ipcRenderer.invoke('ms:settings'),
  setSettings: patch => ipcRenderer.invoke('ms:setSettings', patch),
  status: () => ipcRenderer.invoke('ms:status'),
  importFiles: () => ipcRenderer.invoke('ms:importFiles'),
  importUrl: url => ipcRenderer.invoke('ms:importUrl', url),
  openData: () => ipcRenderer.invoke('ms:openData'),
  openExternal: url => ipcRenderer.invoke('ms:openExternal', url),
  live: () => ipcRenderer.invoke('ms:live'),
  usage: tier => ipcRenderer.invoke('ms:usage', tier),
  data: key => ipcRenderer.invoke('ms:data', key),
  setData: (key, value) => ipcRenderer.invoke('ms:setData', key, value),
  matchLog: id => ipcRenderer.invoke('ms:matchLog', id),
  dataDir: () => ipcRenderer.invoke('ms:dataDir'),
  setDataDir: mode => ipcRenderer.invoke('ms:setDataDir', mode),
  fetchPaste: url => ipcRenderer.invoke('ms:fetchPaste', url),
  createPaste: (title, text) => ipcRenderer.invoke('ms:createPaste', title, text),
  savePdf: (html, name) => ipcRenderer.invoke('ms:savePdf', html, name),
  current: () => ipcRenderer.invoke('ms:current'),
  matchExists: id => ipcRenderer.invoke('ms:matchExists', id),
  downloadReplay: id => ipcRenderer.invoke('ms:downloadReplay', id),
  setMatchSession: (id, sid) => ipcRenderer.invoke('ms:setMatchSession', id, sid),
  clearSession: sid => ipcRenderer.invoke('ms:clearSession', sid),
  replayNow: id => ipcRenderer.invoke('ms:replayNow', id),
  tournaments: force => ipcRenderer.invoke('ms:tournaments', force),
  dex: force => ipcRenderer.invoke('ms:dex', force),
  extList: () => ipcRenderer.invoke('ms:extList'),
  extAdd: (kind, value) => ipcRenderer.invoke('ms:extAdd', kind, value),
  extRemove: id => ipcRenderer.invoke('ms:extRemove', id),
  ladder: name => ipcRenderer.invoke('ms:ladder', name),
  updateInstall: () => ipcRenderer.invoke('ms:updateInstall'),
  updateState: () => ipcRenderer.invoke('ms:updateState'),
  onSdZoom: cb => { const f = (_e, z) => cb(z); ipcRenderer.on('ms:sdZoom', f); return () => ipcRenderer.removeListener('ms:sdZoom', f); },
  onUpdate: cb => { const f = (_e, d) => cb(d); ipcRenderer.on('ms:update', f); return () => ipcRenderer.removeListener('ms:update', f); },
  sdAddTeam: (name, text, format) => ipcRenderer.invoke('ms:sdAddTeam', name, text, format),
  sdSearch: (name, text, format) => ipcRenderer.invoke('ms:sdSearch', name, text, format),
  sdCancelSearch: () => ipcRenderer.invoke('ms:sdCancelSearch'),
  onChanged: cb => {
    const f = (_e, d) => cb(d);
    ipcRenderer.on('ms:changed', f);
    return () => ipcRenderer.removeListener('ms:changed', f);
  }
});
