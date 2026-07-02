import type { AuditItem } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'

// ---------------------------------------------------------------------------
// Benchmark Fixtures
//
// Generates synthetic AuditItem<TypographyProperties>[] arrays for
// benchmarking the grouper, normalizer, and serializer without requiring
// a live Figma document.
// ---------------------------------------------------------------------------

export type BenchmarkScenario =
  | 'enterprise'  // ~2% unique groups — realistic production file
  | 'identical'   // 1 unique group    — best case for grouper
  | 'unique'      // N unique groups   — worst case for grouper
  | 'dominant'    // 1 large group + many small groups
  | 'fragmented'  // sqrt(N) groups of sqrt(N) items each

const FONT_FAMILIES = [
  'Inter', 'Roboto', 'SF Pro', 'Helvetica Neue', 'Georgia', 'System UI',
  'Playfair Display', 'Montserrat', 'Open Sans', 'Lato',
]
const FONT_STYLES = [
  'Regular', 'Medium', 'SemiBold', 'Bold', 'Light',
  'Italic', 'Bold Italic', 'ExtraLight', 'Black',
]
const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72]

// Maximum unique property combinations from the above arrays.
const MAX_SEED = FONT_FAMILIES.length * FONT_STYLES.length * FONT_SIZES.length

function makeProps(seed: number): TypographyProperties {
  const s = seed % MAX_SEED
  return {
    fontFamily: FONT_FAMILIES[s % FONT_FAMILIES.length],
    fontStyle:  FONT_STYLES[Math.floor(s / FONT_FAMILIES.length) % FONT_STYLES.length],
    fontWeight: 400,
    fontSize:   FONT_SIZES[
      Math.floor(s / (FONT_FAMILIES.length * FONT_STYLES.length)) % FONT_SIZES.length
    ],
    lineHeight:     { unit: 'AUTO', value: 0 },
    letterSpacing:  { unit: 'PIXELS', value: 0 },
    textCase:       'ORIGINAL',
    textDecoration: 'NONE',
  }
}

function makeItem(index: number, propSeed: number): AuditItem<TypographyProperties> {
  return {
    id:         `typography:bench_${index}`,
    nodeId:     `bench_node_${index}`,
    nodeName:   `Text Layer ${index}`,
    pageId:     'bench_page_1',
    pageName:   'Benchmark',
    properties: makeProps(propSeed),
  }
}

/**
 * Generates a synthetic fixture of the given size and scenario.
 *
 * enterprise  ~2% unique groups.  Realistic: a 5,000-layer file with
 *             ~100 distinct text styles.
 *
 * identical   All nodes share one style. Minimal grouper work;
 *             measures overhead of the bucketing loop itself.
 *
 * unique      Every node has a different style (capped at MAX_SEED).
 *             Maximum hash pressure; exposes O(N) overhead in the Map.
 *
 * dominant    80% of layers share one style; the remaining 20% are
 *             spread across many small groups. Exposes imbalanced
 *             bucket behaviour.
 *
 * fragmented  ~sqrt(N) groups of ~sqrt(N) items each. High key
 *             diversity; tests Map performance under many distinct keys.
 */
export function generateFixture(
  nodeCount: number,
  scenario: BenchmarkScenario
): AuditItem<TypographyProperties>[] {
  const items: AuditItem<TypographyProperties>[] = []
  items.length = nodeCount  // pre-allocate

  switch (scenario) {
    case 'enterprise': {
      const uniqueGroups = Math.max(1, Math.ceil(nodeCount * 0.02))
      for (let i = 0; i < nodeCount; i++) items[i] = makeItem(i, i % uniqueGroups)
      break
    }
    case 'identical': {
      for (let i = 0; i < nodeCount; i++) items[i] = makeItem(i, 0)
      break
    }
    case 'unique': {
      for (let i = 0; i < nodeCount; i++) items[i] = makeItem(i, i % MAX_SEED)
      break
    }
    case 'dominant': {
      const dominantCount  = Math.floor(nodeCount * 0.8)
      const remainingSeeds = Math.max(2, Math.ceil(nodeCount * 0.005))
      for (let i = 0; i < nodeCount; i++) {
        const seed = i < dominantCount ? 0 : 1 + (i % remainingSeeds)
        items[i] = makeItem(i, seed)
      }
      break
    }
    case 'fragmented': {
      const groupCount = Math.max(1, Math.ceil(Math.sqrt(nodeCount)))
      for (let i = 0; i < nodeCount; i++) items[i] = makeItem(i, i % groupCount)
      break
    }
  }

  return items
}

/**
 * Rough heap estimate for an items array.
 * Each AuditItem<TypographyProperties> is approximately 420 bytes:
 * strings + nested objects + JS engine overhead.
 */
export function estimateItemsBytes(nodeCount: number): number {
  return nodeCount * 420
}
