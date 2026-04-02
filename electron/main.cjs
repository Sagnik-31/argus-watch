const { app, BrowserWindow, globalShortcut, ipcMain, session } = require('electron')
const path = require('path')
const http = require('http')

let mainWindow
let examEnded = false
let examStarted = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: false,
    kiosk: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    // Show titlebar initially (before exam starts)
    frame: true,
    closable: true
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

  // Prevent window from closing UNLESS exam has ended (only after exam started)
  mainWindow.on('close', (e) => {
    if (examStarted && !examEnded) {
      e.preventDefault()
    }
  })

  // Block ALL keyboard shortcuts
  mainWindow.webContents.on(
    'before-input-event',
    (event, input) => {
      // Only block shortcuts after exam starts
      if (!examStarted || examEnded) return

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

// Handle exam-started IPC — lock into kiosk mode
ipcMain.on('exam-started', () => {
  console.log('[ARGUS] Student accepted disclaimer — entering fullscreen/kiosk mode')
  examStarted = true

  if (mainWindow) {
    // Close DevTools first — docked DevTools blocks fullscreen on macOS
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools()
    }

    mainWindow.setClosable(false)

    // Use setSimpleFullScreen for immediate effect on macOS, then kiosk
    mainWindow.setSimpleFullScreen(true)
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(true)
        mainWindow.setKiosk(true)
        console.log('[ARGUS] Fullscreen + kiosk mode activated')
      }
    }, 300)
  }

  // Register global shortcuts to block system keys
  globalShortcut.register('CommandOrControl+Q', () => {})
  globalShortcut.register('Alt+F4', () => {})
})

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
  // Don't register shortcuts yet — they'll be registered when exam starts
})

// Prevent all windows from closing UNLESS exam ended
app.on('window-all-closed', (e) => {
  if (!examEnded) {
    e.preventDefault()
  }
})
