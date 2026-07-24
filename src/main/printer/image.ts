/**
 * Image preparation for MXW01 thermal printer.
 *
 * Pipeline: PNG buffer → grayscale → resize to 384px wide (keep height) →
 *           clamp near-white → Floyd-Steinberg dither → 1bpp bit-pack
 */
import sharp from 'sharp'
import { PRINT_WIDTH, BYTES_PER_LINE, MIN_DATA_BYTES } from './mxw01'

// --- Floyd-Steinberg dithering (in-place on grayscale buffer) ---------------
function floydSteinbergDither(pixels: Uint8Array, w: number, h: number): void {
  function clamp(v: number): number {
    return v < 0 ? 0 : v > 255 ? 255 : v
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const old = pixels[idx]
      const val = old > 127 ? 255 : 0
      pixels[idx] = val
      const err = old - val
      if (x + 1 < w) pixels[idx + 1] = clamp(pixels[idx + 1] + (err * 7) / 16)
      if (y + 1 < h) {
        if (x - 1 >= 0) pixels[(y + 1) * w + x - 1] = clamp(pixels[(y + 1) * w + x - 1] + (err * 3) / 16)
        pixels[(y + 1) * w + x] = clamp(pixels[(y + 1) * w + x] + (err * 5) / 16)
        if (x + 1 < w) pixels[(y + 1) * w + x + 1] = clamp(pixels[(y + 1) * w + x + 1] + (err * 1) / 16)
      }
    }
  }
}

// --- Near-white clamp (eliminate anti-aliased background noise) -------------
function clampNearWhite(pixels: Uint8Array, cutoff = 235): void {
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] >= cutoff) pixels[i] = 255
  }
}

// --- 1bpp bit packing (LSB = leftmost, black=1) ----------------------------
function packBits(pixels: Uint8Array, w: number, h: number): Uint8Array {
  const bytesPerRow = w / 8
  const out = new Uint8Array(h * bytesPerRow)
  for (let y = 0; y < h; y++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const px = pixels[y * w + byteIdx * 8 + bit]
        // After dithering, 0 = black (ink), 255 = white. Protocol wants black=1.
        if (px === 0) byte |= 1 << bit
      }
      out[y * bytesPerRow + byteIdx] = byte
    }
  }
  return out
}

// --- Generate a preview PNG (exact processed image before 1bpp packing) -----
export interface PreviewOptions {
  topTrim?: number
  feedTrim?: number
  gapLines?: number
}

export async function generatePreviewPNG(
  pngBuffer: Buffer,
  opts: PreviewOptions = {}
): Promise<Buffer> {
  const { topTrim = 0, feedTrim = 0, gapLines = 0 } = opts

  const meta = await sharp(pngBuffer).metadata()
  const origH = meta.height!

  const grayscale = await sharp(pngBuffer)
    .grayscale()
    .resize(PRINT_WIDTH, origH, { fit: 'fill' })
    .raw()
    .toBuffer()

  const w = PRINT_WIDTH
  let h = origH
  let pixels = new Uint8Array(grayscale)

  // Shift content UP (top trim)
  if (topTrim > 0 && h > topTrim) {
    const shifted = new Uint8Array(w * h)
    shifted.set(pixels.subarray(topTrim * w))
    shifted.fill(255, (h - topTrim) * w)
    pixels = shifted
  }

  // Clamp near-white
  clampNearWhite(pixels)

  // Floyd-Steinberg dither
  floydSteinbergDither(pixels, w, h)

  // Add gap lines
  if (gapLines > 0) {
    const expanded = new Uint8Array(w * (h + gapLines))
    expanded.fill(255)
    expanded.set(pixels)
    pixels = expanded
    h += gapLines
  }

  // Trim bottom for feed compensation
  if (feedTrim > 0 && h > feedTrim) {
    h -= feedTrim
    pixels = pixels.subarray(0, w * h)
  }

  // Convert the processed grayscale pixels back to a PNG for display
  return sharp(Buffer.from(pixels), { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer()
}

// --- Main image preparation -------------------------------------------------
export interface PrepareOptions {
  topTrim?: number   // lines to shift content up
  feedTrim?: number  // lines to trim from bottom
  gapLines?: number  // blank lines for inter-label gap
}

export async function prepareImageBuffer(
  pngBuffer: Buffer,
  opts: PrepareOptions = {}
): Promise<{ data: Buffer; lineCount: number }> {
  const { topTrim = 0, feedTrim = 0, gapLines = 0 } = opts

  // 1. Load image, get original height, resize width to 384 (keep height exact)
  const meta = await sharp(pngBuffer).metadata()
  const origH = meta.height!

  const grayscale = await sharp(pngBuffer)
    .grayscale()
    .resize(PRINT_WIDTH, origH, { fit: 'fill' })
    .raw()
    .toBuffer()

  const w = PRINT_WIDTH
  let h = origH
  let pixels = new Uint8Array(grayscale)

  // 2. Shift content UP (top trim): remove top lines, pad bottom
  if (topTrim > 0 && h > topTrim) {
    const shifted = new Uint8Array(w * h)
    shifted.set(pixels.subarray(topTrim * w)) // copies from row topTrim onward
    // Bottom rows are already 0 (white = 0 in grayscale? No - 255 is white)
    shifted.fill(255, (h - topTrim) * w) // white padding at bottom
    pixels = shifted
  }

  // 3. Clamp near-white to pure white before dithering
  clampNearWhite(pixels)

  // 4. Floyd-Steinberg dither
  floydSteinbergDither(pixels, w, h)

  // 5. Add gap lines (blank / white = all 0 after bit-pack = no ink)
  if (gapLines > 0) {
    const expanded = new Uint8Array(w * (h + gapLines))
    expanded.fill(255) // white
    expanded.set(pixels)
    pixels = expanded
    h += gapLines
  }

  // 6. Trim bottom for feed compensation
  if (feedTrim > 0 && h > feedTrim) {
    h -= feedTrim
    pixels = pixels.subarray(0, w * h)
  }

  // 7. Pack into 1bpp
  const packed = packBits(pixels, w, h)

  // 8. Pad to minimum
  let data: Buffer
  let lineCount = h
  if (packed.length < MIN_DATA_BYTES) {
    data = Buffer.alloc(MIN_DATA_BYTES)
    data.set(packed)
    lineCount = MIN_DATA_BYTES / BYTES_PER_LINE
  } else {
    data = Buffer.from(packed)
  }

  return { data, lineCount }
}
