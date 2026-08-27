# Dockly

[日本語](README.md) | [English](README.en.md)

A simple Windows desktop launcher that lets you open your favorite websites and apps instantly with a single hotkey.

![Demo](docs/images/demo.gif)

## Features

- **Launch with a hotkey**: Press your configured key (default: `Ctrl+Alt+L`) to bring up the search bar. Press it again, or click away, to hide it.
- **Incremental search**: Filter your saved shortcuts by name or description, then select with `↑` `↓` (or `Tab` / `Shift+Tab`) and press `Enter` to launch.
- **URLs and apps**: Register website URLs as well as local app paths (`.exe`, etc.).
- **Bulk management via CSV**: Import and export your shortcuts as CSV (`Name,URL,Description`; Description is optional).
- **Runs in the system tray**: Doesn't clutter your taskbar — use the tray icon for Show / Settings / Quit.
- **Automatic update check**: Check for the latest version on GitHub Releases from the settings screen and install it right away.

## Installation

Download the latest `Dockly-Setup-x.x.x.exe` from the [Releases](https://github.com/sok41/dockly/releases) page and run it.

### If you see "Windows protected your PC"

This is a **standard Windows notice** that commonly appears for small, independently-developed apps. It shows up because Dockly hasn't yet been run by enough people for Windows to recognize it — it does **not** mean any virus or malware was detected.

You can safely continue with the installation:

1. Click "More info" (if shown)
2. Click "Run anyway"

Installation will then proceed as normal. If you'd like to double-check, the full [source code](https://github.com/sok41/dockly) is public.

> Code signing will be added in a future release to remove this notice entirely.

## Usage

### 1. Launch the app

After installing, Dockly runs in the system tray. Press your hotkey (default `Ctrl+Alt+L`) to bring up the search bar.

### 2. Add shortcuts

Right-click the tray icon → "Settings" to open the settings window.

1. Select "Shortcuts" in the left sidebar
2. Enter a name, description, URL/file path, and type (Web / App), then click "Add"
3. Remove entries you no longer need with the delete icon

To register shortcuts in bulk, use "Bulk Actions (CSV)" to import a CSV file with the columns `Name,URL,Description` (the Description column is optional). You can also export your current shortcuts as CSV.

### 3. Search and launch

Open the search bar with your hotkey and type part of a name or description to see matching results. Select with `↑` `↓` and press `Enter`, or click with the mouse — URLs open in your browser, apps launch as executables.

### 4. Change the hotkey

On the "Hotkey" tab in settings, click the key field, then actually press the key combination (modifier + key) you want to assign — it's captured automatically. Click "Save" to apply it.

> If the same combination is already used by another app, registration may fail. A message will let you know when this happens, so try a different combination.

### 5. Check for updates

On the "About" tab in settings, below the license info, click "Check for Updates" to check the latest release on GitHub. If a new version is available, a dialog will let you install and restart right away.

## For Developers

```bash
npm install       # Install dependencies
npm run dev        # Run in development mode (Vite + Electron)
npm run build       # Build (outputs a Windows installer to release/)
npm run lint        # Run ESLint
```

- Frontend: React + TypeScript + Vite
- Desktop: Electron
- Data storage: `electron-store` (stored locally as JSON)
- Auto-update: `electron-updater` (via GitHub Releases)

## License

MIT License
