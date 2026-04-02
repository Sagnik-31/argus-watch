const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron')
const path = require('path')

let mainWindow
let examEnded = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    // Remove default titlebar
    frame: false,
    // Prevent closing
    closable: false
  })

  // In development load Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080')
    // Uncomment to debug:
    mainWindow.webContents.openDevTools()
  } else {
    // In production load built files
    mainWindow.loadFile(
      path.join(__dirname, '../dist/index.html')
    )
  }

  // Prevent window from closing UNLESS exam has ended
  mainWindow.on('close', (e) => {
    if (!examEnded) {
      e.preventDefault()
    }
  })

  // Block ALL keyboard shortcuts
  mainWindow.webContents.on(
    'before-input-event',
    (event, input) => {
      // After exam ends, don't block anything
      if (examEnded) return

      // Block Alt+F4
      if (input.alt && input.key === 'F4') {
        event.preventDefault()
      }
      // Block Cmd+Q on Mac
      if (input.meta && input.key === 'q') {
        event.preventDefault()
      }
      // Block Cmd+W
      if (input.meta && input.key === 'w') {
        event.preventDefault()
      }
      // Block Alt+Tab
      if (input.alt && input.key === 'Tab') {
        event.preventDefault()
      }
    }
  )
}

// Handle exam-ended IPC from renderer
ipcMain.on('exam-ended', () => {
  console.log('[ARGUS] Exam ended — exiting kiosk/fullscreen mode')
  examEnded = true

  if (mainWindow) {
    // Exit kiosk mode
    mainWindow.setKiosk(false)
    // Exit fullscreen
    mainWindow.setFullScreen(false)
    // Re-enable closing
    mainWindow.setClosable(true)
    // Show the frame/titlebar so user can close normally
    // (frame can't be changed at runtime, but closable + non-kiosk is enough)
  }

  // Unregister global shortcuts so user can use their system normally
  globalShortcut.unregisterAll()
})

app.whenReady().then(() => {
  createWindow()

  // Block system shortcuts
  globalShortcut.register(
    'CommandOrControl+Q',
    () => {}
  )
  globalShortcut.register(
    'Alt+F4',
    () => {}
  )
})

// Prevent all windows from closing UNLESS exam ended
app.on('window-all-closed', (e) => {
  if (!examEnded) {
    e.preventDefault()
  }
})
