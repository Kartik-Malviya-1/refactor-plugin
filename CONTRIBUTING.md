# Contributing to Refactor

> Engineering handbook for human contributors and AI coding assistants.

Refactor is a Design System Refactoring Workspace for Figma. Its mission is to help designers understand, standardize, preview, and safely migrate design systems at scale — across files with tens of thousands of layers, across teams of hundreds of designers, across years of accumulated inconsistency.

The core workflow is:

```
Scan → Review → Map → Preview → Apply
```

Typography is the first module. Future modules — Colors, Spacing, Radius, Effects, Variables, Components — must integrate without redesigning the engine. Every decision made today is made with that constraint in mind.

This document is the authoritative reference for how Refactor is built, why it is built that way, and what every future contribution must preserve.

---

## Table of Contents

1. [Engineering Philosophy](#engineering-philosophy)
2. [Architecture](#architecture)
3. [Performance Standards](#performance-standards)
4. [Code Quality Standards](#code-quality-standards)
5. [UI Principles](#ui-principles)
6. [Scanning Principles](#scanning-principles)
7. [Module Guidelines](#module-guidelines)
8. [Pull Request Guidelines](#pull-request-guidelines)
9. [AI Contributor Guidelines](#ai-contributor-guidelines)
10. [Project Roadmap](#project-roadmap)
11. [Success Criteria](#success-criteria)

---

## Engineering Philosophy

These principles are not aspirational. They are constraints. Every PR is evaluated against them.

### Performance First

Refactor runs inside Figma's plugin sandbox. It has no backend, no worker threads, no escape hatch from the main plugin thread. Every millisecond of blocking is a millisecond the designer stares at a frozen canvas. Performance is a feature — not a nice-to-have, not a future concern, not something to revisit after launch.

Design every data structure, algorithm, and API call as if the file has 500,000 layers. Then measure it.

### Correctness Before Features

A scan that returns wrong results is worse than no scan at all. Designers will act on what Refactor shows them. A false group, a missing layer, a miscounted style — these produce real mistakes in real design systems. Correctness is non-negotiable.

### Trust Before Automation

Refactor never modifies the document without explicit user confirmation. Every destructive or irreversible operation is previewed before it is applied. The workflow is Scan → Review → Map → Preview → Apply — not Scan → Apply. The Review and Preview steps are not UX polish; they are safety gates.

### Measure Before Optimizing

No performance optimization ships without profiled before/after timings on a real file. Speculative optimization is waste. Unmeasured optimization is guesswork. The profiler is built into the plugin for this reason — use it.

### Simple Solutions Beat Clever Ones

The correct data structure is usually a `Map`. The correct algorithm is usually the obvious one. Clever code is hard to review, hard to debug, and hard to extend. When two approaches solve the same problem, the simpler one wins unless there is a documented, measured reason to prefer the other.

### Architecture Should Scale

Typography is one of seven planned modules. The engine, the traversal pipeline, the grouping algorithm, the module registry, and the message protocol are all designed to support that roadmap without modification. Every architectural decision is evaluated against this question: *will the sixth module be able to use this without changing it?*

### One Feature at a Time

Version 0.1 implements one thing: Typography Audit. It implements it completely and correctly. It does not stub out colors, does not partially implement spacing, does not ship half-finished inspectors. A focused v0.1 that works is more valuable than an ambitious v0.1 that does not.

### Never Break Existing Workflows

Once a feature ships and a designer depends on it, it cannot change in a way that surprises them. Scan results must be deterministic. The UI must behave consistently. Public interfaces are contracts.

---

## Architecture

### Layer Map

```
src/
├── shared/         Core engine types and message protocol
│   ├── types.ts    AuditItem, AuditGroup, AuditResult, AuditModule
│   └── messages.ts UIToPluginMessage, PluginToUIMessage
│
├── engine/         Generic orchestration — knows nothing about typography
│   └── registry.ts Module registration and discovery
│
├── modules/        Domain logic — one directory per module
│   └── typography/ Reference implementation
│       ├── types.ts       TypographyProperties
│       ├── normalizer.ts  Pure normalization functions
│       ├── scanner.ts     Figma API traversal + extraction
│       └── index.ts       AuditModule implementation
│
├── plugin/         Figma plugin backend (sandbox)
│   └── main.ts     Orchestration, messaging, profiler
│
└── ui/             React application (iframe)
    ├── store/      Zustand state
    ├── components/ UI components
    ├── pages/      Screen-level views
    └── hooks/      Plugin message bridge
```

### Invariants

These rules are enforced on every PR. No exceptions without an ADR (Architecture Decision Record) in the PR description.

**The engine owns orchestration.** `main.ts` drives the scan pipeline: it calls `module.scan()`, then `module.group()`, then serializes, then sends. Modules do not call each other. The engine does not know what fonts are.

**Modules own domain logic.** Typography knows about `TextNode`. Colors will know about fills. The engine knows about neither. A module implements `AuditModule<TProperties>` and nothing else leaks out.

**The UI is a renderer.** The React application receives serialized `AuditResult` objects and renders them. It never calls Figma APIs. It never performs scanning. It never normalizes typography. It displays what the plugin sends.

**The scanner never depends on React.** `src/modules/` and `src/engine/` must not import from `src/ui/`. The dependency graph is one-directional: `ui → shared ← engine ← modules`.

**Modules never communicate directly.** Module A cannot import from Module B. Shared logic belongs in `src/engine/` or `src/shared/`.

**Traversal is reusable.** The logic that walks the Figma node tree, handles scope (selection/page/file), manages async yields, and reports progress belongs in the engine — not in any module. Every future module gets traversal for free.

**Shared types belong in `src/shared/`.** Types that cross the plugin/UI boundary (`AuditItem`, `AuditGroup`, `AuditResult`, `ScanScope`, messages) live in `src/shared/` and are imported by both sides. Neither `src/plugin/` nor `src/ui/` defines types the other depends on.

**Avoid circular dependencies.** The import graph must be a DAG. `shared` has no imports from this project. `engine` imports from `shared`. `modules` import from `engine` and `shared`. `plugin` imports from everything. `ui` imports from `shared` only — never from `engine`, `modules`, or `plugin`.

### Typography as Reference Implementation

Every future module is built by reading `src/modules/typography/` first and then following its exact shape:

1. `types.ts` — Define `TProperties`
2. `normalizer.ts` — Pure functions: `normalize()`, `describe()`, formatters
3. `scanner.ts` — Figma API calls: filter predicate, property extraction
4. `index.ts` — Implement `AuditModule<TProperties>`

If implementing a new module requires changing `src/engine/`, `src/shared/types.ts`, or `src/plugin/main.ts` significantly, the engine abstraction is wrong — not the module. File an issue before writing code.

---

## Performance Standards

This is the most important section in this document.

### The Scale Constraint

All performance decisions are made against this target file profile:

| Tier | Text Layers | Total Nodes |
|------|-------------|-------------|
| Small | 400 | ~5,000 |
| Medium | 5,000 | ~50,000 |
| Large | 50,000 | ~500,000 |
| Huge | 500,000 | ~5,000,000 |

Code that works at Small but becomes unusable at Huge does not ship.

### Algorithmic Rules

**Never introduce O(n²) or worse into the scan pipeline.**

The scan pipeline processes every text layer in the file. Any algorithm that grows faster than O(n) in the number of layers is a bug, not a trade-off.

Specific patterns that are forbidden:

```typescript
// ❌ O(n²): searching the document tree once per node
for (const node of textNodes) {
  const page = figma.root.findOne(n => n.id === node.id) // traverses entire tree
}

// ✓ O(n): build a lookup map during traversal
const nodeToPage = new Map<string, PageInfo>()
// populate once during traversal, then O(1) per node
```

```typescript
// ❌ Duplicate property access — each access is a Figma IPC call
const fontName = node.fontName === figma.mixed ? ... : node.fontName
//                ↑ IPC call 1                          ↑ IPC call 2

// ✓ Cache before the guard
const raw = node.fontName  // 1 IPC call
const fontName = raw === figma.mixed ? ... : raw
```

**Prefer a single document traversal.**

For a given scan scope, the node tree is walked exactly once. All modules (when running simultaneously in future versions) share a single traversal pass. Repeated traversals for the same scope are a defect.

**Avoid repeated page lookups.**

Determining which page a node belongs to must not require searching any tree. During traversal, each node is associated with its page in O(1) by building a `Map<nodeId, PageInfo>` as nodes are visited.

**Cache expensive computations.**

Normalization keys are computed once per item and never recomputed. String values that appear across many nodes (font families, page names) are interned so that identical strings share a single object in memory.

**Batch and throttle UI updates.**

Progress messages are sent on a time-based interval, not a node-count interval. At 500K nodes, node-count batching produces thousands of `postMessage` calls. Time-based throttling (≥100ms between sends) caps messaging overhead regardless of file size.

**Profile before optimizing.**

The profiler in `src/plugin/main.ts` measures every stage of the pipeline and prints a breakdown to the developer console after every scan. Before opening a performance PR:

1. Run the profiler on a file representative of the target tier.
2. Identify the actual bottleneck from the output.
3. Optimize only that stage.
4. Run the profiler again and include both outputs in the PR.

Do not optimize a stage that the profiler shows is not the bottleneck.

**Every performance PR must include measured timings.**

A PR that claims "this is faster" without profiler output will not be merged. The format:

```
Before: Extraction ............. 28.4s   96.1%
After:  Extraction ............. 14.1s   93.8%
Improvement: ~50%
File: enterprise-design-system.fig (400 text layers)
```

### Memory Rules

- Avoid building large intermediate arrays that can be streamed or processed in place.
- Intern repeated strings (font families, style names, page names) to reduce GC pressure.
- Release reference arrays (e.g., the raw node list) as soon as extraction is complete.
- Do not serialize the same object twice. The profiler's `JSON.stringify` measurement was removed for this reason.

### Chunking Rules

Every synchronous loop that runs over O(1000) items must yield to the event loop at regular intervals using `await new Promise(r => setTimeout(r, 0))`. This is mandatory for:

- Tree traversal (yield every ~500 nodes visited)
- Property extraction (yield every ~200 nodes)
- Normalization/grouping (yield every ~1000 items)

Each yield point is also a cancellation checkpoint.

---

## Code Quality Standards

### TypeScript

- Strict mode is enforced. `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` are all enabled.
- No `any` without an explicit `// eslint-disable-next-line` comment explaining why.
- Prefer `unknown` over `any` for external data. Narrow with type guards.
- Do not use type assertions (`as T`) to silence the compiler. Fix the types.

### Functions

- Functions do one thing. If a function has two responsibilities, it is two functions.
- Functions that are not exported are private. If a function is exported, its signature is a contract.
- Pure functions (no side effects, same input → same output) are preferred for all normalization and formatting logic.
- Async functions that are part of the scan pipeline must support cancellation via an `isCancelled: () => boolean` parameter.

### Naming

- Names describe intent, not implementation. `normalizeTypography` not `buildKey`.
- Boolean variables and functions are named as predicates: `isScanning`, `hasSelection`, `isCancelled`.
- Abbreviations are forbidden unless universally understood (`ms` for milliseconds is fine; `exProp` for `extractedProperties` is not).
- Profiling exports use the `_` prefix (`_scanTimings`) to signal internal use and suppress linter warnings.

### No Magic Numbers

```typescript
// ❌
if (i % 200 === 0) { ... }
await new Promise(r => setTimeout(r, 0))

// ✓
const EXTRACTION_CHUNK_SIZE = 200
const YIELD_DELAY_MS = 0
if (i % EXTRACTION_CHUNK_SIZE === 0) { ... }
```

### No Duplicated Logic

If the same logic appears in two places, it belongs in a shared utility. Typography's `formatLineHeight` is not reimplemented by Colors. The grouping algorithm is not reimplemented per module. Shared logic lives in `src/engine/` or `src/shared/`.

### Comments

Comments explain *why*, not *what*. Well-named code explains what it does.

```typescript
// ❌ explains what (the code already does)
// Iterate over text nodes and extract properties
for (const node of textNodes) { ... }

// ✓ explains why (non-obvious constraint)
// Yield every 200 nodes to prevent blocking the plugin sandbox thread.
// The Figma plugin API uses synchronous IPC for each property access;
// without yielding, a 50K-node file freezes the UI for ~30 seconds.
if (i % EXTRACTION_CHUNK_SIZE === 0) {
  await new Promise<void>(r => setTimeout(r, 0))
}
```

### Imports

- No default exports except for React components and the Vite entry points.
- Import types with `import type` where possible.
- Barrel files (`index.ts`) are used only at the module level — not for grouping unrelated utilities.

---

## UI Principles

Refactor's UI should feel like a professional productivity tool built by people who care deeply about craft. The benchmark is Figma's own Variables panel.

### Design References

- **Figma Variables panel** — density, native feel, property rows
- **Linear** — neutral palette, tight typography, information density without clutter
- **Raycast** — fast, keyboard-first, command-driven feel
- **GitHub Desktop** — clarity, predictability, no surprises

### Visual Standards

- Neutral color palette. No marketing gradients. No decorative illustrations.
- Typography hierarchy is the primary visual language. Size, weight, and color carry meaning — not decoration.
- Rounded corners, soft dividers, subtle elevation. Nothing that competes with the canvas.
- Icons: Lucide, 16px, consistent stroke weight. No filled variants in the same view as stroked variants.

### Interaction Standards

- Every action has an immediate visual response. No spinner that appears 200ms after a click.
- Destructive or irreversible actions are always one step behind a confirmation.
- The plugin does not change the user's selection without explicit intent (e.g., clicking "Select All").
- Keyboard navigation follows Figma's own conventions.

### Density

The audit table is a table — not a card grid. Information is dense because designers working on large files need to see many groups at once. Comfort features (large thumbnails, generous padding, animations) are subordinate to the ability to scan 200 rows without scrolling.

### Responsiveness

The UI must remain interactive during scanning. The progress bar updates smoothly. The Cancel button works. Clicking other parts of the UI does not block. This is enforced by the chunking and throttling rules in the scan pipeline — the UI cannot be made responsive through CSS alone.

### Do Not Redesign Without Evidence

The layout, workflow, and navigation exist because of deliberate decisions made against specific use cases. Do not propose redesigns based on aesthetic preference. Proposals for UX changes must include the problem being solved and evidence that the current design does not solve it.

---

## Scanning Principles

These invariants must hold for every module, not just Typography.

**Traversal is independent from extraction.** The engine walks the node tree and collects typed nodes. It does not know what properties to read from them. Typography tells the engine which node type to collect; Typography then extracts properties separately.

**Extraction is independent from grouping.** Extraction produces `AuditItem<TProperties>[]`. Grouping takes that array and produces `AuditGroup<TProperties>[]`. These are separate passes with a clean data handoff between them.

**Grouping is independent from rendering.** The grouper returns a pure data structure. The UI renders it. The grouper does not make any assumptions about what the UI will do with the groups.

**Scanning is deterministic.** Given the same document state, the same scope, and the same module, the scan must produce identical results every time. Non-determinism in the scanner is a bug.

**Scanning never modifies the document.** The scanner is read-only. It calls no Figma API that creates, updates, or deletes nodes. This invariant is absolute — there are no exceptions for "convenience" edits.

**Scanning supports cancellation.** Every chunked loop checks a cancellation signal at each yield point. A cancelled scan discards partial results and does not send `SCAN_COMPLETE`.

**Scanning reports progress.** The scan pipeline emits `SCAN_PROGRESS` messages on a time-based interval. The label and percentage are meaningful at each stage. An indeterminate spinner is not an acceptable substitute for progress reporting.

---

## Module Guidelines

### The Module Contract

Every module implements `AuditModule<TProperties>` from `src/shared/types.ts`. No exceptions. No additional interfaces that the engine needs to know about.

```typescript
interface AuditModule<TProperties> {
  readonly id: string           // stable, kebab-case, never changes after v1
  readonly name: string         // display name
  readonly description: string  // one sentence
  readonly icon: string         // Lucide icon name

  scan(scope: ScanScope, onProgress?: ProgressCallback): Promise<AuditItem<TProperties>[]>
  normalize(item: AuditItem<TProperties>): string
  describe(descriptor: TProperties): string
  group(items: AuditItem<TProperties>[]): AuditGroup<TProperties>[]
}
```

### Module Lifecycle

Every module implements the same four-stage lifecycle:

1. **Scan** — Walk the document, extract properties from relevant nodes. Returns `AuditItem[]`.
2. **Normalize** — Reduce an item's properties to a stable, canonical string key for grouping.
3. **Group** — Bucket items by normalized key, build `AuditGroup[]`, sort by count descending.
4. **Describe** — Convert a group's canonical properties into a human-readable label.

### Adding a New Module

1. Read `src/modules/typography/` completely before writing a single line.
2. Create `src/modules/{name}/types.ts` — define `TProperties`.
3. Create `src/modules/{name}/normalizer.ts` — pure normalization and formatting functions.
4. Create `src/modules/{name}/scanner.ts` — Figma API traversal and extraction.
5. Create `src/modules/{name}/index.ts` — implement `AuditModule<TProperties>`.
6. Register the module in `src/plugin/main.ts`.
7. Add a `ModuleRegistration` entry in `src/engine/registry.ts`.

Steps 1–7 are the only steps. Adding a new module must not require changes to:
- `src/shared/types.ts`
- `src/shared/messages.ts`
- The React UI components
- The scan engine orchestration logic

If it does, file an issue before proceeding.

### Module-Specific Assumptions Stay in Modules

The engine does not contain font-specific logic. It does not contain color-specific logic. It does not contain any concept that belongs to exactly one module. If a change to the engine is justified only by the needs of one module, it does not belong in the engine.

---

## Pull Request Guidelines

### PR Description Template

Every PR must complete this template. Incomplete descriptions are returned without review.

```markdown
## Purpose
One sentence: why does this PR exist?

## Summary
What changed and why. Bullet points preferred.

## Architecture Impact
Does this change any shared types, engine interfaces, module contracts, or message protocol?
If yes, explain why the change is necessary and backwards-compatible.

## Performance Impact
Does this change any code that runs during a scan?
If yes, include profiler output before and after on a representative file.

## Screenshots
(Required for any UI change)

## Benchmark Comparison
(Required for any scanner change)

## Checklist
- [ ] No breaking changes to public interfaces
- [ ] No O(n²) or worse algorithms introduced
- [ ] No duplicated logic (check for existing utilities first)
- [ ] No unnecessary dependencies added
- [ ] Performance measured if scanner was touched
- [ ] TypeScript strict — no new `any` without justification
- [ ] All existing behaviour preserved
```

### Commit Messages

Commit messages follow the Conventional Commits format:

```
feat: add color audit module
fix: handle mixed font names in extraction
perf: eliminate O(n²) page lookup in file scope
refactor: move grouping logic into scan engine
test: add grouping benchmarks for 500K items
docs: update module guidelines in CONTRIBUTING
```

The scope is optional. The body should explain *why*, not *what*.

### What Will Not Be Merged

- Performance changes without measured before/after timings.
- New algorithms without complexity analysis.
- New abstractions without documented justification.
- Changes to `src/shared/types.ts` that break existing module implementations.
- UI changes without screenshots.
- Code with duplicated logic that already exists elsewhere.
- Speculative features not on the roadmap.

---

## AI Contributor Guidelines

This section is written for AI coding assistants: Figma Make, GitHub Copilot, Claude Code, Cursor, ChatGPT, Gemini, and any successor tools.

Refactor is a production codebase. It is not a sandbox. It is not a prototype. Changes made here affect real designers working with real files. These guidelines are non-negotiable.

### Before Changing Any Code

1. **Read the architecture section of this document first.** Understand the layer map, the invariants, and the dependency rules.
2. **Read the file you are about to change.** Read its imports. Understand what it owns.
3. **Search for existing abstractions before creating new ones.** If `normalizeTypography` already exists, you do not create `buildTypographyKey`. If the engine already handles scope, you do not re-implement scope handling in a module.
4. **Understand the public interface before changing it.** `AuditModule`, `AuditItem`, `AuditGroup`, and the message types are contracts. Changing them breaks all implementations.
5. **If the task is ambiguous, ask. Do not invent architecture.**

### When Writing New Code

- Reuse existing abstractions. Do not duplicate.
- Follow the naming conventions in this document.
- Follow the TypeScript rules in this document.
- Do not add dependencies without justification.
- Do not add features that are not requested.
- Do not refactor code that is not broken.
- Do not rename things that work. Renames break imports across the codebase and introduce noise.
- Do not add comments that explain what the code does. Add comments only when the *why* is non-obvious.

### When Modifying the Scanner

1. Run the profiler on the affected file before making changes. Record the output.
2. Make the smallest change that solves the identified problem.
3. Run the profiler again. Record the output.
4. Include both outputs in the commit message or PR.
5. If the measured improvement is less than 10%, reconsider whether the change is worth the complexity.

### When Asked to Optimize

- Optimize the stage the profiler identifies as the bottleneck. Not a different stage.
- Apply one optimization at a time. Measure after each.
- Do not optimize speculatively. "This might be faster" is not a reason to ship.
- Do not change algorithmic complexity without documenting the before/after complexity.
- Do not introduce complexity that has no measurable benefit.

### What AI Assistants Must Never Do

- **Rewrite working code without justification.** If the code is correct and performant, it does not need rewriting.
- **Introduce new architectural patterns.** Follow the existing patterns. New patterns require human review and an ADR.
- **Change public interfaces speculatively.** `AuditModule`, message types, and `AuditResult` are stable contracts.
- **Add features that were not requested.** The scope of a task is exactly what was asked.
- **Skip performance measurement when touching the scanner.** This rule has no exceptions.
- **Invent abstractions.** Use what exists. If something new is genuinely needed, surface it as a question.
- **Introduce circular dependencies.** The dependency graph must remain a DAG.
- **Use `any` to resolve type errors.** Fix the types.

### The Standard for AI-Authored PRs

An AI-authored change is held to exactly the same standard as a human-authored change. It must include a complete PR description. It must include profiler output if the scanner was touched. It must not introduce new abstractions without justification. It must preserve all existing behaviour.

The phrase "I assumed this was acceptable" is not a justification. Read the architecture. Follow it. Ask if uncertain.

---

## Project Roadmap

This roadmap defines the scope of each release. Future contributors should extend the existing architecture rather than redesign it.

| Version | Feature | Notes |
|---------|---------|-------|
| **v0.1** | Typography Audit | Scan, Group, Review, Inspector |
| **v0.2** | Typography Mapping | Map styles to Figma variables |
| **v0.3** | Typography Preview | Diff view: before and after |
| **v0.4** | Typography Replace | Apply mappings to document |
| **v1.0** | Colors | First multi-module release |
| **v1.1** | Spacing | Padding, gap, auto-layout |
| **v1.2** | Radius | Corner radius inconsistencies |
| **v1.3** | Effects | Shadows, blurs, noise |
| **v1.4** | Variables | Detect unbound raw values |
| **v2.0** | Design Health Dashboard | Aggregate view across modules |

### Versioning Principles

- `v0.x` — Audit-only. No document modifications. No variables. No replace.
- `v1.x` — Full audit + replace cycle for each module. Modules are independent.
- `v2.x` — Cross-module aggregation, health scoring, team dashboards.

### What Each New Module Requires

- One new directory: `src/modules/{name}/`
- Four files following the Typography reference implementation
- One registration in `src/engine/registry.ts`
- One `registerModule()` call in `src/plugin/main.ts`
- Zero changes to the engine, the UI layout, or the message protocol

If a new module requires more than this, the engine abstraction is insufficient and must be addressed before the module ships.

---

## Success Criteria

Refactor's goal is to become the fastest, most trustworthy, and most scalable design system refactoring tool available for Figma.

Fast means:
- A 50,000-layer file scans in under 10 seconds.
- A 500,000-layer file scans in under 2 minutes.
- The UI remains interactive throughout.
- Progress is accurate and updates at least every 500ms.

Trustworthy means:
- Scan results are deterministic.
- The plugin never modifies the document without confirmation.
- Cancelled scans leave no side effects.
- Every group in the audit correctly represents every layer it claims to contain.

Scalable means:
- Adding the sixth module requires no changes to the engine.
- A 10× increase in file size produces a 10× increase in scan time — not 100×.
- The codebase remains navigable by a developer who has never seen it before.

Every contribution should move the project toward this benchmark. When in doubt about whether a change serves these goals, the answer is to ask — not to assume.

---

*This document is maintained by the Refactor core team. Proposed changes to engineering standards require a PR with discussion before merging.*
