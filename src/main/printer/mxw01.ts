/**
 * MXW01 Cat Printer BLE Protocol
 *
 * Packet format (AE01 control):
 *   [0x22 0x21] [cmd] [0x00] [len_lo len_hi] [payload...] [crc8] [0xFF]
 *
 * CRC-8: poly 0x07, init 0x00, no reflection, over payload only.
 * Image data goes to AE03 as raw bytes (no framing).
 */

// --- UUIDs -----------------------------------------------------------------
export const SERVICE_UUID = '0000ae30-0000-1000-8000-00805f9b34fb'
export const CONTROL_UUID = '0000ae01-0000-1000-8000-00805f9b34fb'
export const NOTIFY_UUID = '0000ae02-0000-1000-8000-00805f9b34fb'
export const DATA_UUID = '0000ae03-0000-1000-8000-00805f9b34fb'

// --- Commands --------------------------------------------------------------
export const CMD_GET_STATUS = 0xa1
export const CMD_SET_INTENSITY = 0xa2
export const CMD_PRINT_REQUEST = 0xa9
export const CMD_FLUSH = 0xad
export const CMD_PRINT_COMPLETE = 0xaa

// --- Constants -------------------------------------------------------------
export const PRINT_WIDTH = 384
export const BYTES_PER_LINE = PRINT_WIDTH / 8 // 48
export const MIN_DATA_BYTES = 4320 // minimum image buffer (90 lines)

// --- CRC-8 (poly 0x07) ----------------------------------------------------
const crc8Table = (() => {
  const t = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff
    }
    t[i] = crc
  }
  return t
})()

export function crc8(data: Uint8Array): number {
  let crc = 0x00
  for (let i = 0; i < data.length; i++) {
    crc = crc8Table[(crc ^ data[i]) & 0xff]
  }
  return crc
}

// --- Command builder -------------------------------------------------------
export function buildCommand(cmdId: number, payload: Uint8Array): Buffer {
  const len = payload.length
  const pkt = Buffer.alloc(6 + len + 2) // preamble(2) + cmd(1) + fixed(1) + len(2) + payload + crc(1) + footer(1)
  pkt[0] = 0x22
  pkt[1] = 0x21
  pkt[2] = cmdId
  pkt[3] = 0x00
  pkt[4] = len & 0xff
  pkt[5] = (len >> 8) & 0xff
  payload.forEach((b, i) => (pkt[6 + i] = b))
  pkt[6 + len] = crc8(payload)
  pkt[6 + len + 1] = 0xff
  return pkt
}

// --- Pre-built commands ----------------------------------------------------
export function cmdSetIntensity(intensity: number): Buffer {
  return buildCommand(CMD_SET_INTENSITY, Uint8Array.from([intensity & 0xff]))
}

export function cmdGetStatus(): Buffer {
  return buildCommand(CMD_GET_STATUS, Uint8Array.from([0x00]))
}

export function cmdPrintRequest(lineCount: number): Buffer {
  return buildCommand(
    CMD_PRINT_REQUEST,
    Uint8Array.from([lineCount & 0xff, (lineCount >> 8) & 0xff, 0x30, 0x00])
  )
}

export function cmdFlush(): Buffer {
  return buildCommand(CMD_FLUSH, Uint8Array.from([0x00]))
}
