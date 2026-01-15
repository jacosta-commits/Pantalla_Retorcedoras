// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onModbusData: (callback) => ipcRenderer.on('modbus-data', callback),
  onSqlData: (callback) => ipcRenderer.on('sql-data', callback)
});
