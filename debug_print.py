"""
Diagnostic printing script that tries multiple approaches to identify
what protocol the "Toy Imagine" / "Fun Print" BLE thermal printer expects.

Run with: python3 debug_print.py
"""
import asyncio
from bleak import BleakClient

PRINTER_UUID = "125E00AC-7BF0-5657-CF16-3BFB94897328"
TX_CHAR = "0000ae01-0000-1000-8000-00805f9b34fb"
RX_CHAR = "0000ae02-0000-1000-8000-00805f9b34fb"

CHUNK_SIZE = 60
CHUNK_DELAY = 0.02


def notification_handler(sender, data):
    print(f"  📩 NOTIFICATION from {sender}: {data.hex()} ({len(data)} bytes)")


async def send_data(client, data, label=""):
    """Send data in chunks and wait briefly."""
    if label:
        print(f"  → Sending: {label} ({len(data)} bytes)")
    for i in range(0, len(data), CHUNK_SIZE):
        chunk = data[i:i + CHUNK_SIZE]
        await client.write_gatt_char(TX_CHAR, chunk, response=False)
        await asyncio.sleep(CHUNK_DELAY)


def make_catprinter_test_pattern():
    """
    Generate catprinter 0x5178 protocol data for a simple test pattern:
    10 all-black rows (should print a visible dark band).
    """
    from catprinter.cmds import (
        CMD_GET_DEV_STATE, CMD_SET_QUALITY_200_DPI,
        CMD_LATTICE_START, CMD_LATTICE_END, CMD_SET_PAPER,
        cmd_set_energy, cmd_apply_energy, cmd_feed_paper, cmd_print_row
    )
    import numpy as np

    # Create 20 rows of all-black pixels (should be unmissable)
    test_rows = np.ones((20, 384), dtype=bool)

    data = bytearray()
    data += CMD_GET_DEV_STATE
    data += CMD_SET_QUALITY_200_DPI
    data += cmd_set_energy(0xffff)
    data += cmd_apply_energy()
    data += CMD_LATTICE_START
    for row in test_rows:
        data += cmd_print_row(row)
    data += cmd_feed_paper(25)
    data += CMD_SET_PAPER
    data += CMD_SET_PAPER
    data += CMD_SET_PAPER
    data += CMD_LATTICE_END
    data += CMD_GET_DEV_STATE
    return data


def make_escpos_test_pattern():
    """
    Generate ESC/POS raster image for a simple test pattern:
    20 all-black rows at 384px width.
    """
    width_bytes = 384 // 8  # 48
    height_dots = 20

    data = bytearray()
    # ESC @ - Initialize printer
    data.extend([0x1B, 0x40])
    # GS v 0 - Print raster bit image
    data.extend([0x1D, 0x76, 0x30, 0x00])
    data.append(width_bytes % 256)  # xL
    data.append(width_bytes // 256)  # xH
    data.append(height_dots % 256)  # yL
    data.append(height_dots // 256)  # yH
    # All black = all bits set to 1
    for y in range(height_dots):
        for x in range(width_bytes):
            data.append(0xFF)
    # Feed paper
    data.extend([0x0A] * 4)
    return data


def make_simple_bitmap_test():
    """
    Some printers use a simpler bitmap protocol:
    ESC * (bit image mode) or DC2 * for line-by-line printing.
    """
    width_bytes = 384 // 8  # 48
    data = bytearray()
    # ESC @ - Initialize
    data.extend([0x1B, 0x40])
    
    # Try DC2 * format (used by some Chinese mini printers)
    # DC2 * r n [data] where r=rows, n=width_bytes
    for row in range(20):
        # Some printers use 0x12 0x2A (DC2 *) for each line
        data.extend([0x12, 0x2A, 0x01, width_bytes])
        data.extend([0xFF] * width_bytes)
    
    # Feed
    data.extend([0x0A] * 4)
    return data


def make_gbk_bitmap_test():
    """
    Some printers (especially those using 'GB' naming) use:
    GS v 0 m (mode 0 = normal, mode 1 = double width, etc.)
    But with width = 48 bytes = 384 dots.
    Another variant: just send raw bitmap lines with a header per line.
    """
    width_bytes = 48
    data = bytearray()
    # Initialize
    data.extend([0x1B, 0x40])
    # Set line spacing to 0 for seamless bitmap
    data.extend([0x1B, 0x33, 0x00])
    
    # Print 20 lines using ESC * (select bit-image mode)
    for row in range(20):
        # ESC * m nL nH [data]
        # m=33 for 24-dot double-density... but for 8-dot single density: m=0
        # Actually for thermal printers, let's use m=0 (8-dot single density)
        n = 384
        nL = n % 256
        nH = n // 256
        data.extend([0x1B, 0x2A, 0x00, nL, nH])
        data.extend([0xFF] * 384)  # Each byte = 8 vertical dots
        data.append(0x0A)  # Line feed after each line
    
    # Reset line spacing
    data.extend([0x1B, 0x32])
    # Feed
    data.extend([0x0A] * 4)
    return data


async def test_approach(client, name, data):
    """Test a single approach and wait for response."""
    print(f"\n{'='*50}")
    print(f"🧪 Testing: {name}")
    print(f"   Payload size: {len(data)} bytes")
    print(f"   First 20 bytes: {data[:20].hex()}")
    print(f"{'='*50}")
    
    await send_data(client, data, name)
    
    # Wait and watch for notifications
    print("  ⏳ Waiting 5 seconds for printer response...")
    await asyncio.sleep(5)
    print("  ✅ Done waiting.")


async def main():
    print(f"📡 Connecting to {PRINTER_UUID}...")
    
    async with BleakClient(PRINTER_UUID) as client:
        print(f"✅ Connected! MTU: {client.mtu_size}")
        
        # List all services and characteristics for debugging
        print("\n📋 Services and Characteristics:")
        for service in client.services:
            print(f"  Service: {service.uuid}")
            for char in service.characteristics:
                props = ",".join(char.properties)
                print(f"    Char: {char.uuid} [{props}]")
        
        # Subscribe to notifications
        print("\n📡 Subscribing to notifications on RX characteristic...")
        try:
            await client.start_notify(RX_CHAR, notification_handler)
            print("  ✅ Subscribed to notifications")
        except Exception as e:
            print(f"  ⚠️ Could not subscribe to {RX_CHAR}: {e}")
            # Try finding another notifiable characteristic
            for service in client.services:
                for char in service.characteristics:
                    if "notify" in char.properties and char.uuid != RX_CHAR:
                        print(f"  → Trying alternate: {char.uuid}")
                        try:
                            await client.start_notify(char.uuid, notification_handler)
                            print(f"  ✅ Subscribed to {char.uuid}")
                        except Exception as e2:
                            print(f"  ❌ Failed: {e2}")

        # First, just send GET_DEV_STATE and see if we get a response
        print("\n" + "="*50)
        print("🧪 Testing: GET_DEV_STATE only (checking if printer responds)")
        print("="*50)
        from catprinter.cmds import CMD_GET_DEV_STATE
        await send_data(client, CMD_GET_DEV_STATE, "CMD_GET_DEV_STATE")
        print("  ⏳ Waiting 3 seconds for response...")
        await asyncio.sleep(3)

        # Now test different approaches
        print("\n\n" + "#"*60)
        print("# Which approach would you like to test?")
        print("# 1) catprinter 0x5178 protocol (GB/GT series)")
        print("# 2) ESC/POS GS v 0 raster")
        print("# 3) DC2 * bitmap (some Chinese mini printers)")
        print("# 4) ESC * bit-image mode")
        print("# 5) All of the above (one at a time)")
        print("#"*60)
        
        choice = input("\nEnter choice (1-5): ").strip()
        
        tests = {
            "1": [("catprinter 0x5178 protocol", make_catprinter_test_pattern())],
            "2": [("ESC/POS GS v 0 raster", make_escpos_test_pattern())],
            "3": [("DC2 * bitmap", make_simple_bitmap_test())],
            "4": [("ESC * bit-image mode", make_gbk_bitmap_test())],
        }
        
        if choice == "5":
            test_list = []
            for k in ["1", "2", "3", "4"]:
                test_list.extend(tests[k])
        elif choice in tests:
            test_list = tests[choice]
        else:
            print("Invalid choice, testing all...")
            test_list = []
            for k in ["1", "2", "3", "4"]:
                test_list.extend(tests[k])
        
        for name, data in test_list:
            await test_approach(client, name, data)
            if len(test_list) > 1:
                cont = input("\n  Did anything print? (y/n/q to quit): ").strip().lower()
                if cont == 'y':
                    print(f"\n🎉 SUCCESS! The printer uses: {name}")
                    break
                elif cont == 'q':
                    break
        
        print("\n✅ All tests complete. Disconnecting...")


if __name__ == "__main__":
    asyncio.run(main())
