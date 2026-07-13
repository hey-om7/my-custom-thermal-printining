import asyncio
import io
import os
from bleak import BleakClient
from playwright.async_api import async_playwright
from PIL import Image

# ================= CONFIGURATION =================
PRINTER_MAC_UUID = "125E00AC-7BF0-5657-CF16-3BFB94897328"
# The exact "door" we discovered using the discover.py script
WRITE_CHARACTERISTIC_UUID = "0000ae01-0000-1000-8000-00805f9b34fb" 

HTML_FILE = "label.html"
PRINTER_WIDTH_PIXELS = 384
# =================================================

async def render_html_to_image() -> Image.Image:
    print("🎨 Rendering HTML to image using Playwright...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        file_url = f"file://{os.path.abspath(HTML_FILE)}"
        await page.goto(file_url)
        
        body_element = await page.query_selector("body")
        screenshot_bytes = await body_element.screenshot()
        await browser.close()
        return Image.open(io.BytesIO(screenshot_bytes))

def image_to_escpos_bytes(img: Image.Image) -> bytearray:
    print("⚙️ Converting image to pure ESC/POS raster format...")
    if img.width != PRINTER_WIDTH_PIXELS:
        ratio = PRINTER_WIDTH_PIXELS / img.width
        new_height = int(img.height * ratio)
        img = img.resize((PRINTER_WIDTH_PIXELS, new_height), Image.Resampling.LANCZOS)

    bw_img = img.convert('1')
    width_bytes = bw_img.width // 8
    height_dots = bw_img.height

    # Standard ESC/POS commands (NO catprinter magic checksums)
    escpos_data = bytearray([0x1B, 0x40]) # Command: Initialize printer
    escpos_data.extend([0x1D, 0x76, 0x30, 0x00]) # Command: Print raster image
    escpos_data.append(width_bytes % 256)
    escpos_data.append(width_bytes // 256)
    escpos_data.append(height_dots % 256)
    escpos_data.append(height_dots // 256)

    pixels = bw_img.load()
    for y in range(height_dots):
        for x_byte in range(width_bytes):
            current_byte = 0
            for bit in range(8):
                if pixels[x_byte * 8 + bit, y] == 0:
                    current_byte |= (1 << (7 - bit))
            escpos_data.append(current_byte)
            
    # Command: Feed paper 4 lines so you can tear it off cleanly
    escpos_data.extend([0x0A, 0x0A, 0x0A, 0x0A]) 
    return escpos_data

async def print_to_device(escpos_data: bytearray):
    print(f"📡 Connecting to printer ({PRINTER_MAC_UUID})...")
    try:
        async with BleakClient(PRINTER_MAC_UUID) as client:
            print("✅ Connected!")
            
            # Safe limits so the hardware doesn't choke
            chunk_size = 60 
            total_chunks = len(escpos_data) // chunk_size + 1
            
            print(f"🚀 Streaming {len(escpos_data)} bytes in {total_chunks} chunks...")
            for i in range(0, len(escpos_data), chunk_size):
                chunk = escpos_data[i:i+chunk_size]
                # write-without-response matches the property we found earlier
                await client.write_gatt_char(WRITE_CHARACTERISTIC_UUID, chunk, response=False)
                await asyncio.sleep(0.02) # Give the printer 20ms to digest
                
            print("⏳ Data sent! Keeping connection alive for 3 seconds...")
            await asyncio.sleep(3) # Let the physical motors finish
            print("🎉 Print job complete!")
            
    except Exception as e:
        print(f"❌ Failed to print: {e}")

async def main():
    img = await render_html_to_image()
    payload = image_to_escpos_bytes(img)
    await print_to_device(payload)

if __name__ == "__main__":
    asyncio.run(main())