import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import { getElementColor, getCovalentRadius, getVdwRadius } from './atomData.js'
const ndc = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const yAxis = new THREE.Vector3(0, 1, 0)

function createUnitCellLines(lattice) {
  const a = new THREE.Vector3().fromArray(lattice?.a || [1, 0, 0])
  const b = new THREE.Vector3().fromArray(lattice?.b || [0, 1, 0])
  const c = new THREE.Vector3().fromArray(lattice?.c || [0, 0, 1])
  const origin = new THREE.Vector3()
  const vertices = [
    origin.clone(),
    origin.clone().add(a),
    origin.clone().add(b),
    origin.clone().add(c),
    origin.clone().add(a).add(b),
    origin.clone().add(a).add(c),
    origin.clone().add(b).add(c),
    origin.clone().add(a).add(b).add(c)
  ]

  const edges = [
    [0, 1], [0, 2], [0, 3],
    [1, 4], [1, 5],
    [2, 4], [2, 6],
    [3, 5], [3, 6],
    [4, 7], [5, 7], [6, 7]
  ]

  const positions = new Float32Array(edges.length * 2 * 3)
  edges.forEach((edge, idx) => {
    const [i1, i2] = edge
    const v1 = vertices[i1]
    const v2 = vertices[i2]
    positions.set(v1.toArray(), idx * 6)
    positions.set(v2.toArray(), idx * 6 + 3)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
  return new THREE.LineSegments(geometry, material)
}

function toVectorArray(vec) {
  if (!Array.isArray(vec) || vec.length !== 3) return [0, 0, 0]
  return vec
}

export class MoleculeViewer {
  constructor(container) {
    this.container = container
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0f0f12')

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000)
    this.camera.position.set(10, 10, 10)
    this.camera.up.set(0, 0, 1)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setAnimationLoop(this.animate.bind(this))
    container.appendChild(this.renderer.domElement)

    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    this.saoPass = new SAOPass(this.scene, this.camera, false, true)
    this.saoPass.params = {
      output: SAOPass.OUTPUT.Default,
      saoIntensity: 0.5,
      saoScale: 100,
      saoKernelRadius: 16,
      saoMinResolution: 0,
      saoBlur: true,
      saoBlurRadius: 4,
      saoBlurStdDev: 1.5,
      saoBlurDepthCutoff: 0.02
    }
    this.composer.addPass(this.saoPass)

    this.outlinePass = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), this.scene, this.camera)
    this.outlinePass.edgeStrength = 2.5
    this.outlinePass.edgeGlow = 0.4
    this.outlinePass.edgeThickness = 1.0
    this.outlinePass.visibleEdgeColor.set('#ffffff')
    this.outlinePass.hiddenEdgeColor.set('#ffffff')
    this.outlinePass.pulsePeriod = 0
    this.outlinePass.usePatternTexture = false
    this.outlinePass.renderToScreen = false
    this.composer.addPass(this.outlinePass)

    const fxaaPass = new ShaderPass(FXAAShader)
    fxaaPass.material.uniforms['resolution'].value.set(1 / container.clientWidth, 1 / container.clientHeight)
    this.composer.addPass(fxaaPass)

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

    this.scene.add(new THREE.AmbientLight('#8c9eff', 0.2))
    const keyLight = new THREE.DirectionalLight('#ffffff', 1.15)
    keyLight.position.set(6, 8, 10)
    this.scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#bac8ff', 0.6)
    fillLight.position.set(-6, -4, -5)
    this.scene.add(fillLight)
    const rimLight = new THREE.DirectionalLight('#ffffff', 0.4)
    rimLight.position.set(-4, 10, 6)
    this.scene.add(rimLight)

    this.atomGroup = new THREE.Group()
    this.bondGroup = new THREE.Group()
    this.vdwGroup = new THREE.Group()
    this.scene.add(this.atomGroup)
    this.scene.add(this.bondGroup)
    this.scene.add(this.vdwGroup)

    this.unitCell = null
    this.lattice = { a: [1, 0, 0], b: [0, 1, 0], c: [0, 0, 1] }
    this.replication = { nx: 1, ny: 1, nz: 1 }
    this.representation = 'ball'

    this.pointer = new THREE.Vector2()
    this.selectedAtoms = []
    this.atomMeshes = []

    this.clock = new THREE.Clock()

    this.handlePointerMove = this.updatePointer.bind(this)
    this.handlePointerDown = this.onPointerDown.bind(this)
    this.handleResize = this.onResize.bind(this)
    this.handleKeyDown = this.onKeyDown.bind(this)

    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove)
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('keydown', this.handleKeyDown)

    this.frameTarget = 1 / 60
    this.accumulator = 0
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove)
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('keydown', this.handleKeyDown)
    this.controls.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
    if (viewerInstance === this) {
      viewerInstance = null
    }
  }

  updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  onPointerDown(event) {
    if (event.button === 2) {
      this.setPivotFromCursor(event)
      return
    }

    if (event.button !== 0) return
    const intersections = this.castRay(event)
    const firstAtom = intersections.find((hit) => hit.object.userData?.isAtom)
    if (firstAtom) {
      this.setSelection([firstAtom.object])
    } else {
      this.setSelection([])
    }
  }

  castRay(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, this.camera)
    return raycaster.intersectObjects(this.scene.children, true)
  }

  setPivotFromCursor(event) {
    const hits = this.castRay(event)
    if (hits.length > 0) {
      this.controls.target.copy(hits[0].point)
      this.controls.update()
    }
  }

  onKeyDown(event) {
    if (event.key === 'r' || event.key === 'R') {
      this.setRepresentation(this.representation === 'ball' ? 'vdw' : 'ball')
    }
  }

  onResize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.composer.setSize(width, height)
    const lastPass = this.composer.passes[this.composer.passes.length - 1]
    if (lastPass?.material?.uniforms?.resolution) {
      lastPass.material.uniforms.resolution.value.set(1 / width, 1 / height)
    }
    this.outlinePass.setSize(width, height)
  }

  animate() {
    const delta = this.clock.getDelta()
    this.accumulator += delta
    this.controls.update()
    if (this.accumulator >= this.frameTarget) {
      this.composer.render()
      this.accumulator = 0
    }
  }

  clearGroup(group) {
    while (group.children.length) {
      const child = group.children[0]
      group.remove(child)
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
        else child.material.dispose()
      }
    }
  }

  buildUnitCell() {
    if (this.unitCell) {
      this.scene.remove(this.unitCell)
      this.unitCell.geometry.dispose()
      this.unitCell.material.dispose()
    }
    this.unitCell = createUnitCellLines(this.lattice)
    this.scene.add(this.unitCell)
  }

  setReplication(nx = 1, ny = 1, nz = 1) {
    this.replication = {
      nx: THREE.MathUtils.clamp(Math.floor(nx), 1, 3),
      ny: THREE.MathUtils.clamp(Math.floor(ny), 1, 3),
      nz: THREE.MathUtils.clamp(Math.floor(nz), 1, 3)
    }
    if (this.currentAtoms) {
      this.populateMolecule(this.currentAtoms, this.currentBonds)
    }
  }

  loadMolecule(atoms = [], bonds = [], lattice = null) {
    this.currentAtoms = atoms
    this.currentBonds = bonds
    if (lattice?.a && lattice?.b && lattice?.c) {
      this.lattice = {
        a: toVectorArray(lattice.a),
        b: toVectorArray(lattice.b),
        c: toVectorArray(lattice.c)
      }
    }
    this.populateMolecule(atoms, bonds)
    this.buildUnitCell()
    this.focusCamera()
  }

  populateMolecule(atoms, bonds) {
    this.clearGroup(this.atomGroup)
    this.clearGroup(this.bondGroup)
    this.clearGroup(this.vdwGroup)
    this.atomMeshes = []

    const sphereGeo = new THREE.SphereGeometry(1, 48, 48)
    const vdwGeo = new THREE.SphereGeometry(1, 48, 48)
    const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 24)

    const { nx, ny, nz } = this.replication
    const a = new THREE.Vector3().fromArray(this.lattice.a)
    const b = new THREE.Vector3().fromArray(this.lattice.b)
    const c = new THREE.Vector3().fromArray(this.lattice.c)

    const baseAtoms = []
    let atomIndex = 0
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const shift = new THREE.Vector3()
            .addScaledVector(a, ix)
            .addScaledVector(b, iy)
            .addScaledVector(c, iz)
          atoms.forEach((atom) => {
            const pos = new THREE.Vector3().fromArray(atom.pos || [0, 0, 0]).add(shift)
            baseAtoms.push({ atom, pos, index: atomIndex++ })
          })
        }
      }
    }

    baseAtoms.forEach(({ atom, pos }) => {
      const color = getElementColor(atom.element)
      const covalent = getCovalentRadius(atom.element) * 0.25
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 })
      const sphere = new THREE.Mesh(sphereGeo.clone(), mat)
      sphere.scale.setScalar(Math.max(covalent, 0.05))
      sphere.position.copy(pos)
      sphere.userData = { isAtom: true, element: atom.element, baseColor: color }
      this.atomGroup.add(sphere)
      this.atomMeshes.push(sphere)

      const vdwMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 })
      const vdwSphere = new THREE.Mesh(vdwGeo.clone(), vdwMat)
      vdwSphere.scale.setScalar(getVdwRadius(atom.element) * 0.17)
      vdwSphere.position.copy(pos)
      vdwSphere.visible = this.representation === 'vdw'
      vdwSphere.userData = { isAtom: true, element: atom.element, baseColor: color }
      this.vdwGroup.add(vdwSphere)
    })

    this.atomGroup.visible = this.representation === 'ball'
    this.bondGroup.visible = this.representation === 'ball'

    const buildBond = (start, end) => {
      const startVec = new THREE.Vector3().fromArray(start)
      const endVec = new THREE.Vector3().fromArray(end)
      const bondVec = new THREE.Vector3().subVectors(endVec, startVec)
      const length = bondVec.length()
      if (length === 0) return
      const center = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5)
      const cylinder = new THREE.Mesh(cylinderGeo.clone(), new THREE.MeshStandardMaterial({ color: '#d0d0d0', roughness: 0.2 }))
      cylinder.scale.set(0.12, length, 0.12)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(yAxis, bondVec.clone().normalize())
      cylinder.quaternion.copy(quaternion)
      cylinder.position.copy(center)
      cylinder.userData = { isBond: true }
      this.bondGroup.add(cylinder)
    }

    const replicationOffsets = []
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const shift = new THREE.Vector3()
            .addScaledVector(a, ix)
            .addScaledVector(b, iy)
            .addScaledVector(c, iz)
          replicationOffsets.push(shift.clone())
        }
      }
    }

    bonds.forEach(([i, j]) => {
      const atomI = atoms[i]
      const atomJ = atoms[j]
      if (!atomI || !atomJ) return
      const basePosI = new THREE.Vector3().fromArray(atomI.pos)
      const basePosJ = new THREE.Vector3().fromArray(atomJ.pos)
      replicationOffsets.forEach((offset) => {
        const start = basePosI.clone().add(offset).toArray()
        const end = basePosJ.clone().add(offset).toArray()
        buildBond(start, end)
      })
    })

    this.updateOutlineTargets()
  }

  focusCamera() {
    const box = new THREE.Box3().setFromObject(this.representation === 'vdw' ? this.vdwGroup : this.atomGroup)
    const size = box.getSize(new THREE.Vector3()).length() || 1
    const center = box.getCenter(new THREE.Vector3())
    const distance = size * 1.5
    const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(distance)
    this.controls.target.copy(center)
    this.camera.position.copy(center).add(offset)
    this.camera.near = Math.max(distance / 100, 0.1)
    this.camera.far = Math.max(distance * 10, 100)
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  setSelection(meshes) {
    this.selectedAtoms = meshes
    this.outlinePass.selectedObjects = meshes
  }

  updateOutlineTargets() {
    if (!this.selectedAtoms.length) return
    const valid = this.selectedAtoms.filter((mesh) => mesh.parent)
    this.outlinePass.selectedObjects = valid
  }

  setRepresentation(rep) {
    if (rep !== 'ball' && rep !== 'vdw') return
    this.representation = rep
    this.atomGroup.visible = rep === 'ball'
    this.bondGroup.visible = rep === 'ball'
    this.vdwGroup.visible = rep === 'vdw'
    this.focusCamera()
  }
}

let viewerInstance = null

export function createMoleculeViewer(container) {
  viewerInstance = new MoleculeViewer(container)
  return viewerInstance
}

export function loadMolecule(atoms, bonds, lattice) {
  if (!viewerInstance) throw new Error('Molecule viewer not initialised')
  viewerInstance.loadMolecule(atoms, bonds, lattice)
}

export function setRepresentation(mode) {
  if (!viewerInstance) throw new Error('Molecule viewer not initialised')
  viewerInstance.setRepresentation(mode)
}

export function setReplication(nx, ny, nz) {
  if (!viewerInstance) throw new Error('Molecule viewer not initialised')
  viewerInstance.setReplication(nx, ny, nz)
}
