/**
 * Preview Engine — generates before/after PNG previews for review items.
 *
 * Implementation: clone-frame approach.
 *   1. Export the original frame as-is (the \"before\" image).
 *   2. Clone the frame to an off-canvas position.
 *   3. Walk the original and clone trees in parallel to locate the clone
 *      counterparts of each changed text node.
 *   4. Pre-load all fonts required by the planned mutations.
 *   5. Apply typography mutations to clone text nodes only.
 *   6. Export the clone (the \"after\" image).
 *   7. Remove the clone — no trace remains in the document.
 *
 * The original frame is never mutated. The only undo entries created are
 * clone + N mutations + remove, which form a net-zero document change.
 *
 * The engine is generic: it receives a frame + a list of LayerMutation
 * objects (target node ID + new typography values). It knows nothing about
 * Typography Signatures, assignments, or any other domain concept.
 */

export interface LayerMutation {
  layerId:           string   // original Figma text node ID
  targetType:        string   // 'existing-style' | 'new-style' | 'manual-values' | ...
  // existing-style
  styleId?:          string
  // new-style / manual-values
  fontFamily?:       string
  fontStyle?:        string
  fontSize?:         number
  lineHeightUnit?:   string
  lineHeightValue?:  number
  letterSpacingUnit?:  string
  letterSpacingValue?: number
}

function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
  return btoa(binary)
}

/**
 * Walk original and clone subtrees in parallel, collecting clone TextNodes
 * that correspond to the original nodes listed in targetIds.
 */
function walkParallel(
  orig:      SceneNode,
  clone:     SceneNode,
  targetIds: Set<string>,
  result:    Map<string, TextNode>
): void {
  if (orig.type === 'TEXT' && targetIds.has(orig.id)) {
    result.set(orig.id, clone as unknown as TextNode)
  }
  if ('children' in orig && 'children' in clone) {
    const oc = orig.children
    const cc = clone.children
    for (let i = 0; i < Math.min(oc.length, cc.length); i++) {
      walkParallel(oc[i], cc[i], targetIds, result)
    }
  }
}

/**
 * Walk up the node tree to find the nearest FRAME or COMPONENT ancestor.
 * Used to locate the parent frame when only a text node ID is known.
 */
function findFrameAncestor(node: BaseNode): FrameNode | null {
  let cur = node.parent
  while (cur) {
    if (cur.type === 'FRAME' || cur.type === 'COMPONENT') return cur as FrameNode
    if (cur.type === 'PAGE' || cur.type === 'DOCUMENT') return null
    cur = cur.parent
  }
  return null
}

/**
 * Generate before/after preview PNGs for a set of text-node mutations.
 *
 * @param pageId   - Page containing the frame.
 * @param layerIds - Original text node IDs involved in the migration.
 * @param mutations - What typography to apply to each node.
 * @returns { before: base64, after: base64 } PNG images.
 */
export async function generatePreview(
  pageId:    string,
  layerIds:  string[],
  mutations: LayerMutation[]
): Promise<{ before: string; after: string }> {
  // ── Switch to the correct page ────────────────────────────────────────
  const page = figma.root.children.find(p => p.id === pageId)
  if (!page || page.type !== 'PAGE') throw new Error(`Page not found: ${pageId}`)
  await figma.setCurrentPageAsync(page as PageNode)

  // ── Find the parent frame ────────────────────────────────────────────
  const anchorNode = figma.getNodeById(layerIds[0])
  if (!anchorNode) throw new Error(`Node not found: ${layerIds[0]}`)

  const frame = findFrameAncestor(anchorNode)
  if (!frame) throw new Error('No FRAME ancestor found')

  // ── Export BEFORE (original frame, no mutations) ──────────────────────
  const beforeRaw    = await frame.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 800 } })
  const beforeBase64 = uint8ArrayToBase64(beforeRaw)

  // ── Clone frame for mutation ──────────────────────────────────────
  const clone = frame.clone() as typeof frame
  clone.x = -999999
  clone.y = -999999

  try {
    // Map original layerId → clone TextNode
    const targetIds = new Set(layerIds)
    const cloneNodeMap = new Map<string, TextNode>()
    walkParallel(frame, clone, targetIds, cloneNodeMap)

    // Build mutation lookup
    const mutationMap = new Map<string, LayerMutation>()
    for (const m of mutations) mutationMap.set(m.layerId, m)

    // Pre-load all fonts required for mutations
    const fontsNeeded = new Map<string, FontName>()
    for (const m of mutations) {
      if (m.fontFamily && m.fontStyle) {
        fontsNeeded.set(`${m.fontFamily}|${m.fontStyle}`, { family: m.fontFamily, style: m.fontStyle })
      }
    }
    for (const font of fontsNeeded.values()) {
      try { await figma.loadFontAsync(font) } catch {}
    }

    // Apply mutations to clone nodes
    for (const [origId, cloneNode] of cloneNodeMap) {
      const m = mutationMap.get(origId)
      if (!m) continue
      try {
        if (m.targetType === 'existing-style' && m.styleId) {
          await cloneNode.setTextStyleIdAsync(m.styleId)
        } else if (m.fontFamily && m.fontStyle) {
          cloneNode.fontName = { family: m.fontFamily, style: m.fontStyle }
          if (m.fontSize        != null) cloneNode.fontSize = m.fontSize
          if (m.lineHeightUnit  != null && m.lineHeightValue != null) {
            cloneNode.lineHeight = m.lineHeightUnit === 'AUTO'
              ? { unit: 'AUTO' }
              : { unit: m.lineHeightUnit as 'PIXELS' | 'PERCENT', value: m.lineHeightValue }
          }
          if (m.letterSpacingUnit != null && m.letterSpacingValue != null) {
            cloneNode.letterSpacing = {
              unit:  m.letterSpacingUnit as 'PIXELS' | 'PERCENT',
              value: m.letterSpacingValue,
            }
          }
        }
      } catch (err) {
        console.warn(`[Refactor] preview: mutation failed for node ${origId}:`, err)
      }
    }

    // Export AFTER (mutated clone)
    const afterRaw    = await clone.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 800 } })
    const afterBase64 = uint8ArrayToBase64(afterRaw)

    return { before: beforeBase64, after: afterBase64 }
  } finally {
    clone.remove()   // always clean up — no trace left in document
  }
}
