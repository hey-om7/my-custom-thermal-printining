export interface LabelDimensions {
  widthMM: number
  heightMM: number
  widthPx: number
  heightPx: number
  gapMM: number // vertical gap between die-cut labels
  gapPx: number
}

export type ElementType = 'text' | 'image' | 'barcode' | 'qrcode' | 'shape'

export type ShapeKind = 'rect' | 'circle' | 'line' | 'arrow'

export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  align: 'left' | 'center' | 'right'
}

export interface ImageElement extends BaseElement {
  type: 'image'
  src: string
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode'
  value: string
  format: string
  src: string
}

export interface QRCodeElement extends BaseElement {
  type: 'qrcode'
  value: string
  src: string
}

export interface ShapeElement extends BaseElement {
  type: 'shape'
  shape: ShapeKind
  fill: boolean // true = filled black, false = outline only
  strokeWidth: number
  cornerRadius: number // only for rect
}

export type CanvasElement =
  | TextElement
  | ImageElement
  | BarcodeElement
  | QRCodeElement
  | ShapeElement

// Distributes Omit across each member of the union so object literals for a
// specific element type pass excess-property checks.
export type DistributiveOmit<T, K extends keyof never> = T extends unknown
  ? Omit<T, K>
  : never

export type NewCanvasElement = DistributiveOmit<CanvasElement, 'id'>
