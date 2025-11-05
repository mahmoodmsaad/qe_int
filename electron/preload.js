import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  openXYZ: () => ipcRenderer.invoke('file:openXYZ'),
  saveXYZ: (content) => ipcRenderer.invoke('file:saveXYZ', content)
})
