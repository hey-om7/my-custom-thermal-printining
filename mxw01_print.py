"""
MXW01 Cat Printer driver.

The printer sold as "Toy Imagine" / "Fun Print" is an MXW01 model. It uses a
completely different BLE protocol than the classic cat printers (GB01/GT01):

  - Control commands  -> characteristic AE01
  - Status/ack notify -> characteristic AE02
  - BULK IMAGE DATA   -> characteristic AE03   <-- the key difference

Protocol reference:
  https://github.com/jeremy46231/MXW01-catprinter/blob/main/PROTOCOL.md
"""
import asyncio
from typing import Optional

from bleak import BleakClient

from catprinter import logger
from catprinter.cmds import PRINT_WIDTH  # 384
from catprinter.img import read_img

# --- BLE UUIDs -------------------------------------------------------------
MAIN_SERVICE_UUID = "0000ae30-0000-1000-8000-00805f9b34fb"
CONTROL_CHAR_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"  # write commands
NOTIFY_CHAR_UUID = "0000ae02-0000-1000-8000-00805f9b34fb"   # notifications
DATA_CHAR_UUID = "0000ae03-0000-1000-8000-00805f9b34fb"     # bulk image data

# --- Protocol constants ----------------------------------------------------
PREAMBLE = bytes([0x22, 0x21])
FOOTER = 0xFF

CMD_GET_STATUS = 0xA1
CMD_SET_INTENSITY = 0xA2
CMD_PRINT_REQUEST = 0xA9
CMD_FLUSH = 0xAD
CMD_PRINT_COMPLETE = 0xAA

BYTES_PER_LINE = PRINT_WIDTH // 8  # 48
MIN_DATA_BYTES = 4320              # printer expects at least this much (90 lines)

CHUNK_SIZE = 180                   # bulk data chunk size
CHUNK_DELAY_S = 0.02


# --- CRC-8 / DALLAS-MAXIM --------------------------------------------------
def _make_crc8_table():
    table = []
    for i in range(256):
        crc = i
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if (crc & 0x80) else (crc << 1) & 0xFF
        table.append(crc)
    return table


_CRC8_TABLE = _make_crc8_table()


def crc8(data: bytes) -> int:
    crc = 0x00
    for b in data:
        crc = _CRC8_TABLE[(crc ^ b) & 0xFF]
    return crc


def build_command(cmd_id: int, payload: bytes) -> bytes:
    """Build an AE01 control packet."""
    length = len(payload)
    pkt = bytearray()
    pkt += PREAMBLE
    pkt.append(cmd_id)
    pkt.append(0x00)                      # fixed/unknown
    pkt.append(length & 0xFF)             # length LE low
    pkt.append((length >> 8) & 0xFF)      # length LE high
    pkt += payload
    pkt.append(crc8(payload))
    pkt.append(FOOTER)
    return bytes(pkt)


# --- Image encoding --------------------------------------------------------
def encode_image(bin_img) -> tuple[bytes, int]:
    """
    Convert a boolean image (True = black/ink) into the MXW01 packed byte
    buffer. Each 384-wide row -> 48 bytes, LSB = leftmost pixel, black = 1.
    Returns (data_bytes, line_count).
    """
    data = bytearray()
    for row in bin_img:
        for chunk_start in range(0, len(row), 8):
            byte = 0
            for bit in range(8):
                if chunk_start + bit < len(row) and row[chunk_start + bit]:
                    byte |= (1 << bit)   # bit 0 = leftmost pixel
            data.append(byte)

    line_count = len(bin_img)

    # Pad to the minimum buffer size the printer expects.
    if len(data) < MIN_DATA_BYTES:
        pad_bytes = MIN_DATA_BYTES - len(data)
        data += bytes(pad_bytes)
        line_count = len(data) // BYTES_PER_LINE

    return bytes(data), line_count


# --- Printing --------------------------------------------------------------
class MXW01:
    def __init__(self, client: BleakClient):
        self.client = client
        self._status_evt = asyncio.Event()
        self._print_req_evt = asyncio.Event()
        self._complete_evt = asyncio.Event()
        self._last_status_payload: Optional[bytes] = None
        self._print_req_ok = False

    def _handle_notification(self, _sender, data: bytearray):
        logger.debug(f"📩 Notify: {bytes(data).hex()}")
        if len(data) < 4 or data[0] != 0x22 or data[1] != 0x21:
            logger.debug("   (ignored, bad preamble)")
            return
        cmd_id = data[2]
        length = data[4] | (data[5] << 8) if len(data) >= 6 else 0
        payload = data[6:6 + length] if len(data) >= 6 + length else data[6:]

        if cmd_id == CMD_GET_STATUS:
            self._last_status_payload = payload
            self._status_evt.set()
        elif cmd_id == CMD_PRINT_REQUEST:
            # First payload byte 0x00 = OK
            self._print_req_ok = (len(payload) >= 1 and payload[0] == 0x00)
            self._print_req_evt.set()
        elif cmd_id == CMD_PRINT_COMPLETE:
            self._complete_evt.set()

    async def start(self):
        await self.client.start_notify(NOTIFY_CHAR_UUID, self._handle_notification)

    async def _send_cmd(self, cmd_id: int, payload: bytes):
        pkt = build_command(cmd_id, payload)
        logger.debug(f"→ CMD {cmd_id:02x}: {pkt.hex()}")
        await self.client.write_gatt_char(CONTROL_CHAR_UUID, pkt, response=False)

    async def set_intensity(self, intensity: int):
        await self._send_cmd(CMD_SET_INTENSITY, bytes([intensity & 0xFF]))

    async def get_status(self, timeout=5.0) -> Optional[bytes]:
        self._status_evt.clear()
        await self._send_cmd(CMD_GET_STATUS, bytes([0x00]))
        try:
            await asyncio.wait_for(self._status_evt.wait(), timeout=timeout)
            return self._last_status_payload
        except asyncio.TimeoutError:
            return None

    async def print_request(self, line_count: int, timeout=5.0) -> bool:
        self._print_req_evt.clear()
        payload = bytes([
            line_count & 0xFF,
            (line_count >> 8) & 0xFF,
            0x30,
            0x00,  # mode 0 = 1bpp
        ])
        await self._send_cmd(CMD_PRINT_REQUEST, payload)
        try:
            await asyncio.wait_for(self._print_req_evt.wait(), timeout=timeout)
            return self._print_req_ok
        except asyncio.TimeoutError:
            return False

    async def send_image_data(self, data: bytes):
        for i in range(0, len(data), CHUNK_SIZE):
            chunk = data[i:i + CHUNK_SIZE]
            await self.client.write_gatt_char(DATA_CHAR_UUID, chunk, response=False)
            await asyncio.sleep(CHUNK_DELAY_S)

    async def flush(self):
        await self._send_cmd(CMD_FLUSH, bytes([0x00]))

    async def wait_for_complete(self, timeout=30.0) -> bool:
        try:
            await asyncio.wait_for(self._complete_evt.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False


async def print_image(image_path: str, device: str, intensity: int = 0x5D,
                      binarization: str = "floyd-steinberg"):
    # 1. Prepare image
    logger.info(f"⏳ Reading and dithering image {image_path}...")
    bin_img = read_img(image_path, PRINT_WIDTH, binarization)
    logger.info(f"✅ Image: {bin_img.shape} (h, w)")

    data, line_count = encode_image(bin_img)
    logger.info(f"✅ Encoded image data: {len(data)} bytes, {line_count} lines")

    # 2. Connect
    logger.info(f"⏳ Connecting to {device}...")
    async with BleakClient(device) as client:
        logger.info(f"✅ Connected: {client.is_connected}; MTU: {client.mtu_size}")
        printer = MXW01(client)
        await printer.start()

        # 3. Set intensity
        await printer.set_intensity(intensity)
        await asyncio.sleep(0.1)

        # 4. Check status
        status = await printer.get_status()
        if status is None:
            logger.error("🛑 No status response from printer. Aborting.")
            return
        logger.info(f"✅ Printer status payload: {status.hex()}")
        # Payload[12] = overall status flag (0 = OK)
        if len(status) > 12 and status[12] != 0:
            err = status[13] if len(status) > 13 else "?"
            logger.error(f"🛑 Printer not ready. Status flag={status[12]}, error={err} "
                         f"(1/9=no paper, 4=overheated, 8=low battery)")
            return

        # 5. Print request
        logger.info(f"⏳ Sending print request for {line_count} lines...")
        ok = await printer.print_request(line_count)
        if not ok:
            logger.error("🛑 Print request rejected by printer. Aborting.")
            return
        logger.info("✅ Print request accepted.")

        # 6. Transfer image data over AE03
        logger.info(f"⏳ Sending {len(data)} bytes of image data over AE03...")
        await printer.send_image_data(data)

        # 7. Flush
        await printer.flush()
        logger.info("✅ Data sent and flushed. Waiting for print to complete...")

        # 8. Wait for completion
        done = await printer.wait_for_complete(timeout=30.0)
        if done:
            logger.info("🎉 Print complete!")
        else:
            logger.warning("⚠️ No completion notification, but data was sent. "
                            "Check if it printed.")
        await asyncio.sleep(1.0)


if __name__ == "__main__":
    import argparse
    import logging
    import sys

    parser = argparse.ArgumentParser(description="Print an image on an MXW01 cat printer")
    parser.add_argument("filename")
    parser.add_argument("-d", "--device", required=True,
                        help="Printer BLE address/UUID")
    parser.add_argument("-i", "--intensity", type=lambda x: int(x, 0), default=0x5D,
                        help="Print intensity 0x00-0xFF (default 0x5D)")
    parser.add_argument("-b", "--binarization", default="floyd-steinberg",
                        choices=["mean-threshold", "floyd-steinberg", "atkinson",
                                 "halftone", "none"])
    parser.add_argument("-l", "--log-level", default="info",
                        choices=["debug", "info", "warn", "error"])
    args = parser.parse_args()

    logger.setLevel(getattr(logging, args.log_level.upper()))
    h = logging.StreamHandler(sys.stdout)
    h.setLevel(logger.level)
    logger.addHandler(h)

    asyncio.run(print_image(args.filename, args.device, args.intensity,
                            args.binarization))
