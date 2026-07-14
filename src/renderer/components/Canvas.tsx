import { forwardRef, useCallback, useEffect, useRef } from 'react'
import { Stage, Layer, Rect, Text, Image, Transformer, Circle, Line, Arrow } from 'react-konva'
import type Konva from 'konva'
import useImage from 'use-image'
import type { CanvasElement, LabelDimensions, TextElement, ShapeElement } from '@/lib/types'

interface Props {
  dimensions: LabelDimensions
  elements: CanvasElement[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, updates: Partial<CanvasElement>) => void
}

// Individual element renderers
function TextNode({ el, isSelected, onSelect, onUpdate }: {
  el: TextElement
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<CanvasElement>) => void
}) {
  const nodeRef = useRef<Konva.Text>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && trRef.current && nodeRef.current) {
      trRef.current.nodes([nodeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <Text
        ref={nodeRef}
        x={el.x}
        y={el.y}
        text={el.text}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontStyle={`${el.fontWeight} ${el.fontStyle}`}
        align={el.align}
        width={el.width}
        fill="black"
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onUpdate({ x: e.target.x(), y: e.target.y() })
        }}
        onTransformEnd={() => {
          const node = nodeRef.current!
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onUpdate({
            x: node.x(),
            y: node.y(),
            width: Math.max(20, node.width() * scaleX),
            height: Math.max(10, node.height() * scaleY),
            fontSize: Math.max(8, Math.round(el.fontSize * scaleY)),
            rotation: node.rotation()
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 10) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}

function ImageNode({ el, isSelected, onSelect, onUpdate }: {
  el: CanvasElement & { src: string }
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<CanvasElement>) => void
}) {
  const [image] = useImage(el.src)
  const nodeRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && trRef.current && nodeRef.current) {
      trRef.current.nodes([nodeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <Image
        ref={nodeRef}
        image={image}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onUpdate({ x: e.target.x(), y: e.target.y() })
        }}
        onTransformEnd={() => {
          const node = nodeRef.current!
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onUpdate({
            x: node.x(),
            y: node.y(),
            width: Math.max(10, node.width() * scaleX),
            height: Math.max(10, node.height() * scaleY),
            rotation: node.rotation()
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 10 || newBox.height < 10) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}

function ShapeNode({ el, isSelected, onSelect, onUpdate }: {
  el: ShapeElement
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<CanvasElement>) => void
}) {
  const nodeRef = useRef<Konva.Shape>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && trRef.current && nodeRef.current) {
      trRef.current.nodes([nodeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  const commonHandlers = {
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onUpdate({ x: e.target.x(), y: e.target.y() })
    }
  }

  const fillColor = el.fill ? 'black' : undefined
  const stroke = 'black'

  const handleTransformEnd = () => {
    const node = nodeRef.current!
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    onUpdate({
      x: node.x(),
      y: node.y(),
      width: Math.max(4, el.width * scaleX),
      height: Math.max(4, el.height * scaleY),
      rotation: node.rotation()
    })
  }

  let shapeNode: React.ReactNode = null

  if (el.shape === 'rect') {
    shapeNode = (
      <Rect
        ref={nodeRef as React.RefObject<Konva.Rect>}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        fill={fillColor}
        stroke={stroke}
        strokeWidth={el.strokeWidth}
        cornerRadius={el.cornerRadius}
        {...commonHandlers}
        onTransformEnd={handleTransformEnd}
      />
    )
  } else if (el.shape === 'circle') {
    // Use ellipse-like Rect bounding via Circle scaled; use radius from width
    shapeNode = (
      <Circle
        ref={nodeRef as React.RefObject<Konva.Circle>}
        x={el.x + el.width / 2}
        y={el.y + el.height / 2}
        radius={Math.min(el.width, el.height) / 2}
        rotation={el.rotation}
        fill={fillColor}
        stroke={stroke}
        strokeWidth={el.strokeWidth}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onUpdate({
            x: e.target.x() - el.width / 2,
            y: e.target.y() - el.height / 2
          })
        }}
        onTransformEnd={() => {
          const node = nodeRef.current!
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          const newW = Math.max(4, el.width * scaleX)
          const newH = Math.max(4, el.height * scaleY)
          onUpdate({
            x: node.x() - newW / 2,
            y: node.y() - newH / 2,
            width: newW,
            height: newH,
            rotation: node.rotation()
          })
        }}
      />
    )
  } else if (el.shape === 'line') {
    shapeNode = (
      <Line
        ref={nodeRef as React.RefObject<Konva.Line>}
        x={el.x}
        y={el.y}
        points={[0, 0, el.width, 0]}
        rotation={el.rotation}
        stroke={stroke}
        strokeWidth={el.strokeWidth}
        {...commonHandlers}
        onTransformEnd={handleTransformEnd}
      />
    )
  } else if (el.shape === 'arrow') {
    shapeNode = (
      <Arrow
        ref={nodeRef as React.RefObject<Konva.Arrow>}
        x={el.x}
        y={el.y}
        points={[0, 0, el.width, 0]}
        rotation={el.rotation}
        stroke={stroke}
        fill={stroke}
        strokeWidth={el.strokeWidth}
        pointerLength={Math.max(6, el.strokeWidth * 3)}
        pointerWidth={Math.max(6, el.strokeWidth * 3)}
        {...commonHandlers}
        onTransformEnd={handleTransformEnd}
      />
    )
  }

  return (
    <>
      {shapeNode}
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 4 || newBox.height < 4) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}

export const Canvas = forwardRef<Konva.Stage, Props>(
  ({ dimensions, elements, selectedId, onSelect, onUpdate }, ref) => {
    // Calculate scale to fit the canvas in the viewport
    const containerRef = useRef<HTMLDivElement>(null)

    const handleDeselect = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        // Deselect when clicking empty stage or the white background rect
        const target = e.target
        if (target === target.getStage() || target.name() === 'background') {
          onSelect(null)
        }
      },
      [onSelect]
    )

    // Deselect on Escape key
    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onSelect(null)
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }, [onSelect])

    // Scale to fit in viewport with padding
    const scale = Math.min(
      (window.innerWidth - 400) / dimensions.widthPx,
      (window.innerHeight - 120) / dimensions.heightPx,
      2
    )

    return (
      <div ref={containerRef} className="flex items-center justify-center">
        <Stage
          ref={ref}
          width={dimensions.widthPx * scale}
          height={dimensions.heightPx * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={handleDeselect}
          onTouchStart={handleDeselect}
          style={{ borderRadius: '4px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
        >
          <Layer>
            {/* White label background */}
            <Rect
              name="background"
              x={0}
              y={0}
              width={dimensions.widthPx}
              height={dimensions.heightPx}
              fill="white"
            />

            {/* Render all elements */}
            {elements.map((el) => {
              const isSelected = el.id === selectedId
              const selectThis = () => onSelect(el.id)
              const updateThis = (updates: Partial<CanvasElement>) =>
                onUpdate(el.id, updates)

              if (el.type === 'text') {
                return (
                  <TextNode
                    key={el.id}
                    el={el}
                    isSelected={isSelected}
                    onSelect={selectThis}
                    onUpdate={updateThis}
                  />
                )
              }
              if (el.type === 'shape') {
                return (
                  <ShapeNode
                    key={el.id}
                    el={el}
                    isSelected={isSelected}
                    onSelect={selectThis}
                    onUpdate={updateThis}
                  />
                )
              }
              // image, barcode, qrcode all render as images
              return (
                <ImageNode
                  key={el.id}
                  el={el as CanvasElement & { src: string }}
                  isSelected={isSelected}
                  onSelect={selectThis}
                  onUpdate={updateThis}
                />
              )
            })}
          </Layer>
        </Stage>
      </div>
    )
  }
)

Canvas.displayName = 'Canvas'
