import { X, Printer, Loader2 } from 'lucide-react'

interface Props {
  previewDataURL: string
  onConfirm: () => void
  onCancel: () => void
  isPrinting: boolean
}

export function PrintPreviewDialog({ previewDataURL, onConfirm, onCancel, isPrinting }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative z-10 w-[420px] max-h-[85vh] rounded-xl border border-border bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="text-base font-semibold">Print Preview</h3>
          <button
            onClick={onCancel}
            disabled={isPrinting}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview image */}
        <div className="flex-1 overflow-auto p-5">
          <p className="text-xs text-muted-foreground mb-3">
            This is the exact image that will be sent to the printer (dithered &amp; optimized).
          </p>
          <div className="rounded-lg border bg-white p-3 flex items-center justify-center">
            <img
              src={previewDataURL}
              alt="Print preview"
              className="max-w-full h-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t shrink-0">
          <button
            onClick={onCancel}
            disabled={isPrinting}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPrinting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPrinting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer size={16} />
                Confirm &amp; Print
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
