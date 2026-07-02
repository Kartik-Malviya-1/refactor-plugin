import type { AuditGroup, AuditItem, AuditResult } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import { groupItems } from '../engine/grouper'
import { normalizeTypographyProps } from '../modules/typography/normalizer'
import { generateFixture, estimateItemsBytes, BenchmarkScenario } from './fixtures'
import { BASELINES, REGRESSION_THRESHOLD, PAYLOAD_WARNING_BYTES } from './baselines'

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString()
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

function fmtRate(itemsPerSec: number): string {
  if (itemsPerSec >= 1_000_000) return `${(itemsPerSec / 1_000_000).toFixed(1)}M/s`
  if (itemsPerSec >= 1_000)     return `${Math.round(itemsPerSec / 1_000)}K/s`
  return `${Math.round(itemsPerSec)}/s`
}

function pad(s: string | number, n: number, right = false): string {
  const str = String(s)
  return right ? str.padStart(n) : str.padEnd(n)
}

function div(n: number): string { return '─'.repeat(n) }

function rate(count: number, ms: number): number {
  return ms > 0 ? Math.round((count / ms) * 1000) : count * 1_000_000
}

// ---------------------------------------------------------------------------
// Stage runners
// ---------------------------------------------------------------------------

/** Measures normalizeTypographyProps() throughput on a pre-built fixture. */
function benchNormalization(items: AuditItem<TypographyProperties>[]): number {
  const t = Date.now()
  for (const item of items) normalizeTypographyProps(item.properties)
  const ms = Date.now() - t
  return rate(items.length, ms)
}

interface GroupBench {
  totalMs: number
  groupingMs: number
  sortingMs: number
  groups: number
  itemsPerSec: number
  sortItemsPerSec: number  // groups sorted per second (sorting is O(K log K))
}

/** Runs groupItems() and returns per-stage timings from GrouperResult. */
async function benchGrouper(
  items: AuditItem<TypographyProperties>[]
): Promise<GroupBench> {
  const t = Date.now()
  const result = await groupItems(
    'typography',
    items,
    normalizeTypographyProps,
    (p: TypographyProperties) => `${p.fontFamily} ${p.fontStyle} / ${p.fontSize}px`,
    () => false
  )
  const totalMs = Date.now() - t
  return {
    totalMs,
    groupingMs: result.groupingMs,
    sortingMs:  result.sortingMs,
    groups:     result.groups.length,
    itemsPerSec: rate(items.length, totalMs),
    sortItemsPerSec: rate(result.groups.length, result.sortingMs),
  }
}

interface SerialBench {
  ms: number
  payloadBytes: number
  itemsPerSec: number
}

/** Benchmarks JSON.stringify on a synthetic AuditResult. */
function benchSerialization(
  groups: AuditGroup<TypographyProperties>[],
  totalItems: number
): SerialBench {
  const result: AuditResult = {
    moduleId: 'typography',
    scope: 'page',
    scopeLabel: 'Benchmark',
    totalItems,
    groups,
    scannedAt: Date.now(),
    durationMs: 0,
  }
  const t = Date.now()
  const serialized = JSON.stringify(result)
  const ms = Date.now() - t
  return { ms, payloadBytes: serialized.length, itemsPerSec: rate(totalItems, ms) }
}

// ---------------------------------------------------------------------------
// Scaling series
// ---------------------------------------------------------------------------

const SCALING_SIZES = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000]

interface ScalingRow {
  items: number
  ms: number
  itemsPerSec: number
  growthFactor: number | null
  withinBudget: boolean
}

async function runScalingSeries(): Promise<ScalingRow[]> {
  const rows: ScalingRow[] = []
  let prevMs = 0

  for (const size of SCALING_SIZES) {
    const items = generateFixture(size, 'enterprise')
    const bench = await benchGrouper(items)
    const growthFactor = prevMs > 0 && bench.totalMs > 0 ? bench.totalMs / prevMs : null
    rows.push({
      items: size,
      ms: bench.totalMs,
      itemsPerSec: bench.itemsPerSec,
      growthFactor,
      withinBudget: growthFactor === null || growthFactor <= BASELINES.grouping.maxScalingFactor,
    })
    prevMs = bench.totalMs
  }

  return rows
}

// ---------------------------------------------------------------------------
// Stress scenarios
// ---------------------------------------------------------------------------

const STRESS_SCENARIOS: Array<{ scenario: BenchmarkScenario; description: string }> = [
  { scenario: 'enterprise', description: '~2% unique groups' },
  { scenario: 'identical',  description: '1 group (best case)' },
  { scenario: 'unique',     description: 'N groups (worst case)' },
  { scenario: 'dominant',   description: '80% in 1 group' },
  { scenario: 'fragmented', description: 'sqrt(N) groups' },
]

interface StressRow {
  scenario: string
  ms: number
  itemsPerSec: number
  groups: number
  sortingMs: number
  description: string
}

async function runStressScenarios(size: number): Promise<StressRow[]> {
  const rows: StressRow[] = []
  for (const { scenario, description } of STRESS_SCENARIOS) {
    const items = generateFixture(size, scenario)
    const bench = await benchGrouper(items)
    rows.push({
      scenario,
      ms:          bench.totalMs,
      itemsPerSec: bench.itemsPerSec,
      groups:      bench.groups,
      sortingMs:   bench.sortingMs,
      description,
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

const STRESS_SIZE = 32_000

export async function runAllBenchmarks(): Promise<void> {
  const W = 64
  const eq = '═'.repeat(W)

  console.log('')
  console.log(`  ${eq}`)
  console.log('  Refactor — Scan Benchmarks')
  console.log(`  Trigger: figma.ui.postMessage({ type: 'RUN_BENCHMARKS' })`)
  console.log(`  ${eq}`)
  console.log('')
  console.log('  Traversal and Extraction require live Figma nodes.')
  console.log('  Run a scan and check the developer console for those stages.')
  console.log('')

  // ── Normalization ───────────────────────────────────────────────────────
  console.log('  ── Normalization Benchmark')
  const normItems = generateFixture(10_000, 'enterprise')
  const normRate  = benchNormalization(normItems)
  console.log(`  normalizeTypographyProps × 10,000: ${fmtRate(normRate)}`)
  console.log('')

  // ── Scaling series ──────────────────────────────────────────────────────
  console.log('  ── Scaling Series  (groupItems, enterprise scenario)')
  console.log(
    `  ${pad('Items', 8)} ${pad('Time', 7, true)} ${pad('Items/s', 9, true)}` +
    ` ${pad('Growth', 7, true)}  Status`
  )
  console.log('  ' + div(52))

  const scalingRows = await runScalingSeries()
  let nonLinear = false
  const factors: number[] = []

  for (const row of scalingRows) {
    const gf  = row.growthFactor
    const gfs = gf !== null ? `${gf.toFixed(1)}×` : '    —'
    if (!row.withinBudget) nonLinear = true
    if (gf !== null) factors.push(gf)
    const status = row.withinBudget ? '✓' : '⚠ NON-LINEAR'
    console.log(
      `  ${pad(fmt(row.items), 8)} ${pad(fmtMs(row.ms), 7, true)}` +
      ` ${pad(fmtRate(row.itemsPerSec), 9, true)} ${pad(gfs, 7, true)}  ${status}`
    )
  }

  const avgFactor = factors.length > 0 ? (factors.reduce((a, b) => a + b) / factors.length).toFixed(1) : 'n/a'
  const budget    = BASELINES.grouping.maxScalingFactor
  console.log('')
  if (nonLinear) {
    console.log(`  ⚠  Non-linear growth detected (avg ${avgFactor}×, budget ≤${budget}×)`)
  } else {
    console.log(`  Scaling: LINEAR ✓  (avg ${avgFactor}×, budget ≤${budget}×)`)
  }
  console.log('')

  // ── Stress scenarios ────────────────────────────────────────────────────
  console.log(`  ── Stress Scenarios  (${fmt(STRESS_SIZE)} items each)`)
  console.log(
    `  ${pad('Scenario', 12)} ${pad('Time', 7, true)} ${pad('Items/s', 9, true)}` +
    ` ${pad('Groups', 7, true)} ${pad('Sort', 6, true)}  Description`
  )
  console.log('  ' + div(66))

  const stressRows = await runStressScenarios(STRESS_SIZE)
  for (const row of stressRows) {
    const sortStr = row.sortingMs > 0 ? `${row.sortingMs}ms` : '<1ms'
    console.log(
      `  ${pad(row.scenario, 12)} ${pad(fmtMs(row.ms), 7, true)}` +
      ` ${pad(fmtRate(row.itemsPerSec), 9, true)} ${pad(fmt(row.groups), 7, true)}` +
      ` ${pad(sortStr, 6, true)}  ${row.description}`
    )
  }
  console.log('')

  // ── Serialization + memory ──────────────────────────────────────────────
  console.log('  ── Serialization + Memory')
  const serItems  = generateFixture(STRESS_SIZE, 'enterprise')
  const serGroups = await groupItems(
    'typography', serItems, normalizeTypographyProps,
    (p: TypographyProperties) => `${p.fontFamily} ${p.fontStyle} / ${p.fontSize}px`,
    () => false
  )
  const serial = benchSerialization(serGroups.groups, serItems.length)

  const heapKB    = (estimateItemsBytes(STRESS_SIZE) / 1024).toFixed(0)
  const payloadKB = (serial.payloadBytes / 1024).toFixed(0)
  const payloadMB = (serial.payloadBytes / 1024 / 1024).toFixed(1)

  console.log(`  Items array (~420 bytes each): ~${heapKB} KB  (${fmt(STRESS_SIZE)} items)`)
  console.log(`  JSON.stringify:                ${fmtMs(serial.ms)}  (payload: ${payloadKB} KB / ${payloadMB} MB)`)

  if (serial.payloadBytes > PAYLOAD_WARNING_BYTES) {
    console.log(`  ⚠  Payload exceeds ${PAYLOAD_WARNING_BYTES / 1024 / 1024}MB.`)
    console.log('     Large payloads increase postMessage latency and UI memory pressure.')
    console.log(`     Consider result pagination for files with >${fmt(STRESS_SIZE)} items.`)
  } else {
    console.log('  Payload within acceptable limits. ✓')
  }
  console.log('')

  // ── Regression check ────────────────────────────────────────────────────
  console.log('  ── Regression Check')
  console.log(
    `  ${pad('Stage', 16)} ${pad('Budget', 10, true)} ${pad('Actual', 10, true)}  Status`
  )
  console.log('  ' + div(52))

  const enterpriseRow = stressRows.find(r => r.scenario === 'enterprise')!
  const checks: Array<{ name: string; actual: number; key: keyof typeof BASELINES }> = [
    { name: 'normalization', actual: normRate,                     key: 'normalization' },
    { name: 'grouping',      actual: enterpriseRow.itemsPerSec,   key: 'grouping' },
    { name: 'serialization', actual: serial.itemsPerSec,          key: 'serialization' },
  ]

  let regressionFound = false

  for (const { name, actual, key } of checks) {
    const baseline = BASELINES[key]
    const minOk    = baseline.minItemsPerSec * REGRESSION_THRESHOLD
    const passing  = actual >= minOk
    if (!passing) regressionFound = true
    const ratio  = (actual / baseline.minItemsPerSec).toFixed(1)
    const status = passing
      ? `✓  ${ratio}× budget`
      : `⚠ REGRESSION  (${ratio}× budget, need ≥${REGRESSION_THRESHOLD}×)`
    console.log(
      `  ${pad(name, 16)} ${pad(fmtRate(baseline.minItemsPerSec), 10, true)}` +
      ` ${pad(fmtRate(actual), 10, true)}  ${status}`
    )
  }

  console.log('')
  if (regressionFound) {
    console.log('  ⚠  REGRESSION DETECTED. Review stages marked above.')
    console.log('     Compare against baselines in src/benchmarks/baselines.ts.')
  } else {
    console.log('  All benchmarks passed. No regressions detected. ✓')
  }

  console.log('')
  console.log(`  ${eq}`)
  console.log('')
}
