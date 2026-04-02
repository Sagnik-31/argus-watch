const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
  'electronAPI', {
    platform: process.platform,
    endExam: () => ipcRenderer.send('exam-ended')
  }
)
