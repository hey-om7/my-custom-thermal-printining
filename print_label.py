import asyncio
import os
from playwright.async_api import async_playwright

# ================= CONFIGURATION =================
PRINTER_MAC_UUID = "125E00AC-7BF0-5657-CF16-3BFB94897328"
HTML_FILE = "label.html"
# =================================================

async def render_html_to_image():
    print("🎨 Rendering HTML to image using Playwright...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Load local HTML file
        file_url = f"file://{os.path.abspath(HTML_FILE)}"
        await page.goto(file_url)
        
        # Take a clean screenshot of just the label boundary
        body_element = await page.query_selector("body")
        await body_element.screenshot(path="label.png")
        await browser.close()
        print("✅ Saved HTML as label.png")

async def main():
    # 1. Render the HTML into a perfect PNG
    await render_html_to_image()

    # 2. Hand the image off to the MXW01 protocol driver.
    #    This printer (Toy Imagine / Fun Print) is an MXW01 model that sends
    #    bulk image data over the AE03 characteristic, not the classic AE01.
    print("📡 Passing image to the MXW01 protocol handler...")
    from mxw01_print import print_image
    await print_image("label.png", PRINTER_MAC_UUID, intensity=0xC0)

if __name__ == "__main__":
    asyncio.run(main())