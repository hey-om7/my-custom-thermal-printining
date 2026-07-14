import { useCallback, useRef, useState } from 'react'
import {
  Type,
  ImageIcon,
  Barcode,
  QrCode,
  Minus,
  ArrowRight,
  Circle,
  Square,
  Smile
} from 'lucide-react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import type { CanvasElement, LabelDimensions, ShapeKind, NewCanvasElement } from '@/lib/types'
import { IconsPanel } from './IconsPanel'

interface Props {
  dimensions: LabelDimensions
  addElement: (element: NewCanvasElement) => void
}

type ModalKind = 'barcode' | 'qrcode' | null

export function Toolbar({ dimensions, addElement }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [modalValue, setModalValue] = useState('')
  const [showIcons, setShowIcons] = useState(false)

  const addShape = useCallback(
    (shape: ShapeKind) => {
      const base = {
        type: 'shape' as const,
        x: 30,
        y: 30,
        rotation: 0,
        fill: false,
        strokeWidth: 3,
        cornerRadius: 0,
        shape
      }
      if (shape === 'line' || shape === 'arrow') {
        addElement({ ...base, width: 150, height: 1 })
      } else {
        addElement({ ...base, width: 100, height: 100 })
      }
    },
    [addElement]
  )

  const addText = useCallback(() => {
    addElement({
      type: 'text',
      x: 20,
      y: 20,
      width: 200,
      height: 40,
      rotation: 0,
      text: 'Label Text',
      fontSize: 24,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      align: 'left'
    })
  }, [addElement])

  const addImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = reader.result as string
        const img = new window.Image()
        img.onload = () => {
          const maxW = dimensions.widthPx * 0.6
          const scale = Math.min(maxW / img.width, 1)
          addElement({
            type: 'image',
            x: 20,
            y: 20,
            width: img.width * scale,
            height: img.height * scale,
            rotation: 0,
            src
          })
        }
        img.src = src
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [addElement, dimensions]
  )

  const openModal = (kind: ModalKind) => {
    setModalValue(kind === 'qrcode' ? 'https://example.com' : '123456789012')
    setModal(kind)
  }

  const generateBarcode = useCallback(
    (value: string) => {
      try {
        const canvas = document.createElement('canvas')
        JsBarcode(canvas, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000'
        })
        addElement({
          type: 'barcode',
          x: 20,
          y: 20,
          width: canvas.width,
          height: canvas.height,
          rotation: 0,
          value,
          format: 'CODE128',
          src: canvas.toDataURL()
        })
      } catch (err) {
        alert(`Invalid barcode value: ${err}`)
      }
    },
    [addElement]
  )

  const generateQRCode = useCallback(
    async (value: string) => {
      try {
        const src = await QRCode.toDataURL(value, {
          width: 150,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        })
        addElement({
          type: 'qrcode',
          x: 20,
          y: 20,
          width: 150,
          height: 150,
          rotation: 0,
          value,
          src
        })
      } catch (err) {
        alert(`QR code error: ${err}`)
      }
    },
    [addElement]
  )

  const handleModalConfirm = useCallback(() => {
    const value = modalValue.trim()
    if (!value) return
    if (modal === 'barcode') generateBarcode(value)
    else if (modal === 'qrcode') generateQRCode(value)
    setModal(null)
    setModalValue('')
  }, [modal, modalValue, generateBarcode, generateQRCode])

  const tools = [
    { icon: Type, label: 'Text', action: addText },
    { icon: ImageIcon, label: 'Image', action: addImage },
    { icon: Smile, label: 'Icons', action: () => setShowIcons(true) },
    { icon: Barcode, label: 'Barcode', action: () => openModal('barcode') },
    { icon: QrCode, label: 'QR Code', action: () => openModal('qrcode') },
    { icon: Square, label: 'Square', action: () => addShape('rect') },
    { icon: Circle, label: 'Circle', action: () => addShape('circle') },
    { icon: Minus, label: 'Line', action: () => addShape('line') },
    { icon: ArrowRight, label: 'Arrow', action: () => addShape('arrow') }
  ]

  return (
    <aside className="w-16 border-r flex flex-col items-center py-4 gap-1 shrink-0">
      {tools.map(({ icon: Icon, label, action }) => (
        <button
          key={label}
          onClick={action}
          title={label}
          className="w-11 h-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Icon size={20} />
        </button>
      ))}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {showIcons && (
        <IconsPanel
          dimensions={dimensions}
          addElement={addElement}
          onClose={() => setShowIcons(false)}
        />
      )}

      {/* Value input modal (replaces unsupported window.prompt) */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setModal(null)}
        >
          <div
            className="w-[380px] rounded-xl border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-1">
              {modal === 'barcode' ? 'Add Barcode' : 'Add QR Code'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {modal === 'barcode'
                ? 'Enter the value to encode (CODE128 format).'
                : 'Enter the text or URL to encode.'}
            </p>
            <input
              autoFocus
              type="text"
              value={modalValue}
              onChange={(e) => setModalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleModalConfirm()
                if (e.key === 'Escape') setModal(null)
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
