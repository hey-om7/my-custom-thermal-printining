import { useRef, useEffect, useState, useCallback } from 'react'
import type Konva from 'konva'
import type { CanvasElement } from '@/lib/types'
import { useStore } from '@/hooks/useStore'
import { Homepage } from '@/components/Homepage'
import { StartupModal } from '@/components/StartupModal'
import { Canvas } from '@/components/Canvas'
import { Toolbar } from '@/components/Toolbar'
import { PropertiesSidebar } from '@/components/PropertiesSidebar'
import { PrintButton } from '@/components/PrintButton'
import { BleOnboarding } from '@/components/BleOnboarding'
import { Settings } from '@/components/Settings'
import { FilePlus, Save, Home, X, Circle, Settings as SettingsIcon, Loader2 } from 'lucide-react'

export default function App() {
  const store = useStore()
  const stageRef = useRef<Konva.Stage>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false)
  const [sketchName, setSketchName] = useState('')
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const clipboardRef = useRef<CanvasElement | null>(null)

  const generateThumbnail = useCallback((): string | undefined => {
    const stage = stageRef.current
    if (!stage || !store.dimensions) return undefined
    const displayScale = stage.scaleX()
    stage.scale({ x: 1, y: 1 })
    stage.size({
      width: store.dimensions.widthPx,
      height: store.dimensions.heightPx
    })
    stage.batchDraw()
    const thumbnail = stage.toDataURL({ pixelRatio: 0.3, mimeType: 'image/png' })
    stage.scale({ x: displayScale, y: displayScale })
    stage.size({
      width: store.dimensions.widthPx * displayScale,
      height: store.dimensions.heightPx * displayScale
    })
    stage.batchDraw()
    return thumbnail
  }, [store.dimensions])

  // Quick save (existing sketch overwrites, new sketch shows name dialog)
  const quickSave = useCallback(() => {
    if (store.currentSketchId) {
      const existing = store.sketches.find((s) => s.id === store.currentSketchId)
      const name = existing?.name || store.currentSketchName
      const thumbnail = generateThumbnail()
      store.saveSketch(name, thumbnail)
    } else {
      setSaveModalOpen(true)
    }
  }, [store, generateThumbnail])

  // Save with name (first-time save)
  const handleSaveWithName = useCallback(() => {
    const name = sketchName.trim() || `Sketch ${new Date().toLocaleString()}`
    const thumbnail = generateThumbnail()
    store.saveSketch(name, thumbnail)
    setSaveModalOpen(false)
    setSketchName('')
  }, [sketchName, store, generateThumbnail])

  // Save As: creates a new copy, switches to it
  const handleSaveAs = useCallback(() => {
    const name = sketchName.trim() || `Sketch ${new Date().toLocaleString()}`
    const thumbnail = generateThumbnail()
    store.saveAsSketch(name, thumbnail)
    setSaveAsModalOpen(false)
    setSketchName('')
  }, [sketchName, store, generateThumbnail])

  // Guard navigation when dirty
  const guardedAction = useCallback(
    (action: () => void) => {
      if (store.isDirty) {
        setPendingAction(() => action)
        setCloseDialogOpen(true)
      } else {
        action()
      }
    },
    [store.isDirty]
  )

  const handleCloseDiscard = useCallback(() => {
    setCloseDialogOpen(false)
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }, [pendingAction])

  const handleCloseSaveFirst = useCallback(() => {
    quickSave()
    setCloseDialogOpen(false)
    if (pendingAction) {
      // Give save a tick to complete then run action
      setTimeout(() => {
        pendingAction()
        setPendingAction(null)
      }, 50)
    }
  }, [quickSave, pendingAction])

  // Native menu bar events
  useEffect(() => {
    window.electronAPI.onMenuNew(() => guardedAction(() => store.newSketch()))
    window.electronAPI.onMenuSave(() => quickSave())
    window.electronAPI.onMenuSaveAs(() => setSaveAsModalOpen(true))
    window.electronAPI.onMenuPrint(() => {
      document.getElementById('print-btn')?.click()
    })
    window.electronAPI.onMenuUndo(() => store.undo())
    window.electronAPI.onMenuRedo(() => store.redo())
  }, [store, quickSave, guardedAction])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        store.undo()
        return
      }
      if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        store.redo()
        return
      }
      if (meta && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        quickSave()
        return
      }
      if (meta && e.key === 's' && e.shiftKey) {
        e.preventDefault()
        setSaveAsModalOpen(true)
        return
      }
      if (meta && e.key === 'c') {
        if (store.selectedElement) {
          clipboardRef.current = { ...store.selectedElement }
        }
        return
      }
      if (meta && e.key === 'v') {
        if (clipboardRef.current) {
          e.preventDefault()
          const { id, ...rest } = clipboardRef.current
          store.addElement({ ...rest, x: rest.x + 15, y: rest.y + 15 } as any)
        }
        return
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
      if (isEditable) return
      if (store.selectedId) {
        e.preventDefault()
        store.removeElement(store.selectedId)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [store, quickSave])

  // --- View routing ---

  // Loading state while checking device configuration
  if (store.deviceConfigured === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  // BLE onboarding (first launch or after device reset)
  if (store.view === 'onboarding') {
    return <BleOnboarding onComplete={store.onOnboardingComplete} />
  }

  // Settings page
  if (store.view === 'settings') {
    return <Settings onBack={store.goHome} onDeviceReset={store.onDeviceReset} />
  }

  if (store.view === 'home') {
    return (
      <Homepage
        sketches={store.sketches}
        onNewSketch={store.newSketch}
        onLoadSketch={store.loadSketch}
        onDeleteSketch={store.deleteSketch}
        onOpenSettings={store.openSettings}
      />
    )
  }

  if (store.view === 'dimensions') {
    return <StartupModal onConfirm={store.setLabelDimensions} />
  }

  // --- Editor ---
  return (
    <div className="h-screen w-screen flex flex-col select-none">
      {/* Top bar */}
      <header className="h-12 border-b flex items-center justify-between pr-4 shrink-0 draggable-region" style={{ paddingLeft: '88px' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => guardedAction(store.goHome)}
            title="Home"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Home size={16} />
          </button>

          <span className="text-[10px] text-muted-foreground">
            {store.dimensions!.widthMM}×{store.dimensions!.heightMM}mm
          </span>

          <button
            onClick={() => guardedAction(() => store.newSketch())}
            title="New Sketch (⌘N)"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <FilePlus size={14} />
            New
          </button>

          <button
            onClick={quickSave}
            title="Save (⌘S)"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Save size={14} />
            Save
          </button>

          {/* File tab */}
          <div className="flex items-center gap-1.5 rounded-md border px-3 py-1 bg-muted/50">
            <span className="text-xs font-medium truncate max-w-[180px]">
              {store.currentSketchName}
            </span>
            {store.isDirty ? (
              <Circle size={8} className="text-muted-foreground fill-muted-foreground shrink-0" />
            ) : (
              <button
                onClick={() => guardedAction(store.goHome)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Close"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PrintButton
            stageRef={stageRef}
            dimensions={store.dimensions!}
            onBeforeCapture={() => store.setSelectedId(null)}
          />
          <button
            onClick={store.openSettings}
            title="Settings"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar dimensions={store.dimensions!} addElement={store.addElement} />
        <div className="flex-1 canvas-bg overflow-hidden flex items-center justify-center">
          <Canvas
            ref={stageRef}
            dimensions={store.dimensions!}
            elements={store.elements}
            selectedId={store.selectedId}
            onSelect={store.setSelectedId}
            onUpdate={store.updateElement}
          />
        </div>
        <PropertiesSidebar
          element={store.selectedElement}
          onUpdate={store.updateElement}
          onDelete={store.removeElement}
        />
      </div>

      {/* Save modal (first time) */}
      {saveModalOpen && (
        <SaveNameDialog
          title="Save Sketch"
          description="Give your sketch a name."
          value={sketchName}
          onChange={setSketchName}
          onConfirm={handleSaveWithName}
          onCancel={() => setSaveModalOpen(false)}
        />
      )}

      {/* Save As modal */}
      {saveAsModalOpen && (
        <SaveNameDialog
          title="Save As"
          description="Enter a name for the new copy."
          value={sketchName}
          onChange={setSketchName}
          onConfirm={handleSaveAs}
          onCancel={() => setSaveAsModalOpen(false)}
        />
      )}

      {/* Unsaved changes dialog */}
      {closeDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setCloseDialogOpen(false)}
        >
          <div
            className="w-[380px] rounded-xl border bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-1">Unsaved Changes</h3>
            <p className="text-sm text-muted-foreground mb-5">
              You have unsaved changes in <strong>{store.currentSketchName}</strong>.
              What would you like to do?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setCloseDialogOpen(false); setPendingAction(null) }}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseDiscard}
                className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Discard
              </button>
              <button
                onClick={handleCloseSaveFirst}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable name input dialog
function SaveNameDialog({ title, description, value, onChange, onConfirm, onCancel }: {
  title: string
  description: string
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="w-[380px] rounded-xl border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">{description}</p>
        <input
          autoFocus
          type="text"
          value={value}
          placeholder="My Label Design..."
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm()
            if (e.key === 'Escape') onCancel()
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
