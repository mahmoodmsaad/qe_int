import './styles.css'
import type { Atom, Bond, Lattice, Representation, LoadOptions } from './viewer'
import { MoleculeViewer } from './viewer'

const container = document.getElementById('app') as HTMLElement
if (!container) {
  throw new Error('Missing #app container')
}

container.style.position = 'relative'

const hud = document.createElement('div')
hud.className = 'viewer-hud'
container.appendChild(hud)

const viewer = new MoleculeViewer(container)
viewer.attachHud(hud)

let currentRepresentation: Representation = 'ball'

const sampleAtoms: Atom[] = [
  { element: 'Cu', pos: [0, 0, 0] },
  { element: 'Cu', pos: [1.8075, 1.8075, 0] },
  { element: 'Cu', pos: [1.8075, 0, 1.8075] },
  { element: 'Cu', pos: [0, 1.8075, 1.8075] }
]

const sampleBonds: Bond[] = [
  [0, 1], [0, 2], [0, 3],
  [1, 2], [1, 3],
  [2, 3]
]

const sampleLattice: Lattice = {
  a: [3.615, 0, 0],
  b: [0, 3.615, 0],
  c: [0, 0, 3.615]
}

viewer.loadMolecule(sampleAtoms, sampleBonds, sampleLattice, { replication: [1, 1, 1] })

function loadMolecule(atoms: Atom[], bonds: Bond[], lattice: Lattice, options?: LoadOptions) {
  viewer.loadMolecule(atoms, bonds, lattice, options)
}

function setRepresentation(mode: Representation) {
  currentRepresentation = mode
  viewer.setRepresentation(mode)
}

function toggleRepresentation() {
  currentRepresentation = currentRepresentation === 'ball' ? 'vdw' : 'ball'
  viewer.setRepresentation(currentRepresentation)
}

function toggleMeasurement() {
  viewer.toggleMeasurement()
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return
  if (event.key === 'r' || event.key === 'R') {
    toggleRepresentation()
  }
  if (event.key === 'm' || event.key === 'M') {
    toggleMeasurement()
  }
})

declare global {
  interface Window {
    loadMolecule: typeof loadMolecule
    setRepresentation: typeof setRepresentation
  }
}

window.loadMolecule = loadMolecule
window.setRepresentation = setRepresentation

export { loadMolecule, setRepresentation }
