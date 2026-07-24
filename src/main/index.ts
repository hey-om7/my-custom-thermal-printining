import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import noble from '@stoprocent/noble'
import * as fs from 'fs'

// --- Device Settings Persistence ---
interface DeviceSettings {
  deviceUUID: string
  deviceName: string
  topTrim: number
  feedTrim: number
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'device-settings.json')
}

function loadDeviceSettings(): DeviceSettings | null {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveDeviceSettings(settings: DeviceSettings): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2))
}

function clearDeviceSettings(): void {
  try {
    fs.unlinkSync(getSettingsPath())
  } catch {
    // ignore if doesn't exist
  }
}

function sendToRenderer(channel: string): void {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.send(channel)
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Sketch',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('menu-new')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu-save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('menu-save-as')
        },
        { type: 'separator' },
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendToRenderer('menu-print')
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToRenderer('menu-undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendToRenderer('menu-redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC: BLE deep scan — finds all BLE devices including hidden ones
ipcMain.handle('ble-scan', async (_event, durationMs = 10000) => {
  interface ScannedDevice {
    id: string
    name: string
    rssi: number
    address: string
    serviceUUIDs: string[]
  }

  const devices: ScannedDevice[] = []
  const seenIds = new Set<string>()

  return new Promise<ScannedDevice[]>((resolve) => {
    const onDiscover = (peripheral: noble.Peripheral): void => {
      const id = peripheral.id || peripheral.address || ''
      if (!id || seenIds.has(id)) return
      seenIds.add(id)

      devices.push({
        id,
        name: peripheral.advertisement?.localName || '',
        rssi: peripheral.rssi ?? -100,
        address: peripheral.address || '',
        serviceUUIDs: peripheral.advertisement?.serviceUuids || []
      })
    }

    const finish = (): void => {
      noble.stopScanning()
      noble.removeListener('discover', onDiscover)
      resolve(devices)
    }

    noble.on('discover', onDiscover)

    const startScan = (): void => {
      // allowDuplicates=true to catch hidden devices that don't always advertise
      noble.startScanning([], true)
      setTimeout(finish, durationMs)
    }

    if (noble.state === 'poweredOn') {
      startScan()
    } else {
      noble.once('stateChange', (state: string) => {
        if (state === 'poweredOn') {
          startScan()
        } else {
          resolve([])
        }
      })
      // Safety timeout in case bluetooth never powers on
      setTimeout(() => {
        if (devices.length === 0) finish()
      }, durationMs + 2000)
    }
  })
})

// IPC: Stop BLE scan
ipcMain.handle('ble-scan-stop', async () => {
  noble.stopScanning()
  noble.removeAllListeners('discover')
  return { success: true }
})

// IPC: Device settings
ipcMain.handle('get-device-settings', async () => {
  return loadDeviceSettings()
})

ipcMain.handle('save-device-settings', async (_event, settings: DeviceSettings) => {
  saveDeviceSettings(settings)
  return { success: true }
})

ipcMain.handle('clear-device-settings', async () => {
  clearDeviceSettings()
  return { success: true }
})

// IPC: Print preview — generates the exact processed image as a displayable PNG
ipcMain.handle(
  'preview-print-image',
  async (_event, base64PNG: string, options?: { gapLines?: number }) => {
    try {
      const { generatePreviewPNG } = await import('./printer/image')

      const settings = loadDeviceSettings()
      if (!settings) {
        return { success: false, error: 'No printer configured. Please set up your device in Settings.' }
      }

      const base64Data = base64PNG.replace(/^data:image\/png;base64,/, '')
      const pngBuffer = Buffer.from(base64Data, 'base64')

      // Skip trim when canvas is already sized to printable area (CatPrinter mode)
      const sharp = (await import('sharp')).default
      const meta = await sharp(pngBuffer).metadata()
      const isNativeWidth = meta.width === 384

      const previewBuffer = await generatePreviewPNG(pngBuffer, {
        topTrim: isNativeWidth ? 0 : settings.topTrim,
        feedTrim: isNativeWidth ? 0 : settings.feedTrim,
        gapLines: Math.round(options?.gapLines ?? 0)
      })

      const previewDataURL = `data:image/png;base64,${previewBuffer.toString('base64')}`
      return { success: true, dataURL: previewDataURL }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }
)

// IPC: Print handler — fully native Node.js (no Python dependency)
ipcMain.handle('print-label', async (_event, base64PNG: string, options?: { gapLines?: number }) => {
  try {
    const { printLabel } = await import('./printer/index')

    // Load device settings
    const settings = loadDeviceSettings()
    if (!settings) {
      return { success: false, error: 'No printer configured. Please set up your device in Settings.' }
    }

    // Decode base64 PNG to buffer
    const base64Data = base64PNG.replace(/^data:image\/png;base64,/, '')
    const pngBuffer = Buffer.from(base64Data, 'base64')

    // Skip trim when canvas is already sized to printable area (CatPrinter mode)
    const sharp = (await import('sharp')).default
    const meta = await sharp(pngBuffer).metadata()
    const isNativeWidth = meta.width === 384

    const result = await printLabel(pngBuffer, {
      deviceUUID: settings.deviceUUID,
      intensity: 0xff,
      topTrim: isNativeWidth ? 0 : settings.topTrim,
      feedTrim: isNativeWidth ? 0 : settings.feedTrim,
      gapLines: Math.round(options?.gapLines ?? 0)
    })

    if (result.success) {
      console.log('Print complete')
    } else {
      console.error('Print failed:', result.error)
    }
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Print error:', msg)
    return { success: false, error: msg }
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.labeldesigner.app')
  buildMenu()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
