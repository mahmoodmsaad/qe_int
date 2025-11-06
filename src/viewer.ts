import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'

export type Atom = { element: string; pos: [number, number, number] }
export type Bond = [number, number]
export type Lattice = { a: [number, number, number]; b: [number, number, number]; c: [number, number, number] }
export type Representation = 'ball' | 'vdw'
export type LoadOptions = { replication?: [number, number, number] }

const CPK_COLORS: Record<string, string> = {
  H: '#ffffff',
  C: '#909090',
  N: '#3050f8',
  O: '#ff0d0d',
  F: '#90e050',
  P: '#ff8000',
  S: '#ffff30',
  Cl: '#1ff01f',
  Br: '#a62929',
  I: '#940094',
  Cu: '#c88033',
  Ni: '#50d050',
  Pt: '#d0d0e0'
}

const COVALENT_RADII: Record<string, number> = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  P: 1.07,
  S: 1.05,
  Cl: 1.02,
  Br: 1.20,
  I: 1.39,
  Cu: 1.32,
  Ni: 1.24,
  Pt: 1.36
}

const VDW_RADII: Record<string, number> = {
  H: 1.2,
  C: 1.7,
  N: 1.55,
  O: 1.52,
  F: 1.47,
  P: 1.8,
  S: 1.8,
  Cl: 1.75,
  Br: 1.85,
  I: 1.98,
  Cu: 1.4,
  Ni: 1.63,
  Pt: 1.75
}

const BALL_SCALE = 0.25
const VDW_SCALE = 0.17
const BOND_RADIUS = 0.12
const Y_AXIS = new THREE.Vector3(0, 1, 0)

const tmpVec3 = new THREE.Vector3()
const tmpVec32 = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()

function colorForElement(element: string): THREE.Color {
  return new THREE.Color(CPK_COLORS[element] ?? '#cccccc')
}

function covalentRadius(element: string): number {
  const base = COVALENT_RADII[element]
  return (base ?? 0.75) * BALL_SCALE
}

function vdwRadius(element: string): number {
  const base = VDW_RADII[element]
  return (base ?? 1.6) * VDW_SCALE
}

type InternalAtom = Atom & { index: number }

type MeasureState = {
  firstAtom?: InternalAtom
  secondAtom?: InternalAtom
  midpoint?: THREE.Vector3
  distance?: number
}

export class MoleculeViewer {
  private container: HTMLElement
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private composer: EffectComposer
  private renderPass: RenderPass
  private saoPass: SAOPass
  private silhouettePass: OutlinePass
  private highlightPass: OutlinePass
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private atoms: InternalAtom[] = []
  private bonds: Array<{ start: THREE.Vector3; end: THREE.Vector3; color: THREE.Color }> = []
  private lattice: Lattice | null = null
  private replication: [number, number, number] = [1, 1, 1]
  private ballStickGroup = new THREE.Group()
  private vdwGroup = new THREE.Group()
  private unitCellGroup = new THREE.Group()
  private representation: Representation = 'ball'
  private pickable: THREE.Object3D[] = []
  private highlightedAtom: InternalAtom | null = null
  private measureState: MeasureState = {}
  private measureLabel: HTMLDivElement
  private hudElement: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0f0f12')

    const { clientWidth, clientHeight } = this.container
    this.camera = new THREE.PerspectiveCamera(55, clientWidth / clientHeight, 0.1, 1000)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(clientWidth, clientHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.rotateSpeed = 0.9
    this.controls.panSpeed = 0.9
    this.controls.zoomSpeed = 0.8
    this.controls.screenSpacePanning = true
    this.controls.enableDollyToCursor = true
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    }

    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    this.saoPass = new SAOPass(this.scene, this.camera, false, true)
    this.saoPass.params.saoIntensity = 0.02
    this.saoPass.params.saoBias = 0.5
    this.saoPass.params.saoScale = 20
    this.saoPass.params.saoKernelRadius = 16
    this.saoPass.params.saoBlur = true
    this.saoPass.params.saoBlurRadius = 12
    this.saoPass.params.saoBlurStdDev = 4
    this.composer.addPass(this.saoPass)

    const size = new THREE.Vector2(clientWidth, clientHeight)
    this.silhouettePass = new OutlinePass(size, this.scene, this.camera)
    this.silhouettePass.edgeStrength = 1.2
    this.silhouettePass.edgeGlow = 0
    this.silhouettePass.edgeThickness = 0.8
    this.silhouettePass.visibleEdgeColor.set('#f2f2ff')
    this.silhouettePass.hiddenEdgeColor.set('#101012')
    this.silhouettePass.pulsePeriod = 0
    this.composer.addPass(this.silhouettePass)

    this.highlightPass = new OutlinePass(size, this.scene, this.camera)
    this.highlightPass.edgeStrength = 3.5
    this.highlightPass.edgeGlow = 0.2
    this.highlightPass.edgeThickness = 2.5
    this.highlightPass.visibleEdgeColor.set('#66e0ff')
    this.highlightPass.hiddenEdgeColor.set('#66e0ff')
    this.highlightPass.pulsePeriod = 0
    this.composer.addPass(this.highlightPass)

    this.addLights()
    this.scene.add(this.ballStickGroup)
    this.scene.add(this.vdwGroup)
    this.scene.add(this.unitCellGroup)

    this.measureLabel = document.createElement('div')
    this.measureLabel.className = 'measure-label'
    this.measureLabel.style.display = 'none'
    this.container.appendChild(this.measureLabel)

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove)
    this.renderer.domElement.addEventListener('pointerleave', () => this.renderer.domElement.style.cursor = 'auto')
    this.renderer.domElement.addEventListener('pointerdown', this.handlePivotPointer)
    window.addEventListener('resize', this.handleResize)

    this.animate()
  }

  attachHud(element: HTMLElement) {
    this.hudElement = element
    this.updateHud()
  }

  dispose() {
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove)
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePivotPointer)
    window.removeEventListener('resize', this.handleResize)
    this.controls.dispose()
    this.renderer.dispose()
  }

  loadMolecule(atoms: Atom[], bonds: Bond[], lattice: Lattice, options: LoadOptions = {}) {
    this.clearGroups()
    this.highlightedAtom = null
    this.measureState = {}
    this.measureLabel.style.display = 'none'
    this.atoms = []
    this.bonds = []
    this.lattice = lattice
    const replication = options.replication ?? [1, 1, 1]
    this.replication = [
      THREE.MathUtils.clamp(Math.round(replication[0] ?? 1), 1, 3),
      THREE.MathUtils.clamp(Math.round(replication[1] ?? 1), 1, 3),
      THREE.MathUtils.clamp(Math.round(replication[2] ?? 1), 1, 3)
    ]

    const aVec = new THREE.Vector3(...lattice.a)
    const bVec = new THREE.Vector3(...lattice.b)
    const cVec = new THREE.Vector3(...lattice.c)

    const baseAtoms: InternalAtom[] = atoms.map((atom, index) => ({
      ...atom,
      index
    }))

    let runningIndex = 0
    for (let ix = 0; ix < this.replication[0]; ix++) {
      for (let iy = 0; iy < this.replication[1]; iy++) {
        for (let iz = 0; iz < this.replication[2]; iz++) {
          const offset = new THREE.Vector3()
            .addScaledVector(aVec, ix)
            .addScaledVector(bVec, iy)
            .addScaledVector(cVec, iz)
          for (const atom of baseAtoms) {
            const pos = new THREE.Vector3(...atom.pos).add(offset)
            this.atoms.push({ ...atom, index: runningIndex++, pos: [pos.x, pos.y, pos.z] })
          }
          for (const bond of bonds) {
            const aIndex = bond[0]
            const bIndex = bond[1]
            const atomA = baseAtoms[aIndex]
            const atomB = baseAtoms[bIndex]
            if (!atomA || !atomB) continue
            const start = new THREE.Vector3(...atomA.pos).add(offset)
            const end = new THREE.Vector3(...atomB.pos).add(offset)
            const color = colorForElement(atomA.element).clone().lerp(colorForElement(atomB.element), 0.5)
            this.bonds.push({ start, end, color })
          }
        }
      }
    }

    this.buildBallAndStick()
    this.buildVdw()
    this.buildUnitCell()
    this.updateRepresentation()
    this.fitCameraToStructure()
    this.updateHud()
  }

  setRepresentation(representation: Representation) {
    if (this.representation === representation) return
    this.representation = representation
    this.updateRepresentation()
  }

  toggleMeasurement() {
    const enabling = this.measureLabel.style.display !== 'block'
    this.measureState = {}
    if (enabling) {
      this.measureLabel.style.display = 'block'
      this.measureLabel.textContent = 'Select first atom'
    } else {
      this.measureLabel.style.display = 'none'
    }
  }

  private clearGroups() {
    const groups = [this.ballStickGroup, this.vdwGroup, this.unitCellGroup]
    for (const group of groups) {
      while (group.children.length) {
        const child = group.children.pop()!
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    }
    this.pickable = []
    this.silhouettePass.selectedObjects = []
    this.highlightPass.selectedObjects = []
  }

  private buildBallAndStick() {
    this.ballStickGroup.clear()
    const atomGroup = new THREE.Group()
    const bondGroup = new THREE.Group()
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32)
    const cylinderGeo = new THREE.CylinderGeometry(BOND_RADIUS, BOND_RADIUS, 1, 24, 1, false)

    for (const atom of this.atoms) {
      const radius = covalentRadius(atom.element)
      const color = colorForElement(atom.element)
      const mesh = new THREE.Mesh(sphereGeo.clone().scale(radius, radius, radius), new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.1
      }))
      mesh.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
      mesh.userData.atomIndex = atom.index
      atomGroup.add(mesh)
    }

    for (const bond of this.bonds) {
      const bondMesh = new THREE.Mesh(cylinderGeo.clone(), new THREE.MeshStandardMaterial({
        color: bond.color,
        roughness: 0.2,
        metalness: 0.6
      }))
      tmpVec3.copy(bond.start)
      tmpVec32.copy(bond.end)
      const midpoint = tmpVec3.clone().add(tmpVec32).multiplyScalar(0.5)
      const dir = tmpVec32.clone().sub(tmpVec3)
      const length = dir.length()
      dir.normalize()
      tmpQuat.setFromUnitVectors(Y_AXIS, dir)
      bondMesh.quaternion.copy(tmpQuat)
      bondMesh.position.copy(midpoint)
      bondMesh.scale.set(1, length, 1)
      bondGroup.add(bondMesh)
    }

    this.ballStickGroup.add(atomGroup)
    this.ballStickGroup.add(bondGroup)
  }

  private buildVdw() {
    this.vdwGroup.clear()
    const sphereGeo = new THREE.SphereGeometry(1, 36, 36)
    for (const atom of this.atoms) {
      const radius = vdwRadius(atom.element)
      const color = colorForElement(atom.element)
      const mesh = new THREE.Mesh(sphereGeo.clone().scale(radius, radius, radius), new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.05
      }))
      mesh.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
      mesh.userData.atomIndex = atom.index
      this.vdwGroup.add(mesh)
    }
  }

  private buildUnitCell() {
    this.unitCellGroup.clear()
    if (!this.lattice) return
    const { a, b, c } = this.lattice
    const origin = new THREE.Vector3(0, 0, 0)
    const aVec = new THREE.Vector3(...a)
    const bVec = new THREE.Vector3(...b)
    const cVec = new THREE.Vector3(...c)

    const vertices = [
      origin,
      aVec.clone(),
      bVec.clone(),
      aVec.clone().add(bVec),
      cVec.clone(),
      cVec.clone().add(aVec),
      cVec.clone().add(bVec),
      cVec.clone().add(aVec).add(bVec)
    ]

    const edges = [
      [0, 1], [0, 2], [0, 4],
      [1, 3], [1, 5],
      [2, 3], [2, 6],
      [3, 7],
      [4, 5], [4, 6],
      [5, 7],
      [6, 7]
    ]

    const geometry = new THREE.BufferGeometry()
    const positions: number[] = []
    for (const [i, j] of edges) {
      const vi = vertices[i]
      const vj = vertices[j]
      positions.push(vi.x, vi.y, vi.z, vj.x, vj.y, vj.z)
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({ color: '#4a4a60', linewidth: 1 })
    const lines = new THREE.LineSegments(geometry, material)
    this.unitCellGroup.add(lines)
  }

  private updateRepresentation() {
    this.ballStickGroup.visible = this.representation === 'ball'
    this.vdwGroup.visible = this.representation === 'vdw'
    this.pickable = []
    const silhouetteObjects: THREE.Object3D[] = []
    if (this.representation === 'ball') {
      this.ballStickGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          silhouetteObjects.push(obj)
          if (obj.userData.atomIndex !== undefined) {
            this.pickable.push(obj)
          }
        }
      })
    } else {
      this.vdwGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          silhouetteObjects.push(obj)
          if (obj.userData.atomIndex !== undefined) {
            this.pickable.push(obj)
          }
        }
      })
    }
    this.silhouettePass.selectedObjects = silhouetteObjects
    this.updateHighlight()
  }

  private fitCameraToStructure() {
    if (!this.atoms.length) return
    const bbox = new THREE.Box3()
    for (const atom of this.atoms) {
      bbox.expandByPoint(new THREE.Vector3(atom.pos[0], atom.pos[1], atom.pos[2]))
    }
    const center = bbox.getCenter(new THREE.Vector3())
    const size = bbox.getSize(new THREE.Vector3())
    const radius = size.length() * 0.5
    const direction = new THREE.Vector3(1, 1, 1).normalize()
    const distance = radius * 2.5 + 4
    const position = center.clone().add(direction.multiplyScalar(distance))
    this.camera.position.copy(position)
    this.controls.target.copy(center)
    this.controls.update()
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    this.updatePointer(event)
    const intersects = this.raycaster.intersectObjects(this.pickable, false)
    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh
      const atomIndex = mesh.userData.atomIndex as number
      const atom = this.atoms.find((a) => a.index === atomIndex) || null
      if (atom) {
        if (this.measureLabel.style.display === 'block') {
          this.updateMeasurement(atom)
        } else {
          this.highlightedAtom = atom
          this.updateHighlight()
        }
      }
    } else {
      this.highlightedAtom = null
      this.updateHighlight()
      if (this.measureLabel.style.display === 'block') {
        this.measureState = {}
        this.measureLabel.style.display = 'none'
      }
    }
  }

  private handlePointerMove = (event: PointerEvent) => {
    this.updatePointer(event)
    const intersects = this.raycaster.intersectObjects(this.pickable, false)
    if (intersects.length) {
      this.renderer.domElement.style.cursor = 'pointer'
    } else {
      this.renderer.domElement.style.cursor = 'auto'
    }
  }

  private handlePivotPointer = (event: PointerEvent) => {
    if (event.button !== 2) return
    this.updatePointer(event)
    const hits = this.raycaster.intersectObjects(this.scene.children, true)
    if (hits.length) {
      this.controls.target.copy(hits[0].point)
      this.controls.update()
    }
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  private updateHighlight() {
    if (!this.highlightedAtom) {
      this.highlightPass.selectedObjects = []
      this.updateHud()
      return
    }
    const selectedMeshes: THREE.Object3D[] = []
    const targetIndex = this.highlightedAtom.index
    const group = this.representation === 'ball' ? this.ballStickGroup : this.vdwGroup
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.atomIndex === targetIndex) {
        selectedMeshes.push(obj)
      }
    })
    this.highlightPass.selectedObjects = selectedMeshes
    this.updateHud()
  }

  private updateMeasurement(atom: InternalAtom) {
    if (!this.measureState.firstAtom) {
      this.measureState.firstAtom = atom
      this.measureState.secondAtom = undefined
      this.measureLabel.style.display = 'block'
      this.measureLabel.textContent = 'Select second atom'
      return
    }
    if (this.measureState.firstAtom && !this.measureState.secondAtom) {
      this.measureState.secondAtom = atom
      const pos1 = new THREE.Vector3(...this.measureState.firstAtom.pos)
      const pos2 = new THREE.Vector3(...atom.pos)
      const midpoint = pos1.clone().add(pos2).multiplyScalar(0.5)
      this.measureState.midpoint = midpoint
      this.measureState.distance = pos1.distanceTo(pos2)
      this.measureLabel.textContent = `${this.measureState.distance.toFixed(2)} Å`
    } else {
      this.measureState = { firstAtom: atom }
      this.measureLabel.textContent = 'Select second atom'
    }
  }

  private updateHud() {
    if (!this.hudElement) return
    const representationLabel = this.representation === 'ball' ? 'Ball-and-stick' : 'Space-filling'
    const atomLabel = this.highlightedAtom ? `${this.highlightedAtom.element} #${this.highlightedAtom.index + 1}` : 'None'
    this.hudElement.innerHTML = `
      <span><strong>Representation:</strong> ${representationLabel}</span>
      <span><strong>Highlight:</strong> ${atomLabel}</span>
      <span>Press <strong>R</strong> to toggle representation</span>
      <span>Press <strong>M</strong> to toggle distance tool</span>
      <span>Right-drag to orbit around picked point</span>
    `
  }

  private handleResize = () => {
    const { clientWidth, clientHeight } = this.container
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const size = new THREE.Vector2(clientWidth, clientHeight)
    this.silhouettePass.setSize(size.x, size.y)
    this.highlightPass.setSize(size.x, size.y)
    this.composer.setSize(clientWidth, clientHeight)
  }

  private animate = () => {
    requestAnimationFrame(this.animate)
    this.controls.update()
    if (this.measureLabel.style.display === 'block' && this.measureState.midpoint) {
      this.updateMeasureLabelPosition()
    }
    this.composer.render()
  }

  private updateMeasureLabelPosition() {
    if (!this.measureState.midpoint) return
    const projected = this.measureState.midpoint.clone().project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    const x = ((projected.x + 1) / 2) * rect.width + rect.left
    const y = ((-projected.y + 1) / 2) * rect.height + rect.top
    this.measureLabel.style.left = `${x}px`
    this.measureLabel.style.top = `${y}px`
  }

  private addLights() {
    const hemi = new THREE.HemisphereLight('#b0c4ff', '#1c1c24', 0.45)
    const key = new THREE.DirectionalLight('#ffffff', 1.1)
    key.position.set(6, 12, 8)
    const fill = new THREE.DirectionalLight('#d0d4ff', 0.35)
    fill.position.set(-4, -3, -6)
    const rim = new THREE.DirectionalLight('#ffffff', 0.25)
    rim.position.set(-2, 4, 6)
    this.scene.add(hemi, key, fill, rim)
  }
}
