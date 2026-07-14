import { useState, useEffect, useCallback } from 'react'
import { Bluetooth, Loader2, RefreshCw, CheckCircle2, Wifi } from 'lucide-react'

interface Props {
  onComplete: () => void
}

export function BleOnboarding({ onComplete }: Props) {
  const [scanning, setScanning] = useState(false)
  const [devices, setDevices] = useState<ScannedDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<ScannedDevice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scanCount, setScanCount] = useState(0)

  const startScan = useCallback(async () => {
    setScanning(true)
    setError('')
    setDevices([])
    setSelectedDevice(null)

    try {
      const results = await window.electronAPI.bleScan(12000) // 12 second deep scan
      // Sort by signal strength (strongest first), filter out unnamed devices last
      const sorted = results.sort((a, b) => {
        // Named devices first
        if (a.name && !b.name) return -1
        if (!a.name && b.name) return 1
        // Then by signal strength
        return b.rssi - a.rssi
      })
      setDevices(sorted)
      setScanCount((c) => c + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [])

  // Auto-start scan on mount
  useEffect(() => {
    startScan()
    return () => {
      window.electronAPI.bleScanStop()
    }
  }, [])

  const handleSelect = async () => {
    if (!selectedDevice) return
    setSaving(true)

    try {
      await window.electronAPI.saveDeviceSettings({
        deviceUUID: selectedDevice.id,
        deviceName: selectedDevice.name || `BLE Device (${selectedDevice.id.slice(0, 8)})`,
        topTrim: 28,
        feedTrim: 38
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save device')
      setSaving(false)
    }
  }

  const getSignalBars = (rssi: number): number => {
    if (rssi >= -50) return 4
    if (rssi >= -65) return 3
    if (rssi >= -80) return 2
    return 1
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background relative">
      {/* Drag region for window movement */}
      <div className="absolute top-0 left-0 right-0 h-12 draggable-region" />
      <div className="w-[520px] rounded-xl border bg-card p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bluetooth size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Connect Your Printer</h2>
            <p className="text-sm text-muted-foreground">
              Select your BLE thermal printer from the list below
            </p>
          </div>
        </div>

        {/* Scan status */}
        <div className="flex items-center justify-between mt-6 mb-3">
          <span className="text-xs text-muted-foreground">
            {scanning
              ? 'Deep scanning for BLE devices...'
              : devices.length > 0
                ? `Found ${devices.length} device${devices.length !== 1 ? 's' : ''}`
                : scanCount > 0
                  ? 'No devices found'
                  : 'Ready to scan'}
          </span>
          <button
            onClick={startScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {scanning ? 'Scanning...' : 'Rescan'}
          </button>
        </div>

        {/* Device list */}
        <div className="border rounded-lg overflow-hidden mb-4 max-h-[320px] overflow-y-auto">
          {scanning && devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 size={24} className="animate-spin mb-3" />
              <span className="text-sm">Scanning for nearby BLE devices...</span>
              <span className="text-xs mt-1">This may take up to 12 seconds</span>
            </div>
          ) : devices.length === 0 && scanCount > 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bluetooth size={24} className="mb-3 opacity-40" />
              <span className="text-sm">No BLE devices found</span>
              <span className="text-xs mt-1">Make sure your printer is turned on and nearby</span>
            </div>
          ) : (
            devices.map((device) => (
              <button
                key={device.id}
                onClick={() => setSelectedDevice(device)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-b-0 transition-colors ${
                  selectedDevice?.id === device.id
                    ? 'bg-primary/10 border-primary/20'
                    : 'hover:bg-accent/50'
                }`}
              >
                {/* Signal indicator */}
                <div className="flex items-end gap-[2px] h-4 shrink-0">
                  {[1, 2, 3, 4].map((bar) => (
                    <div
                      key={bar}
                      className={`w-[3px] rounded-sm ${
                        bar <= getSignalBars(device.rssi)
                          ? 'bg-primary'
                          : 'bg-muted-foreground/20'
                      }`}
                      style={{ height: `${bar * 25}%` }}
                    />
                  ))}
                </div>

                {/* Device info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {device.name || 'Unknown Device'}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {device.id}
                  </div>
                </div>

                {/* RSSI */}
                <div className="text-[10px] text-muted-foreground shrink-0">
                  {device.rssi} dBm
                </div>

                {/* Selected indicator */}
                {selectedDevice?.id === device.id && (
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 mb-4 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Tips */}
        <div className="rounded-md bg-muted px-3 py-2 mb-6 text-[11px] text-muted-foreground leading-relaxed">
          <strong>Tips:</strong> Turn your printer on and wait a few seconds before scanning.
          Some BLE devices don't advertise their name — look for the device ID that matches your printer.
          You can rescan multiple times to find hidden devices.
        </div>

        {/* Action */}
        <button
          onClick={handleSelect}
          disabled={!selectedDevice || saving}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Wifi size={16} />
              Connect & Save Device
            </>
          )}
        </button>
      </div>
    </div>
  )
}
