/* The few native helpers the page may use on Windows (the page works the same without them). */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DesktopApp', {
  platform: process.platform,
  toggleFullscreen: on => ipcRenderer.invoke('er:fullscreen', on),
  quit: () => ipcRenderer.invoke('er:quit')
});
