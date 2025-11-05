# Atomic Painter Desktop

A desktop application for visualizing and manipulating atomic structures in 3D. Built with Electron, React, and Three.js.

## Features

- 📊 3D visualization of atomic structures
- 🔄 Import/Export XYZ format files
- ⚙️ Create supercells with custom lattice vectors
- 🎨 Interactive atom manipulation with transform controls
- 🎯 Element selection and color customization

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

```bash
npm install
```

## Development

Run the app in development mode:

```bash
npm run dev
```

This will:
1. Start Vite dev server on http://localhost:5173
2. Automatically launch the Electron desktop app

## Build

Build the application for production:

```bash
npm run build
```

This creates a distributable installer in the `dist/` folder:
- Windows: `.exe` (NSIS installer)
- macOS: `.dmg`
- Linux: `.AppImage`

## Usage

1. **Add Atoms**: Click "+ Add P atom" to add new atoms
2. **Select Atoms**: Click on any atom in the 3D view
3. **Transform**: Use the gizmo to move, rotate, or scale atoms
4. **Import/Export**: Load or save XYZ structure files
5. **Create Supercells**: Define lattice vectors and replication factors

### Keyboard Shortcuts

- `G` - Cycle through gizmo modes (translate/rotate/scale)
- `Delete` - Remove selected atom
- `Esc` - Clear selection

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **Vite** - Build tool and dev server
- **Three.js** - 3D graphics
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for React Three Fiber

## License

Private

## Author

Atomic Painter Team
