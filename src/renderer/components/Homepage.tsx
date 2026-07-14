import { Plus, Trash2, FileText, Settings } from 'lucide-react'
import type { SavedSketch } from '@/hooks/useStore'

interface Props {
  sketches: SavedSketch[]
  onNewSketch: () => void
  onLoadSketch: (sketch: SavedSketch) => void
  onDeleteSketch: (id: string) => void
  onOpenSettings: () => void
}

export function Homepage({ sketches, onNewSketch, onLoadSketch, onDeleteSketch, onOpenSettings }: Props) {
  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Header with safe traffic light spacing */}
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0 draggable-region" style={{ paddingLeft: '88px' }}>
        <h1 className="text-base font-bold tracking-tight">Label Designer</h1>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Settings size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Your Sketches</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {sketches.length === 0
                  ? 'No saved sketches yet. Create your first one!'
                  : `${sketches.length} saved sketch${sketches.length > 1 ? 'es' : ''}`}
              </p>
            </div>
            <button
              onClick={onNewSketch}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              New Sketch
            </button>
          </div>

          {/* Sketches grid */}
          {sketches.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {sketches.map((sketch) => (
                <div
                  key={sketch.id}
                  onClick={() => onLoadSketch(sketch)}
                  className="group rounded-xl border bg-card hover:border-primary hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                    {sketch.thumbnail ? (
                      <img
                        src={sketch.thumbnail}
                        alt={sketch.name}
                        className="w-full h-full object-contain p-3 bg-white"
                      />
                    ) : (
                      <FileText size={40} className="text-muted-foreground/30" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium truncate flex-1">
                        {sketch.name}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSketch(sketch.id)
                        }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                        title="Delete sketch"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {sketch.dimensions.widthMM}×{sketch.dimensions.heightMM}mm •{' '}
                      {new Date(sketch.savedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {sketches.length === 0 && (
            <div className="mt-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new sketch to get started
              </p>
              <button
                onClick={onNewSketch}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus size={16} />
                New Sketch
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
