/// <reference types="vite/client" />

interface ScannedDevice {
  id: string
  name: string
  rssi: number
  address: string
  serviceUUIDs: string[]
}

interface DeviceSettings {
  deviceUUID: string
  deviceName: string
  topTrim: number
  feedTrim: number
}

interface ElectronAPI {
  printLabel: (base64PNG: string, options?: { gapLines?: number }) => Promise<{ success: boolean; error?: string }>
  previewPrintImage: (base64PNG: string, options?: { gapLines?: number }) => Promise<{ success: boolean; dataURL?: string; error?: string }>

  bleScan: (durationMs?: number) => Promise<ScannedDevice[]>
  bleScanStop: () => Promise<{ success: boolean }>

  getDeviceSettings: () => Promise<DeviceSettings | null>
  saveDeviceSettings: (settings: DeviceSettings) => Promise<{ success: boolean }>
  clearDeviceSettings: () => Promise<{ success: boolean }>

  onMenuNew: (callback: () => void) => void
  onMenuSave: (callback: () => void) => void
  onMenuSaveAs: (callback: () => void) => void
  onMenuPrint: (callback: () => void) => void
  onMenuUndo: (callback: () => void) => void
  onMenuRedo: (callback: () => void) => void
}

interface Window {
  electronAPI: ElectronAPI
}
