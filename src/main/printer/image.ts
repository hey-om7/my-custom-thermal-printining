/**
 * Image preparation for MXW01 thermal printer.
 *
 * Pipeline: PNG buffer → grayscale → resize to 384px wide (keep height) →
 *           threshold → 1bpp bit-pack
 *
 * Preview pipeline: PNG buffer → grayscale → resize → blur for smooth edges →
 *                   output as grayscale PNG (no dithering, no 1bpp)
 */
import sharp from 'sharp'
import { PRINT_WIDTH, BYTES_PER_LINE, MIN_DATA_BYTES } from './mxw01'

// --- Simple threshold (in-place on grayscale buffer) ------------------------
// Converts each pixel to pure black or white. threshold value controls the
// cutoff — pixels darker than this become black, lighter become white.
function applyThreshold(pixels: Uint8Array, threshold = 128): void {
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = pixels[i] < threshold ? 0 : 255
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
        // After threshold, 0 = black (ink), 255 = white. Protocol wants black=1.
        if (px === 0) byte |= 1 << bit
      }
      out[y * bytesPerRow + byteIdx] = byte
    }
  }
  return out
}

// --- Generate a preview PNG -------------------------------------------------
// Shows the image as it will look when printed: grayscale with soft edges,
// giving a realistic representation without harsh dither artifacts.
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

  // Resize to print width, keep grayscale with natural anti-aliasing
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

  // Output as grayscale PNG — no dithering, preserves smooth edges
  // This represents what the print will look like at normal viewing distance
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

  // 1. Load image, resize width to 384, apply slight blur to smooth edges
  //    before the hard threshold. This prevents jagged staircase artifacts.
  const meta = await sharp(pngBuffer).metadata()
  const origH = meta.height!

  const grayscale = await sharp(pngBuffer)
    .grayscale()
    .resize(PRINT_WIDTH, origH, { fit: 'fill' })
    .blur(0.6) // smooth edges slightly before threshold
    .raw()
    .toBuffer()

  const w = PRINT_WIDTH
  let h = origH
  let pixels = new Uint8Array(grayscale)

  // 2. Shift content UP (top trim): remove top lines, pad bottom
  if (topTrim > 0 && h > topTrim) {
    const shifted = new Uint8Array(w * h)
    shifted.set(pixels.subarray(topTrim * w))
    shifted.fill(255, (h - topTrim) * w)
    pixels = shifted
  }

  // 3. Simple threshold — clean black/white with no dither noise
  applyThreshold(pixels, 128)

  // 4. Add gap lines (blank / white = all 0 after bit-pack = no ink)
  if (gapLines > 0) {
    const expanded = new Uint8Array(w * (h + gapLines))
    expanded.fill(255)
    expanded.set(pixels)
    pixels = expanded
    h += gapLines
  }

  // 5. Trim bottom for feed compensation
  if (feedTrim > 0 && h > feedTrim) {
    h -= feedTrim
    pixels = pixels.subarray(0, w * h)
  }

  // 6. Pack into 1bpp
  const packed = packBits(pixels, w, h)

  // 7. Pad to minimum
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
