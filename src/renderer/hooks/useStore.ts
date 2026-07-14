import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import type { CanvasElement, LabelDimensions, NewCanvasElement } from '@/lib/types'

const DPI = 203
const STORAGE_KEY = 'label-designer-sketches'
const MAX_HISTORY = 50

export function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * DPI)
}

export interface SavedSketch {
  id: string
  name: string
  dimensions: LabelDimensions
  elements: CanvasElement[]
  savedAt: number
  thumbnail?: string
}

export type AppView = 'home' | 'dimensions' | 'editor' | 'onboarding' | 'settings'

function loadSketches(): SavedSketch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSketches(sketches: SavedSketch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sketches))
}

export function useStore() {
  const [view, setView] = useState<AppView>('home')
  const [dimensions, setDimensions] = useState<LabelDimensions | null>(null)
  const [elements, setElements] = useState<CanvasElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sketches, setSketches] = useState<SavedSketch[]>(loadSketches)
  const [currentSketchId, setCurrentSketchId] = useState<string | null>(null)
  const [currentSketchName, setCurrentSketchName] = useState<string>('Untitled')
  const [isDirty, setIsDirty] = useState(false)
  const [deviceConfigured, setDeviceConfigured] = useState<boolean | null>(null) // null = checking

  // Check if device is configured on mount — show onboarding if not
  useEffect(() => {
    window.electronAPI.getDeviceSettings().then((settings) => {
      if (settings) {
        setDeviceConfigured(true)
      } else {
        setDeviceConfigured(false)
        setView('onboarding')
      }
    })
  }, [])

  // --- Undo / Redo ---
  const historyRef = useRef<CanvasElement[][]>([])
  const futureRef = useRef<CanvasElement[][]>([])

  const pushHistory = useCallback((prev: CanvasElement[]) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), prev]
    futureRef.current = []
    setIsDirty(true)
  }, [])

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    setElements((current) => {
      futureRef.current = [...futureRef.current, current]
      return prev
    })
    setIsDirty(true)
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    setElements((current) => {
      historyRef.current = [...historyRef.current, current]
      return next
    })
    setIsDirty(true)
  }, [])

  const setLabelDimensions = useCallback((widthMM: number, heightMM: number, gapMM = 0) => {
    setDimensions({
      widthMM,
      heightMM,
      widthPx: mmToPx(widthMM),
      heightPx: mmToPx(heightMM),
      gapMM,
      gapPx: mmToPx(gapMM)
    })
    setElements([])
    setSelectedId(null)
    setCurrentSketchId(null)
    setCurrentSketchName('Untitled')
    setIsDirty(false)
    historyRef.current = []
    futureRef.current = []
    setView('editor')
  }, [])

  const addElement = useCallback((element: NewCanvasElement) => {
    const newEl = { ...element, id: uuid() } as CanvasElement
    setElements((prev) => {
      pushHistory(prev)
      return [...prev, newEl]
    })
    setSelectedId(newEl.id)
  }, [pushHistory])

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements((prev) => {
      pushHistory(prev)
      return prev.map((el) => (el.id === id ? ({ ...el, ...updates } as CanvasElement) : el))
    })
  }, [pushHistory])

  const removeElement = useCallback((id: string) => {
    setElements((prev) => {
      pushHistory(prev)
      return prev.filter((el) => el.id !== id)
    })
    setSelectedId((curr) => (curr === id ? null : curr))
  }, [pushHistory])

  const selectedElement = elements.find((el) => el.id === selectedId) || null

  // --- Sketch Management ---

  /** Save: overwrites current sketch (or creates new if no ID) */
  const saveSketch = useCallback(
    (name: string, thumbnail?: string) => {
      if (!dimensions) return
      const id = currentSketchId || uuid()
      const sketch: SavedSketch = {
        id,
        name,
        dimensions,
        elements,
        savedAt: Date.now(),
        thumbnail
      }
      setSketches((prev) => {
        const without = prev.filter((s) => s.id !== id)
        const updated = [sketch, ...without]
        persistSketches(updated)
        return updated
      })
      setCurrentSketchId(id)
      setCurrentSketchName(name)
      setIsDirty(false)
    },
    [dimensions, elements, currentSketchId]
  )

  /** Save As: creates a NEW sketch with the given name.
   *  The current editor keeps working on the NEW file. */
  const saveAsSketch = useCallback(
    (name: string, thumbnail?: string) => {
      if (!dimensions) return
      const newId = uuid()
      const sketch: SavedSketch = {
        id: newId,
        name,
        dimensions,
        elements,
        savedAt: Date.now(),
        thumbnail
      }
      setSketches((prev) => {
        const updated = [sketch, ...prev]
        persistSketches(updated)
        return updated
      })
      setCurrentSketchId(newId)
      setCurrentSketchName(name)
      setIsDirty(false)
    },
    [dimensions, elements]
  )

  const loadSketch = useCallback((sketch: SavedSketch) => {
    setDimensions(sketch.dimensions)
    setElements(sketch.elements)
    setSelectedId(null)
    setCurrentSketchId(sketch.id)
    setCurrentSketchName(sketch.name)
    setIsDirty(false)
    historyRef.current = []
    futureRef.current = []
    setView('editor')
  }, [])

  const deleteSketch = useCallback((id: string) => {
    setSketches((prev) => {
      const updated = prev.filter((s) => s.id !== id)
      persistSketches(updated)
      return updated
    })
  }, [])

  const newSketch = useCallback(() => {
    setView('dimensions')
  }, [])

  const goHome = useCallback(() => {
    setView('home')
  }, [])

  const onOnboardingComplete = useCallback(() => {
    setDeviceConfigured(true)
    setView('home')
  }, [])

  const onDeviceReset = useCallback(() => {
    setDeviceConfigured(false)
    setView('onboarding')
  }, [])

  const openSettings = useCallback(() => {
    setView('settings')
  }, [])

  return {
    view,
    setView,
    dimensions,
    setLabelDimensions,
    elements,
    addElement,
    updateElement,
    removeElement,
    selectedId,
    setSelectedId,
    selectedElement,
    undo,
    redo,
    // sketch management
    sketches,
    currentSketchId,
    currentSketchName,
    isDirty,
    saveSketch,
    saveAsSketch,
    loadSketch,
    deleteSketch,
    newSketch,
    goHome,
    // device/settings
    deviceConfigured,
    onOnboardingComplete,
    onDeviceReset,
    openSettings
  }
}
