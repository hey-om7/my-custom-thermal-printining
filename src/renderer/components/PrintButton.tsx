import { useState, type RefObject } from 'react'
import { Printer, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type Konva from 'konva'
import type { LabelDimensions } from '@/lib/types'

interface Props {
  stageRef: RefObject<Konva.Stage | null>
  dimensions: LabelDimensions
  onBeforeCapture: () => void
}

type PrintState = 'idle' | 'printing' | 'success' | 'error'

export function PrintButton({ stageRef, dimensions, onBeforeCapture }: Props) {
  const [state, setState] = useState<PrintState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handlePrint = async () => {
    const stage = stageRef.current
    if (!stage) return

    setState('printing')
    setErrorMsg('')

    // 1. Deselect any element so the Transformer (blue outline) isn't captured
    onBeforeCapture()
    // Allow React/Konva to remove the transformer before we snapshot
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    try {
      // 2. Capture at EXACT label pixel dimensions.
      //    The stage is displayed scaled-to-fit, so temporarily reset the
      //    scale to 1:1, snapshot, then restore the display scale.
      const displayScale = stage.scaleX()
      stage.scale({ x: 1, y: 1 })
      stage.size({ width: dimensions.widthPx, height: dimensions.heightPx })
      stage.batchDraw()

      const dataURL = stage.toDataURL({
        mimeType: 'image/png',
        pixelRatio: 1,
        x: 0,
        y: 0,
        width: dimensions.widthPx,
        height: dimensions.heightPx
      })

      // Restore display scale
      stage.scale({ x: displayScale, y: displayScale })
      stage.size({
        width: dimensions.widthPx * displayScale,
        height: dimensions.heightPx * displayScale
      })
      stage.batchDraw()

      const result = await window.electronAPI.printLabel(dataURL, {
        gapLines: dimensions.gapPx
      })

      if (result.success) {
        setState('success')
        setTimeout(() => setState('idle'), 3000)
      } else {
        setState('error')
        setErrorMsg(result.error || 'Unknown error')
        setTimeout(() => setState('idle'), 5000)
      }
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Print failed')
      setTimeout(() => setState('idle'), 5000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {state === 'error' && (
        <span className="text-xs text-destructive max-w-[200px] truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}
      <button
        id="print-btn"
        onClick={handlePrint}
        disabled={state === 'printing'}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          state === 'success'
            ? 'bg-green-600 text-white'
            : state === 'error'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } disabled:opacity-50`}
      >
        {state === 'idle' && <><Printer size={16} /> Print</>}
        {state === 'printing' && <><Loader2 size={16} className="animate-spin" /> Printing...</>}
        {state === 'success' && <><CheckCircle2 size={16} /> Printed!</>}
        {state === 'error' && <><XCircle size={16} /> Failed</>}
      </button>
    </div>
  )
}
