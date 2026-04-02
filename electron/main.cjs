const { app, BrowserWindow, globalShortcut, ipcMain, session } = require('electron')
const path = require('path')
const http = require('http')

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

  // Auto-grant camera/microphone permissions for proctoring
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'display-capture', 'fullscreen']
    if (allowed.includes(permission)) {
      console.log('[ARGUS] Auto-granted permission:', permission)
      callback(true)
    } else {
      callback(false)
    }
  })

  // In development load Vite dev server
  if (process.env.NODE_ENV === 'development') {
    // Try port 8080 first, then fallback to 8081
    detectPort(8080).then((port) => {
      const url = `http://localhost:${port}/argus/index.html`
      console.log('[ARGUS] Loading:', url)
      mainWindow.loadURL(url)
    })
    // Uncomment to debug:
    mainWindow.webContents.openDevTools()
  } else {
    // In production load built ARGUS page
    mainWindow.loadFile(
      path.join(__dirname, '../dist/argus/index.html')
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

// Helper: detect which port the Vite dev server is on
function detectPort(preferredPort) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${preferredPort}`, () => {
      resolve(preferredPort)
    })
    req.on('error', () => {
      // Try next port
      const nextPort = preferredPort + 1
      const req2 = http.get(`http://localhost:${nextPort}`, () => {
        resolve(nextPort)
      })
      req2.on('error', () => {
        // Fallback to preferred
        resolve(preferredPort)
      })
    })
  })
}

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
