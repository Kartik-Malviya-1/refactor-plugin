import type { DiscoveredVariable, CollectionInfo } from '../shared/migration'

export interface VariableDiscoveryResult {
  variables: DiscoveredVariable[]
  collections: CollectionInfo[]
}

export async function discoverVariables(): Promise<VariableDiscoveryResult> {
  const variables: DiscoveredVariable[] = []
  const collections: CollectionInfo[] = []

  // Local variable collections (async API required by documentAccess: dynamic-page)
  try {
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync()
    for (const c of localCollections) {
      const modeNames = c.modes.map(m => m.name)
      collections.push({
        id: c.id,
        name: c.name,
        isLocal: true,
        modes: modeNames,
        variableCount: c.variableIds.length,
      })

      const defaultModeId = c.defaultModeId
      const defaultModeName = c.modes.find(m => m.modeId === defaultModeId)?.name ?? 'Default'

      for (const varId of c.variableIds) {
        try {
          const v = await figma.variables.getVariableByIdAsync(varId)
          if (!v) continue

          let resolvedValue: string | number | boolean | null = null
          try {
            const values = v.valuesByMode
            const val = values[defaultModeId]
            if (val !== undefined) {
              if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                resolvedValue = val
              } else if (typeof val === 'object' && val !== null && 'id' in val) {
                resolvedValue = `→ ${(val as { id: string }).id}`
              }
            }
          } catch { /* values not accessible */ }

          variables.push({
            id: v.id,
            name: v.name,
            collectionId: c.id,
            collectionName: c.name,
            resolvedType: v.resolvedType,
            isLocal: true,
            resolvedValue,
            mode: defaultModeName,
          })
        } catch { /* variable not accessible */ }
      }
    }
  } catch (err) {
    console.error('[Refactor] Local variable discovery failed:', err)
  }

  // Library variables discovered from text node bindings and style bindings
  try {
    await discoverLibraryVariables(variables, collections)
  } catch (err) {
    console.error('[Refactor] Library variable discovery failed:', err)
  }

  console.log(`[Refactor] Variable discovery: ${variables.length} variables in ${collections.length} collections (${variables.filter(v => v.isLocal).length} local, ${variables.filter(v => !v.isLocal).length} library)`)
  return { variables, collections }
}

async function discoverLibraryVariables(
  variables: DiscoveredVariable[],
  collections: CollectionInfo[],
): Promise<void> {
  const knownIds = new Set(variables.map(v => v.id))
  const knownCollections = new Set(collections.map(c => c.id))

  // Discover from local text styles' bound variables
  try {
    const localStyles = await figma.getLocalTextStylesAsync()
    for (const style of localStyles) {
      const bv = (style as unknown as { boundVariables?: Record<string, { id?: string }> }).boundVariables
      if (!bv) continue
      for (const [, binding] of Object.entries(bv)) {
        if (!binding?.id || knownIds.has(binding.id)) continue
        await resolveAndAddVariable(binding.id, variables, collections, knownIds, knownCollections)
      }
    }
  } catch { /* styles not accessible */ }

  // Discover from text nodes on current page
  try {
    const textNodes = figma.currentPage.findAllWithCriteria({ types: ['TEXT'] })
    for (const node of textNodes) {
      const bv = (node as unknown as { boundVariables?: Record<string, unknown> }).boundVariables
      if (!bv) continue
      for (const [, binding] of Object.entries(bv)) {
        if (!binding || typeof binding !== 'object') continue
        const bid = (binding as { id?: string }).id
        if (!bid || knownIds.has(bid)) continue
        await resolveAndAddVariable(bid, variables, collections, knownIds, knownCollections)
      }
    }
  } catch { /* text node traversal failed */ }
}

async function resolveAndAddVariable(
  varId: string,
  variables: DiscoveredVariable[],
  collections: CollectionInfo[],
  knownIds: Set<string>,
  knownCollections: Set<string>,
): Promise<void> {
  try {
    const v = await figma.variables.getVariableByIdAsync(varId)
    if (!v) return
    knownIds.add(v.id)

    let collectionName = 'Library'
    let collectionId = v.variableCollectionId
    try {
      const coll = await figma.variables.getVariableCollectionByIdAsync(collectionId)
      if (coll) {
        collectionName = coll.name
        if (!knownCollections.has(coll.id)) {
          knownCollections.add(coll.id)
          collections.push({
            id: coll.id,
            name: coll.name,
            isLocal: false,
            modes: coll.modes.map(m => m.name),
            variableCount: coll.variableIds.length,
          })
        }
      }
    } catch { /* collection not accessible */ }

    variables.push({
      id: v.id,
      name: v.name,
      collectionId,
      collectionName,
      resolvedType: v.resolvedType,
      isLocal: false,
      resolvedValue: null,
      mode: 'Default',
    })
  } catch { /* variable not resolvable */ }
}
