import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import type { LabelDimensions, NewCanvasElement } from '@/lib/types'

interface Props {
  dimensions: LabelDimensions
  addElement: (element: NewCanvasElement) => void
  onClose: () => void
}

const API = 'https://api.iconify.design'
const RASTER_SIZE = 240
const DEBOUNCE_MS = 400

export function IconsPanel({ dimensions, addElement, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced auto-search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(
          `${API}/search?query=${encodeURIComponent(query.trim())}&limit=60`
        )
        const data = await res.json()
        setResults(data.icons || [])
      } catch {
        setError('Search failed. Check your internet connection.')
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const addIcon = useCallback(
    async (iconName: string) => {
      try {
        const svgUrl = `${API}/${iconName}.svg?height=${RASTER_SIZE}&color=%23000000`
        const svgRes = await fetch(svgUrl)
        const svgText = await svgRes.text()
        const blob = new Blob([svgText], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)

        const img = new window.Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = RASTER_SIZE
          canvas.height = RASTER_SIZE
          const ctx = canvas.getContext('2d')!
          const ratio = Math.min(RASTER_SIZE / img.width, RASTER_SIZE / img.height)
          const w = img.width * ratio
          const h = img.height * ratio
          ctx.drawImage(img, (RASTER_SIZE - w) / 2, (RASTER_SIZE - h) / 2, w, h)
          URL.revokeObjectURL(url)

          const src = canvas.toDataURL('image/png')
          const displaySize = Math.round(dimensions.widthPx * 0.25)
          addElement({
            type: 'image',
            x: 20,
            y: 20,
            width: displaySize,
            height: displaySize,
            rotation: 0,
            src
          })
          onClose()
        }
        img.onerror = () => setError('Failed to load icon.')
        img.src = url
      } catch {
        setError('Failed to add icon.')
      }
    },
    [addElement, dimensions, onClose]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-h-[70vh] rounded-xl border bg-background p-5 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Add Icon</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            placeholder="Search free icons (e.g. home, star, wifi)..."
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && <p className="text-xs text-destructive mb-2">{error}</p>}

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-12">
              {query ? 'Searching...' : 'Start typing to search icons.'}
            </p>
          ) : (
            <div className="grid grid-cols-8 gap-2">
              {results.map((name) => (
                <button
                  key={name}
                  onClick={() => addIcon(name)}
                  title={name}
                  className="aspect-square flex items-center justify-center rounded-md border border-border bg-white hover:bg-gray-100 hover:border-primary transition-colors p-2"
                >
                  <img
                    src={`${API}/${name}.svg?height=32&color=%23000000`}
                    alt={name}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
