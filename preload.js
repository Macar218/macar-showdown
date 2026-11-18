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
  onChanged: cb => {
    const f = (_e, d) => cb(d);
    ipcRenderer.on('ms:changed', f);
    return () => ipcRenderer.removeListener('ms:changed', f);
  }
});
