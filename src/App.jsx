import React, { useEffect, useRef, useState } from 'react'
import './styles.css'
import { createMoleculeViewer, loadMolecule, setRepresentation as setViewerRepresentation, setReplication } from './viewer/MoleculeViewer.js'

const SAMPLE_STRUCTURE = {
  lattice: {
    a: [5.431, 0, 0],
    b: [0, 5.431, 0],
    c: [0, 0, 5.431]
  },
  atoms: [
    { element: 'Si', pos: [0, 0, 0] },
    { element: 'Si', pos: [2.7155, 2.7155, 2.7155] },
    { element: 'O', pos: [1.3578, 1.3578, 0] },
    { element: 'O', pos: [1.3578, 0, 1.3578] },
    { element: 'O', pos: [0, 1.3578, 1.3578] },
    { element: 'O', pos: [4.0733, 4.0733, 2.7155] },
    { element: 'O', pos: [4.0733, 2.7155, 4.0733] },
    { element: 'O', pos: [2.7155, 4.0733, 4.0733] }
  ],
  bonds: [
    [0, 2], [0, 3], [0, 4],
    [1, 5], [1, 6], [1, 7],
    [2, 1], [3, 1], [4, 1],
    [5, 0], [6, 0], [7, 0]
  ]
}

function OverlayControls({ representation, onToggleRepresentation, replication, onReplicationChange }) {
  return (
    <div className="overlay">
      <div className="panel">
        <h1>Molecular Viewer</h1>
        <p className="hint">Press <kbd>R</kbd> to toggle representation or use the switch below.</p>
        <div className="control-row">
          <span>Representation</span>
          <button className="toggle" onClick={onToggleRepresentation}>
            {representation === 'ball' ? 'Ball & Stick' : 'Space Filling'}
          </button>
        </div>
        <div className="control-row">
          <span>Replication</span>
          <div className="replication-inputs">
            {['x', 'y', 'z'].map((axis, idx) => (
              <label key={axis}>
                {axis.toUpperCase()}×
                <input
                  type="number"
                  min={1}
                  max={3}
                  step={1}
                  value={[replication.nx, replication.ny, replication.nz][idx]}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10) || 1
                    const next = {
                      nx: replication.nx,
                      ny: replication.ny,
                      nz: replication.nz
                    }
                    if (axis === 'x') next.nx = value
                    if (axis === 'y') next.ny = value
                    if (axis === 'z') next.nz = value
                    onReplicationChange(next)
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const containerRef = useRef(null)
  const [representation, setRepresentation] = useState('ball')
  const [replication, setReplicationState] = useState({ nx: 1, ny: 1, nz: 1 })
  const viewerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    viewerRef.current = createMoleculeViewer(containerRef.current)
    loadMolecule(SAMPLE_STRUCTURE.atoms, SAMPLE_STRUCTURE.bonds, SAMPLE_STRUCTURE.lattice)
    return () => viewerRef.current?.dispose()
  }, [])

  const toggleRepresentation = () => {
    const next = representation === 'ball' ? 'vdw' : 'ball'
    setRepresentation(next)
    setViewerRepresentation(next)
  }

  const onReplicationChange = (nextReplication) => {
    const nx = Math.min(Math.max(1, nextReplication.nx), 3)
    const ny = Math.min(Math.max(1, nextReplication.ny), 3)
    const nz = Math.min(Math.max(1, nextReplication.nz), 3)
    setReplicationState({ nx, ny, nz })
    setReplication(nx, ny, nz)
  }

  return (
    <div className="app">
      <div ref={containerRef} className="viewer-root" />
      <OverlayControls
        representation={representation}
        onToggleRepresentation={toggleRepresentation}
        replication={replication}
        onReplicationChange={onReplicationChange}
      />
    </div>
  )
}
