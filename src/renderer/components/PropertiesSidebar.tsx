import { Trash2 } from 'lucide-react'
import type { CanvasElement, TextElement, ShapeElement } from '@/lib/types'

interface Props {
  element: CanvasElement | null
  onUpdate: (id: string, updates: Partial<CanvasElement>) => void
  onDelete: (id: string) => void
}

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Palatino'
]

const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Normal', value: 'normal' },
  { label: 'Medium', value: '500' },
  { label: 'Semi Bold', value: '600' },
  { label: 'Bold', value: 'bold' },
  { label: 'Extra Bold', value: '800' }
]

export function PropertiesSidebar({ element, onUpdate, onDelete }: Props) {
  if (!element) {
    return (
      <aside className="w-64 border-l p-4 shrink-0 overflow-y-auto">
        <p className="text-xs text-muted-foreground text-center mt-8">
          Select an element to edit its properties
        </p>
      </aside>
    )
  }

  const update = (updates: Partial<CanvasElement>) => onUpdate(element.id, updates)

  return (
    <aside className="w-64 border-l p-4 shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {element.type}
        </h3>
        <button
          onClick={() => onDelete(element.id)}
          className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete element"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Position */}
      <Section title="Position">
        <Row>
          <Field label="X" value={Math.round(element.x)} onChange={(v) => update({ x: v })} />
          <Field label="Y" value={Math.round(element.y)} onChange={(v) => update({ y: v })} />
        </Row>
        <Row>
          <Field label="W" value={Math.round(element.width)} onChange={(v) => update({ width: v })} />
          <Field label="H" value={Math.round(element.height)} onChange={(v) => update({ height: v })} />
        </Row>
        <Row>
          <Field label="Rotation" value={Math.round(element.rotation)} onChange={(v) => update({ rotation: v })} />
        </Row>
      </Section>

      {/* Text-specific properties */}
      {element.type === 'text' && (
        <TextProperties element={element} update={update} />
      )}

      {/* Shape-specific properties */}
      {element.type === 'shape' && (
        <ShapeProperties element={element} update={update} />
      )}

      {/* Barcode/QR value */}
      {(element.type === 'barcode' || element.type === 'qrcode') && (
        <Section title="Data">
          <label className="text-xs text-muted-foreground block mb-1">Value</label>
          <input
            type="text"
            value={(element as { value: string }).value}
            readOnly
            className="w-full rounded-md border bg-muted px-2 py-1.5 text-xs"
          />
        </Section>
      )}
    </aside>
  )
}

function TextProperties({ element, update }: { element: TextElement; update: (u: Partial<TextElement>) => void }) {
  return (
    <>
      <Section title="Text">
        <textarea
          value={element.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={3}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Section>

      <Section title="Font">
        <label className="text-xs text-muted-foreground block mb-1">Family</label>
        <select
          value={element.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-xs mb-2 focus:outline-none"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <Row>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Size</label>
            <input
              type="number"
              min={6}
              max={200}
              value={element.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Weight</label>
            <select
              value={element.fontWeight}
              onChange={(e) => update({ fontWeight: e.target.value })}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none"
            >
              {FONT_WEIGHTS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
        </Row>

        <div className="flex gap-1 mt-2">
          <button
            onClick={() => update({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}
            className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
              element.fontStyle === 'italic' ? 'bg-accent text-accent-foreground border-primary' : 'border-border text-muted-foreground'
            }`}
          >
            <em>Italic</em>
          </button>
          <button
            onClick={() => update({ align: 'left' })}
            className={`flex-1 rounded border px-2 py-1 text-xs transition-colors ${element.align === 'left' ? 'bg-accent border-primary' : 'border-border text-muted-foreground'}`}
          >
            Left
          </button>
          <button
            onClick={() => update({ align: 'center' })}
            className={`flex-1 rounded border px-2 py-1 text-xs transition-colors ${element.align === 'center' ? 'bg-accent border-primary' : 'border-border text-muted-foreground'}`}
          >
            Center
          </button>
          <button
            onClick={() => update({ align: 'right' })}
            className={`flex-1 rounded border px-2 py-1 text-xs transition-colors ${element.align === 'right' ? 'bg-accent border-primary' : 'border-border text-muted-foreground'}`}
          >
            Right
          </button>
        </div>
      </Section>
    </>
  )
}

function ShapeProperties({ element, update }: { element: ShapeElement; update: (u: Partial<ShapeElement>) => void }) {
  const isClosedShape = element.shape === 'rect' || element.shape === 'circle'
  return (
    <Section title="Appearance">
      <Row>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">Stroke Width</label>
          <input
            type="number"
            min={1}
            max={40}
            value={element.strokeWidth}
            onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none"
          />
        </div>
        {element.shape === 'rect' && (
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Corner Radius</label>
            <input
              type="number"
              min={0}
              max={200}
              value={element.cornerRadius}
              onChange={(e) => update({ cornerRadius: Number(e.target.value) })}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none"
            />
          </div>
        )}
      </Row>

      {isClosedShape && (
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => update({ fill: false })}
            className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
              !element.fill ? 'bg-accent text-accent-foreground border-primary' : 'border-border text-muted-foreground'
            }`}
          >
            Outline
          </button>
          <button
            onClick={() => update({ fill: true })}
            className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
              element.fill ? 'bg-accent text-accent-foreground border-primary' : 'border-border text-muted-foreground'
            }`}
          >
            Filled
          </button>
        </div>
      )}
    </Section>
  )
}

// Layout helpers
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 pb-4 border-b last:border-b-0">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 mb-2">{children}</div>
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex-1">
      <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}
