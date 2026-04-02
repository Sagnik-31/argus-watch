const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
  'electronAPI', {
    platform: process.platform,
    startExam: () => ipcRenderer.send('exam-started'),
    endExam: () => ipcRenderer.send('exam-ended')
  }
)
