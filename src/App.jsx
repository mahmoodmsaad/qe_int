import React, { useEffect, useState } from 'react'
import MoleculeViewer from './components/MoleculeViewer.jsx'
import { loadMolecule, setRepresentation, registerRepresentationHandler } from './viewerController.js'
import './styles.css'

const SAMPLE_MOLECULE = {
  atoms: [
    { element: 'Si', pos: [0, 0, 0] },
    { element: 'Si', pos: [2.715, 2.715, 0] },
    { element: 'Si', pos: [2.715, 0, 2.715] },
    { element: 'Si', pos: [0, 2.715, 2.715] }
  ],
  bonds: [
    [0, 1],
    [0, 2],
    [0, 3]
  ],
  lattice: {
    a: [5.43, 0, 0],
    b: [0, 5.43, 0],
    c: [0, 0, 5.43]
  }
}

export default function App() {
  const [replication, setReplication] = useState([1, 1, 1])
  const [representation, setRepresentationState] = useState('ball')

  useEffect(() => {
    loadMolecule(SAMPLE_MOLECULE.atoms, SAMPLE_MOLECULE.bonds, SAMPLE_MOLECULE.lattice)
  }, [])

  useEffect(() => {
    const unsubscribe = registerRepresentationHandler((mode) => {
      if (mode === 'ball' || mode === 'vdw') {
        setRepresentationState(mode)
      }
    })
    return unsubscribe
  }, [])

  const updateRepresentation = (mode) => {
    setRepresentationState(mode)
    setRepresentation(mode)
  }

  const handleReplicationChange = (axis, value) => {
    const numeric = Number(value)
    const clamped = Number.isFinite(numeric) ? Math.min(3, Math.max(1, Math.round(numeric))) : 1
    setReplication((prev) => {
      const next = [...prev]
      next[axis] = clamped
      return next
    })
  }

  return (
    <div className="app-shell">
      <aside className="control-panel">
        <h1 className="panel-title">Materials Viewer</h1>
        <p className="panel-subtitle">Matches the BIOVIA Materials Studio look and feel.</p>

        <section className="control-group">
          <header className="control-label">Representation</header>
          <div className="control-buttons">
            <button
              type="button"
              className={representation === 'ball' ? 'control-button is-active' : 'control-button'}
              onClick={() => updateRepresentation('ball')}
            >
              Ball &amp; Stick
            </button>
            <button
              type="button"
              className={representation === 'vdw' ? 'control-button is-active' : 'control-button'}
              onClick={() => updateRepresentation('vdw')}
            >
              Space Filling
            </button>
          </div>
          <p className="control-hint">Press <span>R</span> anytime to toggle.</p>
        </section>

        <section className="control-group">
          <header className="control-label">Replication (PBC)</header>
          <div className="replication-grid">
            {['a', 'b', 'c'].map((axis, index) => (
              <label key={axis} className="replication-field">
                <span>{axis.toUpperCase()}:</span>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={replication[index]}
                  onChange={(event) => handleReplicationChange(index, event.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="control-hint">Up to 3×3×3 periodic copies.</p>
        </section>

        <section className="control-group">
          <header className="control-label">Tips</header>
          <ul className="tip-list">
            <li>Right-drag to orbit about the point under the cursor.</li>
            <li>Middle-drag or scroll to dolly; zoom centers on the cursor.</li>
            <li>Click an atom to highlight it with an outline.</li>
          </ul>
        </section>
      </aside>
      <main className="viewer-panel">
        <MoleculeViewer replication={replication} />
      </main>
    </div>
  )
}
