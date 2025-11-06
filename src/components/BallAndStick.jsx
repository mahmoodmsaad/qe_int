import React, { memo } from 'react'
import * as THREE from 'three'
import { CPK_COLORS, COVALENT_RADII, DEFAULT_COLOR, BALL_SCALE, BOND_RADIUS } from '../constants.js'

const sphereDetail = 32

const Bond = memo(function Bond({ start, end }) {
  const startVec = new THREE.Vector3(...start)
  const endVec = new THREE.Vector3(...end)
  const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5)
  const direction = endVec.clone().sub(startVec)
  const length = direction.length()
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())

  return (
    <group position={midPoint} quaternion={orientation}>
      <mesh>
        <cylinderGeometry args={[BOND_RADIUS, BOND_RADIUS, length, 20, 1, false]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh scale={1.05}>
        <cylinderGeometry args={[BOND_RADIUS, BOND_RADIUS, length, 20, 1, false]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  )
})

const AtomBall = memo(function AtomBall({ atom, onSelect, selected }) {
  const radius = (COVALENT_RADII[atom.element] ?? 0.75) * BALL_SCALE
  const color = CPK_COLORS[atom.element] ?? DEFAULT_COLOR

  const handlePointerDown = (event) => {
    event.stopPropagation()
    onSelect(atom)
  }

  return (
    <group position={atom.position}>
      <mesh onPointerDown={handlePointerDown}>
        <sphereGeometry args={[radius, sphereDetail, sphereDetail]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, sphereDetail, sphereDetail]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh scale={1.25}>
          <sphereGeometry args={[radius, sphereDetail, sphereDetail]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
})

export default function BallAndStick({ atoms, bonds, onSelectAtom, selectedAtomId }) {
  return (
    <group>
      {atoms.map((atom) => (
        <AtomBall key={atom.id} atom={atom} onSelect={onSelectAtom} selected={atom.id === selectedAtomId} />
      ))}
      {bonds.map((bond) => (
        <Bond key={bond.id} start={bond.start} end={bond.end} />
      ))}
    </group>
  )
}
