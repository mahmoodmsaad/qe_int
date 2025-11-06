import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import BallAndStick from './BallAndStick.jsx'
import SpaceFilling from './SpaceFilling.jsx'
import UnitCellFrame from './UnitCellFrame.jsx'
import { registerLoadHandler, registerRepresentationHandler } from '../viewerController.js'

function extractBondPair(bond) {
  if (!bond) return null
  if (Array.isArray(bond)) return bond
  if (typeof bond === 'object') {
    const start = bond.i ?? bond.from ?? bond.source ?? bond.a ?? bond.start ?? bond[0]
    const end = bond.j ?? bond.to ?? bond.target ?? bond.b ?? bond.end ?? bond[1]
    if (typeof start === 'number' && typeof end === 'number') return [start, end]
  }
  return null
}

function ControlsEnhancer({ pickableRef }) {
  const { camera, controls, gl, scene } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])

  const setPivotFromCursor = useCallback(
    (event) => {
      if (!controls || !pickableRef.current) return
      const rect = gl.domElement.getBoundingClientRect()
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const objects = pickableRef.current.children
      const intersects = raycaster.intersectObjects(objects, true)
      if (intersects.length > 0) {
        controls.target.copy(intersects[0].point)
        controls.update()
      }
    },
    [camera, controls, gl, ndc, pickableRef, raycaster]
  )

  useEffect(() => {
    if (!controls) return undefined
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.rotateSpeed = 0.9
    controls.panSpeed = 0.9
    controls.zoomSpeed = 0.8
    controls.screenSpacePanning = true
    controls.enableDollyToCursor = true
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    }
    const domElement = gl.domElement
    const handlePointerDown = (event) => {
      if (event.button === 2) setPivotFromCursor(event)
    }
    domElement.addEventListener('pointerdown', handlePointerDown)
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [controls, gl, setPivotFromCursor])

  useFrame(() => {
    controls?.update()
  })

  useEffect(() => {
    scene.background = new THREE.Color('#0f0f12')
  }, [scene])

  return null
}

function CameraFraming({ atoms }) {
  const { camera, controls } = useThree()

  useEffect(() => {
    if (!atoms.length) return
    const box = new THREE.Box3()
    atoms.forEach((atom) => {
      box.expandByPoint(new THREE.Vector3(...atom.position))
    })
    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)
    const maxDim = Math.max(size.x, size.y, size.z, 1)
    const distance = maxDim * 2.4
    const direction = new THREE.Vector3(1, 1.2, 1.1).normalize()
    camera.position.copy(center.clone().add(direction.multiplyScalar(distance)))
    camera.near = 0.1
    camera.far = Math.max(500, distance * 10)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(center)
      controls.update()
    }
  }, [atoms, camera, controls])

  return null
}

function SceneContent({
  atoms,
  bonds,
  lattice,
  originShift,
  representation,
  onSelectAtom,
  selectedAtomId,
  pickableRef
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[12, 18, 10]} intensity={1.1} />
      <directionalLight position={[-10, -6, -14]} intensity={0.45} />
      <hemisphereLight args={['#9ec1ff', '#0f0f12', 0.2]} />
      <group ref={pickableRef}>
        {representation === 'ball' ? (
          <BallAndStick atoms={atoms} bonds={bonds} onSelectAtom={onSelectAtom} selectedAtomId={selectedAtomId} />
        ) : (
          <SpaceFilling atoms={atoms} onSelectAtom={onSelectAtom} selectedAtomId={selectedAtomId} />
        )}
      </group>
      <UnitCellFrame lattice={lattice} originShift={originShift} />
      <ControlsEnhancer pickableRef={pickableRef} />
      <CameraFraming atoms={atoms} />
      <ContactShadows
        position={[0, -12, 0]}
        opacity={0.4}
        scale={40}
        blur={2.6}
        far={40}
        resolution={1024}
        color="#020406"
      />
    </>
  )
}

export default function MoleculeViewer({ replication }) {
  const [molecule, setMolecule] = useState({ atoms: [], bonds: [], lattice: null })
  const [representation, setRepresentationState] = useState('ball')
  const [selectedAtomId, setSelectedAtomId] = useState(null)
  const pickableRef = useRef()

  useEffect(() => {
    const unregister = registerLoadHandler((payload) => {
      setMolecule({
        atoms: Array.isArray(payload.atoms) ? payload.atoms : [],
        bonds: Array.isArray(payload.bonds) ? payload.bonds : [],
        lattice: payload.lattice ?? null
      })
      setSelectedAtomId(null)
    })
    return unregister
  }, [])

  useEffect(() => {
    const unregister = registerRepresentationHandler((mode) => {
      if (mode === 'ball' || mode === 'vdw') {
        setRepresentationState(mode)
      }
    })
    return unregister
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key.toLowerCase() === 'r') {
        setRepresentationState((prev) => (prev === 'ball' ? 'vdw' : 'ball'))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const prepared = useMemo(() => {
    const baseAtoms = molecule.atoms ?? []
    const baseBonds = molecule.bonds ?? []
    const lattice = molecule.lattice ?? null
    const [nx, ny, nz] = replication
    const atoms = []
    const bonds = []

    const a = lattice?.a ? new THREE.Vector3(...lattice.a) : new THREE.Vector3()
    const b = lattice?.b ? new THREE.Vector3(...lattice.b) : new THREE.Vector3()
    const c = lattice?.c ? new THREE.Vector3(...lattice.c) : new THREE.Vector3()

    const originShift = lattice
      ? new THREE.Vector3()
          .addScaledVector(a, (nx - 1) / 2)
          .addScaledVector(b, (ny - 1) / 2)
          .addScaledVector(c, (nz - 1) / 2)
      : new THREE.Vector3()

    let globalIndex = 0
    let cellIndex = 0
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const offset = new THREE.Vector3()
            .addScaledVector(a, ix)
            .addScaledVector(b, iy)
            .addScaledVector(c, iz)
            .sub(originShift)

          const cellStart = globalIndex
          baseAtoms.forEach((atom, atomIndex) => {
            const position = [
              atom.pos[0] + offset.x,
              atom.pos[1] + offset.y,
              atom.pos[2] + offset.z
            ]
            atoms.push({
              id: `${cellIndex}-${atomIndex}`,
              element: atom.element,
              position,
              baseIndex: atomIndex,
              cell: [ix, iy, iz]
            })
            globalIndex += 1
          })

          baseBonds.forEach((bond, bondIndex) => {
            const pair = extractBondPair(bond)
            if (!pair) return
            const startIndex = Number(pair[0])
            const endIndex = Number(pair[1])
            if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) return
            if (
              startIndex < 0 ||
              endIndex < 0 ||
              startIndex >= baseAtoms.length ||
              endIndex >= baseAtoms.length
            )
              return
            const startAtom = atoms[cellStart + startIndex]
            const endAtom = atoms[cellStart + endIndex]
            if (!startAtom || !endAtom) return
            bonds.push({
              id: `${cellIndex}-${bondIndex}`,
              start: startAtom.position,
              end: endAtom.position
            })
          })

          cellIndex += 1
        }
      }
    }

    return { atoms, bonds, originShift, lattice }
  }, [molecule, replication])

  const handleSelectAtom = useCallback((atom) => {
    setSelectedAtomId(atom.id)
  }, [])

  const selectedAtom = useMemo(
    () => prepared.atoms.find((atom) => atom.id === selectedAtomId) ?? null,
    [prepared.atoms, selectedAtomId]
  )

  return (
    <div className="viewer">
      <Canvas
        camera={{ fov: 45, position: [0, 0, 30] }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.15
          if ('outputColorSpace' in gl) {
            gl.outputColorSpace = THREE.SRGBColorSpace
          }
          gl.setClearColor('#0f0f12')
        }}
      >
        <OrbitControls makeDefault />
        <SceneContent
          atoms={prepared.atoms}
          bonds={prepared.bonds}
          lattice={prepared.lattice}
          originShift={prepared.originShift}
          representation={representation}
          onSelectAtom={handleSelectAtom}
          selectedAtomId={selectedAtomId}
          pickableRef={pickableRef}
        />
      </Canvas>
      <div className="hud">
        <div className="hud-row">
          <span className="hud-label">Representation:</span>
          <span className="hud-value">{representation === 'ball' ? 'Ball & Stick' : 'Space Filling'}</span>
          <span className="hud-hint">Press R to toggle</span>
        </div>
        {selectedAtom && (
          <>
            <div className="hud-row">
              <span className="hud-label">Selected atom:</span>
              <span className="hud-value">{`${selectedAtom.element} · ${selectedAtom.id}`}</span>
            </div>
            <div className="hud-row hud-row--secondary">
              <span className="hud-label">Position (Å):</span>
              <span className="hud-value">
                {selectedAtom.position.map((v) => v.toFixed(3)).join(', ')}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
