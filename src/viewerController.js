const loadHandlers = new Set()
const representationHandlers = new Set()

export function registerLoadHandler(handler) {
  loadHandlers.add(handler)
  return () => {
    loadHandlers.delete(handler)
  }
}

export function registerRepresentationHandler(handler) {
  representationHandlers.add(handler)
  return () => {
    representationHandlers.delete(handler)
  }
}

export function loadMolecule(atoms, bonds, lattice) {
  loadHandlers.forEach((handler) => {
    handler({ atoms: atoms ?? [], bonds: bonds ?? [], lattice: lattice ?? null })
  })
}

export function setRepresentation(mode) {
  representationHandlers.forEach((handler) => {
    handler(mode)
  })
}
