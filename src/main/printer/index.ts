/**
 * MXW01 BLE print flow using @stoprocent/noble.
 *
 * Flow: connect → subscribe notifications → set intensity → get status →
 *       print request → send image data on AE03 → flush → wait complete
 */
import noble from '@stoprocent/noble'
import {
  SERVICE_UUID,
  CONTROL_UUID,
  NOTIFY_UUID,
  DATA_UUID,
  CMD_GET_STATUS,
  CMD_PRINT_REQUEST,
  CMD_PRINT_COMPLETE,
  cmdSetIntensity,
  cmdGetStatus,
  cmdPrintRequest,
  cmdFlush
} from './mxw01'
import { prepareImageBuffer, type PrepareOptions } from './image'

const CHUNK_SIZE = 180
const CHUNK_DELAY_MS = 20
const CONNECT_TIMEOUT_MS = 15000
const RESPONSE_TIMEOUT_MS = 10000
const PRINT_COMPLETE_TIMEOUT_MS = 30000

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface PrintOptions extends PrepareOptions {
  deviceUUID: string
  intensity?: number // 0x00-0xFF (default 0xFF)
}

export async function printLabel(
  pngBuffer: Buffer,
  opts: PrintOptions
): Promise<{ success: boolean; error?: string }> {
  const {
    deviceUUID,
    intensity = 0xff,
    topTrim = 28,
    feedTrim = 30,
    gapLines = 0
  } = opts

  let peripheral: noble.Peripheral | null = null

  try {
    // 1. Prepare image data
    const { data, lineCount } = await prepareImageBuffer(pngBuffer, {
      topTrim,
      feedTrim,
      gapLines
    })

    // 2. Start BLE scanning and find the device
    peripheral = await findDevice(deviceUUID)
    if (!peripheral) {
      return { success: false, error: 'Printer not found. Is it turned on?' }
    }

    // 3. Connect
    await peripheral.connectAsync()

    // 4. Discover ALL services and characteristics.
    //    noble normalizes standard-base-UUID characteristics to their short
    //    16-bit form (e.g. "ae01"), so we match on that suffix.
    const { characteristics } =
      await peripheral.discoverAllServicesAndCharacteristicsAsync()

    console.log(
      '[BLE] Characteristics:',
      characteristics.map((c) => c.uuid).join(', ')
    )

    // Match a characteristic by either its full 32-char UUID or short 16-bit form.
    const matchChar = (fullUuid: string) => {
      const stripped = fullUuid.replace(/-/g, '').toLowerCase()
      const short = stripped.slice(4, 8) // "0000ae01..." -> "ae01"
      return characteristics.find((c) => {
        const u = c.uuid.toLowerCase().replace(/-/g, '')
        return u === stripped || u === short
      })
    }

    const controlChar = matchChar(CONTROL_UUID)
    const notifyChar = matchChar(NOTIFY_UUID)
    const dataChar = matchChar(DATA_UUID)

    if (!controlChar || !notifyChar || !dataChar) {
      return {
        success: false,
        error: `Required BLE characteristics not found. Available: ${characteristics
          .map((c) => c.uuid)
          .join(', ')}`
      }
    }

    // 5. Subscribe to notifications
    const notifications: Buffer[] = []
    let notifyResolve: (() => void) | null = null

    await notifyChar.subscribeAsync()
    notifyChar.on('data', (buf: Buffer) => {
      notifications.push(buf)
      if (notifyResolve) notifyResolve()
    })

    function waitForNotify(cmdId: number, timeoutMs: number): Promise<Buffer | null> {
      return new Promise((resolve) => {
        const check = (): boolean => {
          const idx = notifications.findIndex(
            (b) => b.length >= 3 && b[0] === 0x22 && b[1] === 0x21 && b[2] === cmdId
          )
          if (idx >= 0) {
            resolve(notifications.splice(idx, 1)[0])
            return true
          }
          return false
        }
        if (check()) return
        const timer = setTimeout(() => {
          notifyResolve = null
          resolve(null)
        }, timeoutMs)
        notifyResolve = () => {
          if (check()) {
            clearTimeout(timer)
            notifyResolve = null
          }
        }
      })
    }

    // Helper to write to control characteristic
    async function writeControl(buf: Buffer): Promise<void> {
      await controlChar!.writeAsync(buf, true) // true = withoutResponse
    }

    // 6. Set intensity
    await writeControl(cmdSetIntensity(intensity))
    await delay(100)

    // 7. Get status
    await writeControl(cmdGetStatus())
    const statusNotify = await waitForNotify(CMD_GET_STATUS, RESPONSE_TIMEOUT_MS)
    if (!statusNotify) {
      return { success: false, error: 'No status response from printer.' }
    }
    // Check status flag at byte offset 6+12 = 18 in raw notification
    if (statusNotify.length > 18 && statusNotify[18] !== 0) {
      return { success: false, error: `Printer error (status flag ${statusNotify[18]})` }
    }

    // 8. Print request
    await writeControl(cmdPrintRequest(lineCount))
    const printReqNotify = await waitForNotify(CMD_PRINT_REQUEST, RESPONSE_TIMEOUT_MS)
    if (!printReqNotify) {
      return { success: false, error: 'Print request timed out.' }
    }
    // First payload byte (offset 6) should be 0x00 = OK
    if (printReqNotify.length > 6 && printReqNotify[6] !== 0x00) {
      return { success: false, error: 'Print request rejected by printer.' }
    }

    // 9. Send image data over AE03 in chunks
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.subarray(i, Math.min(i + CHUNK_SIZE, data.length))
      await dataChar.writeAsync(Buffer.from(chunk), true)
      await delay(CHUNK_DELAY_MS)
    }

    // 10. Flush
    await writeControl(cmdFlush())

    // 11. Wait for print complete
    const doneNotify = await waitForNotify(CMD_PRINT_COMPLETE, PRINT_COMPLETE_TIMEOUT_MS)
    if (!doneNotify) {
      // Data was sent; printer likely printed even without the notification
      return { success: true, error: 'Print sent (no completion ack).' }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  } finally {
    // Disconnect
    if (peripheral && peripheral.state === 'connected') {
      try {
        await peripheral.disconnectAsync()
      } catch {
        // ignore
      }
    }
    noble.stopScanning()
  }
}

// --- Device discovery -------------------------------------------------------
function findDevice(uuid: string): Promise<noble.Peripheral | null> {
  return new Promise((resolve) => {
    // On macOS, noble reports peripheral.id as the CoreBluetooth UUID (with or without dashes)
    const targetId = uuid.toLowerCase().replace(/-/g, '')
    let found = false

    const timer = setTimeout(() => {
      if (!found) {
        console.log('[BLE] Scan timed out. No printer found.')
        noble.stopScanning()
        noble.removeAllListeners('discover')
        resolve(null)
      }
    }, CONNECT_TIMEOUT_MS)

    const onDiscover = (peripheral: noble.Peripheral): void => {
      const id = (peripheral.id || '').toLowerCase().replace(/-/g, '')
      const addr = (peripheral.address || '').toLowerCase().replace(/[:-]/g, '')
      const name = peripheral.advertisement?.localName || ''

      console.log(`[BLE] Found: id=${peripheral.id}, addr=${peripheral.address}, name=${name}`)

      if (id === targetId || addr === targetId) {
        found = true
        clearTimeout(timer)
        noble.stopScanning()
        noble.removeListener('discover', onDiscover)
        console.log(`[BLE] Matched target printer: ${peripheral.id}`)
        resolve(peripheral)
      }
    }

    noble.on('discover', onDiscover)

    const startScan = (): void => {
      console.log('[BLE] Starting scan...')
      // On macOS, pass empty array to scan ALL devices (service UUID filtering
      // can miss devices that don't advertise all services in their adv packet)
      noble.startScanning([], false)
    }

    if (noble.state === 'poweredOn') {
      startScan()
    } else {
      console.log(`[BLE] Waiting for adapter... current state: ${noble.state}`)
      noble.once('stateChange', (state: string) => {
        console.log(`[BLE] State changed to: ${state}`)
        if (state === 'poweredOn') {
          startScan()
        } else {
          clearTimeout(timer)
          resolve(null)
        }
      })
    }
  })
}
