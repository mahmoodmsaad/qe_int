import React, { useMemo } from 'react'
import * as THREE from 'three'

function makeCorner(origin, a, b, c, mask) {
  const corner = origin.clone()
  if (mask & 1) corner.add(a)
  if (mask & 2) corner.add(b)
  if (mask & 4) corner.add(c)
  return corner
}

export default function UnitCellFrame({ lattice, originShift }) {
  const geometry = useMemo(() => {
    if (!lattice || !lattice.a || !lattice.b || !lattice.c) return null

    const a = new THREE.Vector3(...lattice.a)
    const b = new THREE.Vector3(...lattice.b)
    const c = new THREE.Vector3(...lattice.c)
    const origin = originShift ? originShift.clone().multiplyScalar(-1) : new THREE.Vector3()

    const corners = [
      makeCorner(origin, a, b, c, 0),
      makeCorner(origin, a, b, c, 1),
      makeCorner(origin, a, b, c, 2),
      makeCorner(origin, a, b, c, 4),
      makeCorner(origin, a, b, c, 3),
      makeCorner(origin, a, b, c, 5),
      makeCorner(origin, a, b, c, 6),
      makeCorner(origin, a, b, c, 7)
    ]

    const edgeIndices = [
      [0, 1], [0, 2], [0, 3],
      [1, 4], [1, 5],
      [2, 4], [2, 6],
      [3, 5], [3, 6],
      [4, 7], [5, 7], [6, 7]
    ]

    const positions = new Float32Array(edgeIndices.length * 2 * 3)
    edgeIndices.forEach((edge, idx) => {
      const [i0, i1] = edge
      const start = corners[i0]
      const end = corners[i1]
      positions.set(start.toArray(), idx * 6)
      positions.set(end.toArray(), idx * 6 + 3)
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [lattice, originShift])

  if (!geometry) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#f5f5ff" linewidth={1} transparent opacity={0.65} />
    </lineSegments>
  )
}
