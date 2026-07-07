import type { ApplyEntry, MutationResult, MutationStatus, ApplyProgress, MigrationReport } from '../shared/apply-types'
import type { NewStyleTarget, ManualValuesTarget } from '../shared/migration'

const PROGRESS_BATCH = 50

async function validateEntry(e: ApplyEntry): Promise<{ valid: boolean; reason?: string }> {
  // figma.getNodeById is forbidden in dynamic-page mode — must use async variant
  const node = await figma.getNodeByIdAsync(e.nodeId)
  if (!node) return { valid: false, reason: 'Node no longer exists' }
  if (node.type !== 'TEXT') return { valid: false, reason: `Expected TEXT, got ${node.type}` }
  if ((node as TextNode).locked) return { valid: false, reason: 'Node is locked' }
  const t = e.target
  if (t.type === 'existing-style') {
    const s = await figma.getStyleByIdAsync(t.styleId)
    if (!s) return { valid: false, reason: `Style missing: ${t.styleName}` }
    if (s.type !== 'TEXT') return { valid: false, reason: 'Style is not TEXT' }
  }
  if (t.type === 'existing-variable') {
    try { if (!figma.variables.getVariableById(t.variableId)) return { valid: false, reason: `Variable missing: ${t.variableName}` } }
    catch { return { valid: false, reason: 'Variables API unavailable' } }
  }
  return { valid: true }
}

async function preloadFonts(entries: ApplyEntry[]): Promise<void> {
  const needed = new Map<string, FontName>()
  for (const e of entries) {
    const t = e.target
    if (t.type === 'new-style' || t.type === 'manual-values') {
      const tt = t as NewStyleTarget | ManualValuesTarget
      needed.set(`${tt.fontFamily}|${tt.fontStyle}`, { family: tt.fontFamily, style: tt.fontStyle })
    }
  }
  for (const font of needed.values()) {
    try { await figma.loadFontAsync(font) } catch (err) {
      console.warn(`[Refactor] apply: font load failed: ${font.family} ${font.style}`, err)
    }
  }
}

async function buildNewStyleCache(entries: ApplyEntry[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>()
  const existing = await figma.getLocalTextStylesAsync()
  for (const s of existing) cache.set(s.name, s.id)
  for (const e of entries) {
    if (e.target.type !== 'new-style') continue
    const t = e.target as NewStyleTarget
    if (cache.has(t.name)) continue
    try {
      const style = figma.createTextStyle()
      style.name = t.name
      style.fontName = { family: t.fontFamily, style: t.fontStyle }
      style.fontSize = t.fontSize
      style.lineHeight = t.lineHeightUnit === 'AUTO' ? { unit: 'AUTO' } : { unit: t.lineHeightUnit as 'PIXELS' | 'PERCENT', value: t.lineHeightValue }
      style.letterSpacing = { unit: t.letterSpacingUnit as 'PIXELS' | 'PERCENT', value: t.letterSpacingValue }
      cache.set(t.name, style.id)
    } catch (err) { console.warn(`[Refactor] apply: createTextStyle failed: ${t.name}`, err) }
  }
  return cache
}

async function applyMutation(e: ApplyEntry, nsCache: Map<string, string>): Promise<{ status: MutationStatus; error?: string }> {
  // figma.getNodeById is forbidden in dynamic-page mode
  const node = await figma.getNodeByIdAsync(e.nodeId)
  if (!node || node.type !== 'TEXT') return { status: 'failed', error: 'Node missing or wrong type' }
  const tn = node as TextNode
  if (tn.locked) return { status: 'skipped', error: 'Node is locked' }
  const t = e.target
  try {
    if (t.type === 'skip') return { status: 'skipped' }
    if (t.type === 'existing-style') { await tn.setTextStyleIdAsync(t.styleId); return { status: 'success' } }
    if (t.type === 'new-style') {
      const id = nsCache.get((t as NewStyleTarget).name)
      if (!id) return { status: 'failed', error: `Style not created: ${(t as NewStyleTarget).name}` }
      await tn.setTextStyleIdAsync(id); return { status: 'success' }
    }
    if (t.type === 'manual-values') {
      const mv = t as ManualValuesTarget
      tn.fontName = { family: mv.fontFamily, style: mv.fontStyle }
      tn.fontSize = mv.fontSize
      tn.lineHeight = mv.lineHeightUnit === 'AUTO' ? { unit: 'AUTO' } : { unit: mv.lineHeightUnit as 'PIXELS' | 'PERCENT', value: mv.lineHeightValue }
      tn.letterSpacing = { unit: mv.letterSpacingUnit as 'PIXELS' | 'PERCENT', value: mv.letterSpacingValue }
      return { status: 'success' }
    }
    if (t.type === 'existing-variable') return { status: 'skipped', error: 'Variable binding not yet supported' }
    return { status: 'skipped', error: `Unknown: ${(t as { type: string }).type}` }
  } catch (err) { return { status: 'failed', error: err instanceof Error ? err.message : String(err) } }
}

export async function runApplyEngine(
  entries: ApplyEntry[], onProgress: (p: ApplyProgress) => void
): Promise<MigrationReport> {
  const startedAt = Date.now()
  const results: MutationResult[] = []
  let applied = 0, skipped = 0, failed = 0, blockedCount = 0

  onProgress({ phase: 'validating', total: entries.length, applied: 0, skipped: 0, failed: 0 })
  const valid: ApplyEntry[] = [], blocked: ApplyEntry[] = []
  for (const e of entries) {
    const { valid: ok, reason } = await validateEntry(e)
    if (ok) { valid.push(e) } else {
      blocked.push(e)
      results.push({ nodeId: e.nodeId, nodeName: e.nodeName, pageId: e.pageId, pageName: e.pageName, sigKey: e.sigKey, status: 'blocked', error: reason, timestamp: Date.now() })
      blockedCount++
    }
  }
  console.log(`[Refactor] apply: ${valid.length} valid, ${blockedCount} blocked`)

  onProgress({ phase: 'applying', total: entries.length, applied: 0, skipped: blockedCount, failed: 0 })
  await preloadFonts(valid)
  const nsCache = await buildNewStyleCache(valid)

  const byPage = new Map<string, ApplyEntry[]>()
  for (const e of valid) { if (!byPage.has(e.pageId)) byPage.set(e.pageId, []); byPage.get(e.pageId)!.push(e) }

  const startPage = figma.currentPage
  let batchCount = 0
  for (const [pageId, pageEntries] of byPage) {
    const page = figma.root.children.find(p => p.id === pageId)
    if (!page || page.type !== 'PAGE') {
      for (const e of pageEntries) { results.push({ nodeId: e.nodeId, nodeName: e.nodeName, pageId: e.pageId, pageName: e.pageName, sigKey: e.sigKey, status: 'failed', error: 'Page not found', timestamp: Date.now() }); failed++ }
      continue
    }
    await figma.setCurrentPageAsync(page as PageNode)
    for (const entry of pageEntries) {
      const { status, error } = await applyMutation(entry, nsCache)
      results.push({ nodeId: entry.nodeId, nodeName: entry.nodeName, pageId: entry.pageId, pageName: entry.pageName, sigKey: entry.sigKey, status, error, timestamp: Date.now() })
      if (status === 'success') applied++; else if (status === 'failed') failed++; else skipped++
      if (++batchCount % PROGRESS_BATCH === 0) onProgress({ phase: 'applying', total: entries.length, applied, skipped: skipped + blockedCount, failed, current: entry.nodeName })
    }
  }
  try { await figma.setCurrentPageAsync(startPage) } catch {}

  const completedAt = Date.now()
  console.log(`[Refactor] apply done — ${applied} success / ${skipped + blockedCount} skipped / ${failed} failed in ${completedAt - startedAt}ms`)
  return { startedAt, completedAt, durationMs: completedAt - startedAt, totalNodes: entries.length, successful: applied, skipped: skipped + blockedCount, failed, blocked: blockedCount, results }
}
