import { contextBridge, ipcRenderer } from 'electron'

export interface ScannedDevice {
  id: string
  name: string
  rssi: number
  address: string
  serviceUUIDs: string[]
}

export interface DeviceSettings {
  deviceUUID: string
  deviceName: string
  topTrim: number
  feedTrim: number
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Print
  printLabel: (base64PNG: string, options?: { gapLines?: number }) =>
    ipcRenderer.invoke('print-label', base64PNG, options),

  // BLE Scan
  bleScan: (durationMs?: number): Promise<ScannedDevice[]> =>
    ipcRenderer.invoke('ble-scan', durationMs),
  bleScanStop: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('ble-scan-stop'),

  // Device Settings
  getDeviceSettings: (): Promise<DeviceSettings | null> =>
    ipcRenderer.invoke('get-device-settings'),
  saveDeviceSettings: (settings: DeviceSettings): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('save-device-settings', settings),
  clearDeviceSettings: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('clear-device-settings'),

  // Menu events
  onMenuNew: (callback: () => void) => ipcRenderer.on('menu-new', callback),
  onMenuSave: (callback: () => void) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback: () => void) => ipcRenderer.on('menu-save-as', callback),
  onMenuPrint: (callback: () => void) => ipcRenderer.on('menu-print', callback),
  onMenuUndo: (callback: () => void) => ipcRenderer.on('menu-undo', callback),
  onMenuRedo: (callback: () => void) => ipcRenderer.on('menu-redo', callback)
})
