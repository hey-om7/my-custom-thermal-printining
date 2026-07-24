# Label Designer

A desktop application for designing and printing thermal labels on MXW01-based Bluetooth "Cat Printers". Built with Electron, React, Konva, and TypeScript.

## Supported Printers

- **MXW01 Cat Printers** — 384px wide (57mm paper), Bluetooth Low Energy
- Devices advertising as `MXW01-XXXX` over BLE
- Sold under various brand names on AliExpress, Amazon, etc. (typically $20-30)

## Features

- **Visual label designer** with drag-and-drop canvas editor
- **Text elements** — custom fonts, sizes, weight, alignment
- **Barcodes** — Code128, EAN13, UPC, and more via JsBarcode
- **QR codes** — dynamic QR code generation
- **Shapes** — rectangles, circles, lines, arrows (filled or outlined)
- **Images** — import and place images on the label
- **Print preview** — see the exact optimized image before printing (confirms what will be sent to the printer)
- **Multiple label presets** — including a dedicated CatPrinter mode
- **Sketch management** — save, load, and organize label designs
- **Undo/Redo** — full history support
- **Print crop settings** — configurable upper crop (top trim) and bottom crop (feed trim) to align print position
- **BLE device management** — scan, pair, and persist printer connection settings
- **Keyboard shortcuts** — Cmd+P (print), Cmd+S (save), Cmd+Z (undo), Cmd+Shift+Z (redo), Cmd+N (new)

## Label Presets

| Preset | Dimensions | Notes |
|--------|-----------|-------|
| CatPrinter | 48 x 14 mm | Native printer width (384px), printable area only |
| Standard | 50 x 30 mm | Common die-cut label |
| Small | 40 x 30 mm | |
| Medium | 60 x 40 mm | |
| Large | 80 x 50 mm | |
| Extra Large | 100 x 60 mm | |
| Receipt | 48 x 25 mm | Continuous roll style |

Custom dimensions can also be entered manually (10-200mm range).

## CatPrinter Mode

The **CatPrinter** preset is designed specifically for the MXW01 printer:

- Canvas width = 384px (48mm) — matches the printer's native head width exactly. No horizontal resizing occurs, so what you design is pixel-for-pixel what prints.
- Canvas height = 14mm — represents the actual usable printable area on a 20mm label (accounting for the printer's mechanical pre-feed).
- **No crop/trim is applied** in this mode — the image passes through to the printer as-is.

## Print Crop Settings

Found in **Settings > Print Crop Settings**:

- **Upper Crop (Top Trim):** Shifts image content upward by removing lines from the top. Compensates for the printer's physical feed offset. Range: 0-100 lines.
- **Bottom Crop (Feed Trim):** Trims lines from the bottom of the image. Reduces excess paper advance after printing. Range: 0-100 lines.

These settings are applied to all non-CatPrinter-mode labels. In CatPrinter mode (canvas width = 384px), both are automatically set to 0.

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- macOS (for Bluetooth BLE support via `@stoprocent/noble`)

### Install Dependencies

```bash
npm install
```

### Development

Run the app in development mode with hot-reload:

```bash
npm run dev
```

### Build

Compile the app (main, preload, and renderer):

```bash
npm run build
```

### Preview

Run the compiled build locally (without packaging):

```bash
npm run preview
```

### Package for Distribution

Create a distributable `.dmg` and `.zip` for macOS:

```bash
npm run package
```

Or just the `.dmg`:

```bash
npm run package:dmg
```

Output files are placed in the `release/` directory.

## Project Structure

```
src/
  main/              # Electron main process
    index.ts         # App lifecycle, IPC handlers, menu
    printer/
      index.ts       # BLE print orchestration (connect, send, flush)
      image.ts       # Image preparation (resize, 1bpp packing)
      mxw01.ts       # MXW01 BLE protocol (commands, CRC, constants)
  preload/
    index.ts         # contextBridge API (IPC bridge to renderer)
  renderer/
    App.tsx          # Root app component
    components/
      Canvas.tsx     # Konva canvas editor
      PrintButton.tsx        # Print trigger with preview flow
      PrintPreviewDialog.tsx # Modal showing optimized print image
      StartupModal.tsx       # Label dimension/preset selection
      PropertiesSidebar.tsx  # Element property editor
      Toolbar.tsx            # Drawing tools
      IconsPanel.tsx         # Shape/icon picker
      Homepage.tsx           # Sketch browser
      Settings.tsx           # Device & crop settings
      BleOnboarding.tsx      # First-time BLE setup wizard
    hooks/
      useStore.ts    # App state, sketch persistence, undo/redo
    lib/
      types.ts       # TypeScript interfaces (elements, dimensions)
      utils.ts       # Tailwind utilities
```

## How Printing Works

1. **Canvas capture** — Konva stage is captured at 1:1 pixel ratio as a PNG.
2. **Preview** — The captured image is sent to the main process, converted to grayscale, resized to 384px wide, and returned as a preview PNG. The print preview dialog shows this exact image.
3. **Confirmation** — User clicks "Confirm & Print" to proceed.
4. **BLE connection** — App scans for and connects to the saved printer device.
5. **Image encoding** — Grayscale pixels are packed into 1-bit-per-pixel format (black=1, white=0, LSB-first).
6. **Transmission** — Intensity is set, status is checked, print request is sent with line count, then image data is streamed in 48-byte chunks (one line at a time) over the AE03 data characteristic.
7. **Completion** — Flush command is sent, and the app waits for a print-complete notification.

## MXW01 BLE Protocol Summary

| Characteristic | UUID | Purpose |
|---------------|------|---------|
| Control (AE01) | `0000ae01-...` | Send commands (write without response) |
| Notify (AE02) | `0000ae02-...` | Receive status/ack notifications |
| Data (AE03) | `0000ae03-...` | Send image data (write without response) |

| Command | ID | Description |
|---------|-----|-------------|
| Get Status | `0xA1` | Query printer state (paper, temp, battery) |
| Set Intensity | `0xA2` | Print darkness (0x00-0xFF, default 0xFF) |
| Print Request | `0xA9` | Start print job with line count |
| Flush | `0xAD` | Signal end of image data |
| Print Complete | `0xAA` | Notification when physical print finishes |

## Known Limitations

- **Pre-feed offset:** The MXW01 firmware physically advances paper before printing starts. This is a hardware characteristic — no BLE command can eliminate it. The CatPrinter mode accounts for this by sizing the canvas to only the printable area.
- **No gap/mark sensor:** The MXW01 is a continuous-paper printer with no ability to detect die-cut label boundaries.
- **macOS only:** BLE support via `@stoprocent/noble` is currently macOS-focused.

## License

Private project.
