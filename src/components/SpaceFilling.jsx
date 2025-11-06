import React, { memo } from 'react'
import * as THREE from 'three'
import { CPK_COLORS, VDW_RADII, DEFAULT_COLOR, VDW_SCALE } from '../constants.js'

const sphereDetail = 48

const VdwSphere = memo(function VdwSphere({ atom, onSelect, selected }) {
  const radius = (VDW_RADII[atom.element] ?? 1.5) * VDW_SCALE
  const color = CPK_COLORS[atom.element] ?? DEFAULT_COLOR

  const handlePointerDown = (event) => {
    event.stopPropagation()
    onSelect(atom)
  }

  return (
    <group position={atom.position}>
      <mesh onPointerDown={handlePointerDown}>
        <sphereGeometry args={[radius, sphereDetail, sphereDetail]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.35} />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[radius, sphereDetail, sphereDetail]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.14} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh scale={1.18}>
          <sphereGeometry args={[radius, sphereDetail, sphereDetail]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
})

export default function SpaceFilling({ atoms, onSelectAtom, selectedAtomId }) {
  return (
    <group>
      {atoms.map((atom) => (
        <VdwSphere key={atom.id} atom={atom} onSelect={onSelectAtom} selected={atom.id === selectedAtomId} />
      ))}
    </group>
  )
}
