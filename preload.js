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
  savePdf: (html, name) => ipcRenderer.invoke('ms:savePdf', html, name),
  current: () => ipcRenderer.invoke('ms:current'),
  matchExists: id => ipcRenderer.invoke('ms:matchExists', id),
  replayNow: id => ipcRenderer.invoke('ms:replayNow', id),
  recStart: id => ipcRenderer.invoke('ms:recStart', id),
  recChunk: buf => ipcRenderer.send('ms:recChunk', buf),
  recStop: () => ipcRenderer.invoke('ms:recStop'),
  videoFor: id => ipcRenderer.invoke('ms:videoFor', id),
  deleteVideo: id => ipcRenderer.invoke('ms:deleteVideo', id),
  videosDir: () => ipcRenderer.invoke('ms:videosDir'),
  setVideosDir: () => ipcRenderer.invoke('ms:setVideosDir'),
  openVideos: () => ipcRenderer.invoke('ms:openVideos'),
  tournaments: force => ipcRenderer.invoke('ms:tournaments', force),
  updateInstall: () => ipcRenderer.invoke('ms:updateInstall'),
  updateState: () => ipcRenderer.invoke('ms:updateState'),
  onUpdate: cb => { const f = (_e, d) => cb(d); ipcRenderer.on('ms:update', f); return () => ipcRenderer.removeListener('ms:update', f); },
  sdAddTeam: (name, text, format) => ipcRenderer.invoke('ms:sdAddTeam', name, text, format),
  onChanged: cb => {
    const f = (_e, d) => cb(d);
    ipcRenderer.on('ms:changed', f);
    return () => ipcRenderer.removeListener('ms:changed', f);
  }
});
