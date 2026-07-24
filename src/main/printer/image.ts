/**
 * Image preparation for MXW01 thermal printer.
 *
 * Pipeline: PNG buffer → resize to 384px wide (keep aspect) → 1bpp bit-pack
 *
 * Minimal processing — preserve the canvas image as-is and let the printer
 * firmware handle rendering decisions.
 */
import sharp from 'sharp'
import { PRINT_WIDTH, BYTES_PER_LINE, MIN_DATA_BYTES } from './mxw01'

// --- 1bpp bit packing (LSB = leftmost, black=1) ----------------------------
function packBits(pixels: Uint8Array, w: number, h: number): Uint8Array {
  const bytesPerRow = w / 8
  const out = new Uint8Array(h * bytesPerRow)
  for (let y = 0; y < h; y++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const px = pixels[y * w + byteIdx * 8 + bit]
        // 0 = black (ink), 255 = white. Protocol wants black=1.
        if (px < 128) byte |= 1 << bit
      }
      out[y * bytesPerRow + byteIdx] = byte
    }
  }
  return out
}

// --- Generate a preview PNG -------------------------------------------------
// Shows exactly what will be sent to the printer — just resized, no processing.
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

  return sharp(Buffer.from(pixels), { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer()
}

// --- Main image preparation (for actual printing) ---------------------------
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

  const meta = await sharp(pngBuffer).metadata()
  const origH = meta.height!

  // Just resize to print width — no blur, no dither, no threshold manipulation
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

  // Pack into 1bpp (simple < 128 threshold, no manipulation)
  const packed = packBits(pixels, w, h)

  // Pad to minimum
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
