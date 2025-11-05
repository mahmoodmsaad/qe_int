import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

let win
const isDev = process.env.VITE_DEV_SERVER_URL

function createWindow () {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(process.cwd(), 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.cwd(), 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// --- File I/O: .xyz ---
ipcMain.handle('file:openXYZ', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'XYZ', extensions: ['xyz', 'txt'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return { ok: false }
  const content = fs.readFileSync(filePaths[0], 'utf8')
  return { ok: true, content }
})

ipcMain.handle('file:saveXYZ', async (_e, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    filters: [{ name: 'XYZ', extensions: ['xyz'] }],
    defaultPath: 'structure.xyz'
  })
  if (canceled || !filePath) return { ok: false }
  fs.writeFileSync(filePath, content, 'utf8')
  return { ok: true }
})
