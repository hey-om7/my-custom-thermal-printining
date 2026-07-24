import { useState } from 'react'
import { mmToPx } from '@/hooks/useStore'

interface Props {
  onConfirm: (widthMM: number, heightMM: number, gapMM: number) => void
}

const PRESETS = [
  { label: '🐱 CatPrinter', w: 48, h: 14, isCatPrinter: true },
  { label: '50 × 30 mm', w: 50, h: 30 },
  { label: '40 × 30 mm', w: 40, h: 30 },
  { label: '60 × 40 mm', w: 60, h: 40 },
  { label: '80 × 50 mm', w: 80, h: 50 },
  { label: '100 × 60 mm', w: 100, h: 60 },
  { label: '48 × 25 mm (receipt)', w: 48, h: 25 }
]

export function StartupModal({ onConfirm }: Props) {
  const [widthMM, setWidthMM] = useState(50)
  const [heightMM, setHeightMM] = useState(30)
  const [gapMM, setGapMM] = useState(0)

  const widthPx = mmToPx(widthMM)
  const heightPx = mmToPx(heightMM)

  const isCatPrinterMode = widthMM === 48 && heightMM === 14

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background relative">
      {/* Drag region for window movement */}
      <div className="absolute top-0 left-0 right-0 h-12 draggable-region" />
      <div className="w-[460px] rounded-xl border bg-card p-8 shadow-2xl">
        <h2 className="text-xl font-bold mb-1">Create New Label</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Select a preset or enter custom dimensions for your thermal label.
        </p>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setWidthMM(p.w); setHeightMM(p.h) }}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent ${
                widthMM === p.w && heightMM === p.h
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isCatPrinterMode && (
          <div className="rounded-md bg-muted/60 border border-border px-3 py-2 mb-4 text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">CatPrinter Mode:</strong> Canvas is sized to the exact printable area
            (384px wide × {heightPx}px tall). What you design is exactly what prints — no cropping, no wasted space.
          </div>
        )}

        {/* Custom input */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Width (mm)</label>
            <input
              type="number"
              min={10}
              max={200}
              value={widthMM}
              onChange={(e) => setWidthMM(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Height (mm)</label>
            <input
              type="number"
              min={10}
              max={200}
              value={heightMM}
              onChange={(e) => setHeightMM(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Gap (mm)</label>
            <input
              type="number"
              min={0}
              max={50}
              value={gapMM}
              onChange={(e) => setGapMM(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Info */}
        <div className="rounded-md bg-muted px-3 py-2 mb-2 text-xs text-muted-foreground">
          Canvas size at 203 DPI: <strong className="text-foreground">{widthPx} × {heightPx} px</strong>
        </div>
        <p className="text-[11px] text-muted-foreground mb-6 leading-relaxed">
          <strong>Gap</strong> is the blank space between die-cut labels on the roll.
          Set it so the printer advances one full label pitch ({heightMM}+{gapMM}={heightMM + gapMM}mm)
          per print and stays aligned.
        </p>

        {/* Confirm */}
        <button
          onClick={() => onConfirm(widthMM, heightMM, gapMM)}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Create Label
        </button>
      </div>
    </div>
  )
}
