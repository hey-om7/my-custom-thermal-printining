import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Bluetooth, RotateCcw, Save, Loader2, CropIcon } from 'lucide-react'

interface Props {
  onBack: () => void
  onDeviceReset: () => void
}

export function Settings({ onBack, onDeviceReset }: Props) {
  const [settings, setSettings] = useState<DeviceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [topTrim, setTopTrim] = useState(28)
  const [feedTrim, setFeedTrim] = useState(38)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const s = await window.electronAPI.getDeviceSettings()
    setSettings(s)
    if (s) {
      setTopTrim(s.topTrim)
      setFeedTrim(s.feedTrim)
    }
    setLoading(false)
  }

  const handleSaveCrop = useCallback(async () => {
    if (!settings) return
    setSaving(true)
    await window.electronAPI.saveDeviceSettings({
      ...settings,
      topTrim,
      feedTrim
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [settings, topTrim, feedTrim])

  const handleResetDevice = useCallback(async () => {
    await window.electronAPI.clearDeviceSettings()
    setSettings(null)
    setConfirmReset(false)
    onDeviceReset()
  }, [onDeviceReset])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Header */}
      <header
        className="h-12 border-b flex items-center gap-3 px-4 shrink-0 draggable-region"
        style={{ paddingLeft: '88px' }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[560px] mx-auto py-8 px-6 space-y-8">
          {/* Device section */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Bluetooth size={16} />
              Connected Printer
            </h2>

            {settings ? (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{settings.deviceName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {settings.deviceUUID}
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
                </div>

                <div className="border-t pt-3">
                  {!confirmReset ? (
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <RotateCcw size={12} />
                      Reset Device
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive">
                        Remove this printer and set up a new one?
                      </span>
                      <button
                        onClick={handleResetDevice}
                        className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <Bluetooth size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No printer configured</p>
                <p className="text-xs mt-1">The setup wizard will appear on next restart</p>
              </div>
            )}
          </section>

          {/* Crop settings section */}
          {settings && (
            <section>
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CropIcon size={16} />
                Print Crop Settings
              </h2>

              <div className="rounded-lg border p-4 space-y-5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Adjust the crop values to fine-tune print alignment. <strong>Upper crop</strong> shifts 
                  the image up (removes top whitespace). <strong>Bottom crop</strong> trims the feed 
                  at the bottom (reduces paper advance after printing).
                </p>

                {/* Top Trim (Upper Crop) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium">Upper Crop (Top Trim)</label>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {topTrim} lines
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={topTrim}
                    onChange={(e) => setTopTrim(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">0</span>
                    <span className="text-[10px] text-muted-foreground">100</span>
                  </div>
                </div>

                {/* Feed Trim (Bottom Crop) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium">Bottom Crop (Feed Trim)</label>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {feedTrim} lines
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={feedTrim}
                    onChange={(e) => setFeedTrim(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">0</span>
                    <span className="text-[10px] text-muted-foreground">100</span>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveCrop}
                  disabled={saving || (topTrim === settings.topTrim && feedTrim === settings.feedTrim)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
                    saved
                      ? 'bg-green-600 text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : saved ? (
                    '✓ Saved'
                  ) : (
                    <>
                      <Save size={12} />
                      Save Crop Settings
                    </>
                  )}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
