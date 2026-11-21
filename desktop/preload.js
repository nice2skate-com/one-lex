'use strict';
/* Brücke zwischen Oberfläche und Dateisystem. Die Oberfläche bekommt nur diese Funktionen, keinen freien Node-Zugriff. */
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const call = name => (...args) => ipcRenderer.invoke('one:' + name, ...args);
contextBridge.exposeInMainWorld('oneDesktop', {
  paths: call('paths'), pickFolder: call('pickFolder'), pickFiles: call('pickFiles'), scan: call('scan'), expand: call('expand'),
  stat: call('stat'), read: call('read'), write: call('write'), rename: call('rename'),
  readBin: call('readBin'), writeBin: call('writeBin'), list: call('list'), spotifyAuth: call('spotifyAuth'),
  pathOf: file => { try { return webUtils.getPathForFile(file); } catch { return ''; } }
});
