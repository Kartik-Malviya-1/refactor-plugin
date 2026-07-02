# Refactor — Performance History

This document records benchmark results across releases, commits, and sprints.
Its purpose is to make performance regressions visible before they reach
production, and to document intentional performance improvements over time.

**Sections:**
- [How to Record an Entry](#how-to-record-an-entry)
- [Summary Table](#summary-table)
- [Entries](#entries)
- [Regression Log](#regression-log)

---

## How to Record an Entry

After every significant code change that touches the scan pipeline:

1. Open the plugin in Figma Desktop (development mode)
2. Open the developer console: **Plugins → Development → Open console**
3. Run:
   ```js
   figma.ui.postMessage({ type: 'RUN_BENCHMARKS' })
   ```
4. Wait for the output to complete (~5–10 seconds)
5. Copy the `┌─ History Entry ─┐` block from the end of the console output
6. Paste it into the **Entries** section below, newest entry first
7. Update the **Summary Table** with the key metrics

For profiler measurements (Traversal, Extraction, Total):
1. Scan a representative real file using the plugin UI
2. Note the profiler output from the developer console
3. Add the `profiler:` block to the entry

Benchmark figures without profiler data are marked as `—`.

---

## Summary Table

Newest entries first. Figures from the benchmark runner (synthetic data)
unless noted as `[profiler]` (live Figma file).

| Date | Commit | Sprint | Norm | Grouping | Sorting | Serial | Payload | Status |
|------|--------|--------|------|----------|---------|--------|---------|--------|
| 2025-07-02 | `7f634c2` | v0.1.1 | *run benchmarks* | *run benchmarks* | *run benchmarks* | *run benchmarks* | *run benchmarks* | ⏳ pending |

---

## Entries

### v0.1.1 — Performance Sprint Baseline

**Date:** 2025-07-02
**Commit:** `7f634c2`  
**Branch:** `main`  
**Sprint:** v0.1.1 Performance Sprint  

#### Architecture changes in this sprint

| Commit | Title | Impact |
|--------|-------|--------|
| `b614aad` | `perf: eliminate O(n²) page lookup` | File-scope scans: O(N²) → O(N) |
| `355a39d` | `perf: reduce scan memory usage` | String interning, Array→template literal, removed double serialize |
| `7e8a686` | `perf: optimize progress messaging` | 2,500 messages → ~200 for 500K-node scan |
| `e98abd0` | `perf: virtualize audit rendering` | React.memo, stable callbacks, zero unneeded re-renders |
| `af4fb71` | `refactor: introduce Core Scan Engine` | Scanner Adapter architecture, engine owns orchestration |
| `1d9eae8` | `perf: chunk scan pipeline` | Traversal yields every 500 nodes; cancel in <50ms at any scale |
| `7f634c2` | `test: add scan benchmarks` | Synthetic benchmark framework with regression detection |

#### Benchmark results

Run `RUN_BENCHMARKS` on this commit and paste the output block here.

```
[pending — copy History Entry block from console after running RUN_BENCHMARKS]
```

#### Profiler results

Run the plugin on a representative real file and record below.

```
[pending — copy profiler output from console after scanning a real file]
```

---

## Regression Log

If the benchmark runner flags a regression, document it here:

| Date | Commit | Stage | Budget | Actual | Root Cause | Resolved |
|------|--------|-------|--------|--------|------------|----------|
| — | — | — | — | — | — | — |

When a regression is detected:
1. Do not update the baseline to hide it.
2. Identify the root cause.
3. Fix or accept the regression with documentation.
4. Mark resolved with the commit that addressed it.

---

## Schema Reference

See `docs/benchmark-schema.json` for the machine-readable schema.
Each History Entry block output by the benchmark runner conforms to this schema.

| Field | Source | Description |
|-------|--------|-------------|
| `date` | Manual | YYYY-MM-DD of benchmark run |
| `commit` | Manual | Short git SHA |
| `sprint` | Manual | Version label or sprint name |
| `normalizationItemsPerSec` | Benchmark runner | `normalizeTypographyProps()` throughput |
| `groupingItemsPerSec` | Benchmark runner | `groupItems()` enterprise scenario throughput |
| `groupingScalingFactor` | Benchmark runner | Average growth ratio (doubling series 1K→64K) |
| `sortingGroupsPerSec` | Benchmark runner | `groups.sort()` throughput |
| `serializationMs` | Benchmark runner | `JSON.stringify(AuditResult)` for 32K items |
| `payloadKB` | Benchmark runner | Serialized payload size for 32K items |
| `traversalMs` | Live profiler | From developer console during a real scan |
| `extractionMs` | Live profiler | From developer console during a real scan |
| `totalScanMs` | Live profiler | End-to-end scan time on a real file |
| `nodeCount` | Live profiler | Text layers scanned |
| `regressionDetected` | Benchmark runner | `true` if any stage fell below budget × 0.7 |

---

*This document is maintained manually. The benchmark runner prints a
formatted entry block ready for copy-paste. See `src/benchmarks/runner.ts`
for benchmark logic and `src/benchmarks/baselines.ts` for regression budgets.*
