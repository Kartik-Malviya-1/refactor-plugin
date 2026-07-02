# Refactor — Architecture

> Principal architect documentation. Written for experienced TypeScript and Figma Plugin developers joining the project.

---

## Introduction: This Is Not a Typography Plugin

Refactor is a Design System Refactoring Platform that happens to ship its first module as a Typography Audit. The distinction matters architecturally.

A typography plugin is a point solution: it knows about fonts, it has font-specific UI, it has font-specific storage. It is coupled to its domain because there is no reason not to be.

Refactor is different. Its architecture anticipates six additional modules — Colors, Spacing, Radius, Effects, Variables, Components — each with identical workflow and identical structure. The system is designed so that adding the seventh module costs approximately the same engineering effort as adding the second. The core engine does not change. The UI chrome does not change. The message protocol does not change. The data model does not change.

This constraint — *a new module must not require changes to the engine* — is the primary driver of every architectural decision in this document.

---

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│  FIGMA CANVAS                                                           │
└───────────────────────────────────────────────────────────────────────────┘
         ↑ figma.currentPage / figma.root (read-only)
┌────────────────────────────────────┐    ┌────────────────────────────────┐
│  PLUGIN SANDBOX (main.ts)        │    │  REACT UI (iframe)              │
│                                  │    │                                │
│  ┌────────────────────────┐  │    │  ┌────────────────────────┐  │
│  │  Engine / Orchestrator    │  │    │  │  App Shell              │  │
│  │  ───────────────────────│  │    │  │  Pages / Components     │  │
│  │  Module Registry          │  │    │  │  Zustand Store          │  │
│  │  Active Module            │  │    │  │  Hooks (message bridge) │  │
│  └────────────────────────┘  │    │  └────────────────────────┘  │
│                                  │    │                                │
│  ┌────────────────────────┐  │    │                                │
│  │  Scan Pipeline            │  │    │                                │
│  │  ───────────────────────│  │    │                                │
│  │  1. Traversal             │  │    │                                │
│  │  2. Extraction            │  │    │                                │
│  │  3. Normalization         │  │    │                                │
│  │  4. Grouping              │  │    │                                │
│  │  5. Serialization         │  │    │                                │
│  └────────────────────────┘  │    │                                │
└────────────────────────────────────┘    └────────────────────────────────┘
         │ postMessage (structured clone)    ↑
         └─────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | What It Knows About |
|---|---|---|
| Figma Canvas | Source of truth for all design data | Everything |
| Plugin Sandbox | Orchestration, Figma API access, all computation | Engine, modules, Figma API |
| Module Registry | Which modules exist and how to find them | Module IDs and interfaces |
| Active Module | Domain-specific scan, normalize, group | One design domain only |
| Scan Pipeline | Traversal, extraction, grouping, serialization | The engine contract |
| Message Layer | Typed postMessage between sandbox and iframe | Message shapes only |
| React UI | Rendering, navigation, user interactions | Serialized `AuditResult` |
| Zustand Store | UI and audit state | Serialized data + UI state |

The critical invariant: **each layer knows only what it needs to perform its responsibility**. The engine does not know what a font is. The UI does not know how traversal works. The scanner does not know what React is.

---

## Folder Structure

```
src/
├── shared/                 ← The contract layer
│   ├── types.ts            Core engine types: AuditItem, AuditGroup,
│   │                       AuditResult, AuditModule, ScanScope
│   └── messages.ts         Plugin↔UI message protocol
│
├── engine/                 ← Infrastructure with no domain knowledge
│   └── registry.ts         Module registration and MODULE_CATALOG
│
├── modules/                ← One directory per audit domain
│   └── typography/         Reference implementation
│       ├── types.ts        TypographyProperties (domain types)
│       ├── normalizer.ts   Pure functions: normalize, describe, format
│       ├── scanner.ts      Figma API: traversal, extraction, profiling
│       └── index.ts        AuditModule<TypographyProperties> impl
│
├── plugin/                 ← The plugin sandbox entry point
│   └── main.ts             Orchestration, message handler, profiler
│
└── ui/                     ← The React application (iframe)
    ├── App.tsx             Root: mounts AppShell, routes pages
    ├── main.tsx            React entry point
    ├── styles.css          Tailwind + CSS custom properties
    ├── lib/
    │   └── cn.ts           clsx + tailwind-merge utility
    ├── store/              Zustand state
    │   ├── audit.ts        Scan lifecycle + AuditResult
    │   └── ui.ts           Navigation, selection, inspector, toast
    ├── hooks/
    │   ├── usePluginMessage.ts   Inbound message handler
    │   └── useSendMessage.ts     Outbound postMessage wrapper
    ├── components/
    │   ├── layout/         AppShell, Sidebar, Header
    │   ├── audit/          SummaryCards, AuditTable, GroupRow, TypographyPreview
    │   ├── inspector/      TypographyInspector, PropertyRow
    │   └── ui/             Button, Badge, SearchInput, Spinner,
    │                       EmptyState, Toast
    └── pages/
        ├── DashboardPage.tsx   “What needs cleanup?” entry point
        ├── ScanPage.tsx        Scope selection + live progress
        └── AuditPage.tsx       Results table + inspector
```

### Why This Structure

`shared/` has no imports from this project. It defines the contracts everything else depends on. This makes it the only safe place for types that cross process boundaries (plugin sandbox ↔ React iframe).

`engine/` contains infrastructure that is module-agnostic. It knows the *shape* of a module (the `AuditModule` interface) but not the *content* of any module. Adding a new module never requires changing `engine/`.

`modules/` is partitioned by domain. The Typography module cannot import from the Colors module. Shared logic that two modules need lives in `engine/` or `shared/`, never in one module imported by another.

`plugin/` is the Figma Plugin API entry point. It is the only place that calls `figma.*` APIs outside of module scanners. It drives orchestration but owns no domain logic.

`ui/` is the React application. It cannot import from `plugin/`, `engine/`, or `modules/`. Its only external dependencies are `shared/` (for types) and the message hooks (for communication).

---

## Core Engine

### Why the Engine Knows Nothing About Typography

The engine's job is orchestration: receive a scan request, find the right module, run the pipeline, send the result. It does not need to know what a `FontName` is to do this. If it did know, it would need to be changed every time a new module arrived.

This is the Dependency Inversion Principle applied to plugin architecture: the engine depends on abstractions (`AuditModule<TProperties>`), not on concretions (`TypographyModule`). Typography is one implementation of that abstraction, not a special case.

### Module Registration

```typescript
// src/plugin/main.ts
registerModule(typographyModule)

// The engine discovers it:
const module = getModule(moduleId)  // returns AuditModule<unknown>
const items = await module.scan(scope, onProgress)
const groups = module.group(items)
```

Modules self-register at startup. The engine discovers them by ID from the registry. This is inversion of control: the engine does not instantiate modules, modules announce themselves to the engine.

When Colors ships, its registration is a single line in `main.ts`:
```typescript
registerModule(colorsModule)
```

Nothing else in the engine changes.

### The Module Registry

The registry has two concerns that look similar but are different:

**Runtime registry** (`Map<string, AuditModule<any>>` in `registry.ts`): the set of modules that have scanners and can actually run. Populated at plugin startup. Only Typography is in this map in v0.1.

**Catalog** (`MODULE_CATALOG` in `registry.ts`): the complete list of planned modules, including coming-soon ones. Populated statically. Used by the UI to render the sidebar navigation with appropriate disabled/coming-soon states. The catalog and the runtime registry are intentionally separate — the UI should show that Colors is planned even before it has a scanner.

---

## Module System

### The Contract

```typescript
interface AuditModule<TProperties = Record<string, unknown>> {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string

  scan(
    scope: ScanScope,
    onProgress?: (p: ScanProgress) => void
  ): Promise<AuditItem<TProperties>[]>

  normalize(item: AuditItem<TProperties>): string
  describe(descriptor: TProperties): string
  group(items: AuditItem<TProperties>[]): AuditGroup<TProperties>[]
}
```

Every module implements this interface. The engine never calls anything else on a module. This is the entire public surface area between the engine and any domain.

### The Lifecycle

```
SCAN
  Walk the document for relevant nodes.
  Extract domain-specific properties from each node.
  Return AuditItem<TProperties>[].
  ↓
NORMALIZE
  For each AuditItem, compute a stable string key.
  Items with the same key represent the same style.
  ↓
GROUP
  Bucket items by key.
  Build AuditGroup<TProperties>[] with counts.
  Sort by count descending.
  ↓
DESCRIBE
  For each group's canonical properties, produce a human label.
  ↓
AuditResult<TProperties>
  { moduleId, scope, totalItems, groups, scannedAt, durationMs }
```

### Why Every Module Implements the Same Contract

The UI renders `AuditResult`. It does not care whether the result came from Typography or Colors. The audit table, the inspector panel, the summary cards, the search and sort — all of these work on `AuditGroup[]` regardless of what `TProperties` is.

This means the entire UI is reusable across all modules. The only module-specific UI is the property display inside the inspector (showing font family vs. hex color). That is the correct amount of module-specific UI: a leaf node, not the entire layout.

If every module had its own lifecycle shape, every module would also need its own UI. That multiplies engineering cost by the number of modules.

---

## Scan Engine

### Current Pipeline (v0.1)

```
TRAVERSAL          findTextNodes() — recursive DFS of the node tree
  ↓
EXTRACTION         extractProperties() per TextNode — Figma API calls
  ↓
NORMALIZATION      normalizeTypography() per item — pure string key
  ↓
GROUPING           Map<key, items[]> — single pass
  ↓
SORTING            groups.sort() by count — O(K log K)
  ↓
SERIALIZATION      AuditResult object — structured clone via postMessage
  ↓
UI UPDATE           SCAN_COMPLETE message received, state updated
```

### Why Traversal Should Become Generic

In v0.1, `scanner.ts` does both traversal (walk the tree) and extraction (read font properties). These are separate concerns fused into one function for simplicity. As more modules arrive, each would need its own traversal implementation — which is wasteful and error-prone.

The intended evolution is for traversal to live in the engine with a filter predicate supplied by the module:

```typescript
// Future: engine/traversal.ts
async function traverseNodes<T extends BaseNode>(
  scope: ScanScope,
  predicate: (node: BaseNode) => node is T,
  onProgress?: ProgressCallback
): Promise<T[]>

// Typography provides:
const predicate = (node: BaseNode): node is TextNode => node.type === 'TEXT'

// Colors will provide:
const predicate = (node: BaseNode): node is SceneNode => 'fills' in node
```

The traversal engine handles scope (selection/page/file), `figma.loadAllPagesAsync()`, async yields, progress throttling, and the page-to-node lookup map. Every module gets this for free. The module provides only the predicate that selects its node type.

### Why Scanning Is Read-Only

Refactor's workflow is Scan → Review → Map → Preview → Apply. The Apply step does not exist in v0.1. When it does exist, it will be a separate, explicitly confirmed action on a specific selection of groups.

Scan is a discovery operation. It answers the question "what is here?" without asking "should I change it?" Mixing discovery with modification would mean the user cannot trust that opening the plugin has no side effects. Trust is a precondition for adoption.

### Cancellation

Scanning large files is slow. A scan of a 500K-layer file may take several minutes. The user must be able to cancel at any point without side effects.

Cancellation is implemented via a `scanCancelled` flag in `main.ts`. When the UI sends `CANCEL_SCAN`, the flag is set to true. The extraction loop checks this flag at each async yield point (every ~200 nodes) and stops processing. The scan result is discarded. `SCAN_CANCELLED` is sent to the UI.

This means cancellation latency is bounded by the chunk size: the scan stops within one chunk of processing after the cancel signal arrives — at most a few hundred milliseconds.

As the pipeline becomes more fully chunked (traversal, grouping), every stage becomes a cancellation point. The eventual target is that a cancel response is felt within 200ms regardless of file size.

### Progress Reporting

Progress is reported on a **time-based interval** rather than a node-count interval. The reason: a node-count interval (every 200 nodes) produces message counts proportional to file size. At 500K nodes, that is 2,500 `postMessage` calls during extraction alone — enough to saturate the React render queue and become a performance problem in its own right.

A time-based interval (every 100ms) caps message rate at 10/second regardless of file size. The UI updates at a rate appropriate for human perception. The plugin thread spends less time on messaging overhead.

Yields to the event loop (the `await new Promise(setTimeout)`) continue at the node-count interval for responsiveness. Yielding and reporting are decoupled.

### Why Scanning Never Depends on React

`src/modules/` and `src/plugin/` must not import from `src/ui/`. This is enforced by the dependency graph, not by a linting rule.

The practical reason: the scanner runs in the Figma plugin sandbox. React runs in an iframe. They are separate JavaScript environments that cannot share references. Even if you could import React types into the scanner, you would be importing dead code into a sandboxed context that has no DOM.

The architectural reason: the scanner is infrastructure. Infrastructure should not depend on presentation. If the UI framework changes from React to something else, the scanner must not need to change.

---

## Message Architecture

### The Two Environments

Figma plugins run in two separate JavaScript environments:

**Plugin Sandbox** (`src/plugin/main.ts`): Has access to `figma.*` APIs. Has no DOM. Cannot access `window`, `document`, or any browser APIs. Runs the entire scan pipeline synchronously (with async yields). This environment is the only place Figma's document can be read.

**React Iframe** (`src/ui/`): A standard browser environment. Has DOM. Has `window`. Has no access to `figma.*` APIs. Cannot read the document. Renders UI and responds to user interactions.

Communication between them is exclusively via `postMessage`. There are no shared references, no shared memory, no direct function calls between the two environments.

### Message Protocol

```typescript
// src/shared/messages.ts

// UI → Plugin
type UIToPluginMessage =
  | { type: 'START_SCAN';     payload: { moduleId: string; scope: ScanScope } }
  | { type: 'CANCEL_SCAN' }
  | { type: 'SELECT_NODES';   payload: { nodeIds: string[] } }
  | { type: 'GET_SELECTION_INFO' }
  | { type: 'RESIZE';         payload: { width: number; height: number } }

// Plugin → UI
type PluginToUIMessage =
  | { type: 'SCAN_STARTED';   payload: { moduleId: string; scope: ScanScope } }
  | { type: 'SCAN_PROGRESS';  payload: ScanProgress }
  | { type: 'SCAN_COMPLETE';  payload: AuditResult }
  | { type: 'SCAN_ERROR';     payload: { error: string } }
  | { type: 'SCAN_CANCELLED' }
  | { type: 'SELECTION_INFO'; payload: { count: number; hasSelection: boolean } }
  | { type: 'NODES_SELECTED'; payload: { count: number } }
```

All message types are discriminated unions. The exhaustive switch in each handler ensures that unrecognized message types produce a TypeScript error at compile time, not a silent runtime failure.

### Why Communication Is Event-Driven

The alternative to event-driven messaging is request-response: the UI makes a call and waits for a return value. This is not possible across the plugin sandbox boundary — `postMessage` is fire-and-forget. There is no await on the other side.

Event-driven messaging is therefore not a preference; it is a constraint of the environment. The architecture embraces this:

- The UI sends `START_SCAN` and does not wait. It transitions to a loading state.
- The plugin sends `SCAN_PROGRESS` as it goes. The UI updates the progress bar.
- The plugin sends `SCAN_COMPLETE` when done. The UI transitions to results.

This makes cancellation natural: `CANCEL_SCAN` is an event that travels one-way. The plugin acknowledges with `SCAN_CANCELLED` when it has actually stopped.

### Why Scanning Happens in the Plugin Thread

Only the plugin sandbox has access to `figma.*` APIs. The React iframe does not. There is no choice: scanning must happen in the plugin thread.

This creates the central tension of the architecture: the plugin thread must run the scan without freezing the UI. The resolution is chunked async processing — the scan yields control back to the event loop between chunks, allowing the UI's message handler to run and process user input (including cancel signals) between bursts of work.

---

## UI Architecture

### Application Structure

```
App.tsx
  └─ usePluginMessages()         Wire up inbound message handler
  └─ AppShell
      ├─ Sidebar                 Module navigation
      ├─ Header                  Breadcrumb + contextual actions
      ├─ main                    Page content
      │   ├─ DashboardPage       “What needs cleanup?”
      │   ├─ ScanPage            Scope selection + progress
      │   └─ AuditPage           Results table + inspector
      └─ Toast                   Transient notifications
```

### Why the UI Is a Renderer

The audit result is computed entirely in the plugin sandbox. By the time `SCAN_COMPLETE` arrives in the UI, the result is a plain JSON-serializable object: groups are already sorted, items are already counted, labels are already computed.

The UI's job is to:
1. Display the result faithfully
2. Provide filtering and search (client-side, on the already-received data)
3. Relay user interactions back to the plugin (`SELECT_NODES`, `CANCEL_SCAN`)

It does not re-normalize typography. It does not re-group items. It does not call Figma APIs. It is a read-only view over the serialized result, plus a thin command layer for user actions.

This separation means the UI can be iterated without touching the engine, and the engine can be optimized without touching the UI.

### Component Hierarchy

Components are organized by abstraction level:

**`ui/`** — Primitive, domain-agnostic components: `Button`, `Badge`, `SearchInput`, `Spinner`, `EmptyState`, `Toast`. No knowledge of audits, groups, or typography.

**`audit/`** — Audit-domain components: `SummaryCards`, `AuditTable`, `GroupRow`, `TypographyPreview`. Know about `AuditGroup` but not about specific properties beyond what the group exposes.

**`inspector/`** — Module-specific display: `TypographyInspector`, `PropertyRow`. The only layer that knows about `TypographyProperties` specifically.

**`layout/`** — Chrome: `AppShell`, `Sidebar`, `Header`. Know about navigation state and module catalog but not about audit results.

The dependency flow is: `layout` → `audit` → `inspector` → `ui`. Lower levels never import from higher levels.

---

## State Management

Refactor uses two Zustand stores:

### `useAuditStore` — Scan State

```typescript
interface AuditState {
  isScanning: boolean         // scan in progress
  scanProgress: ScanProgress | null
  scanError: string | null
  result: AuditResult | null  // the complete scan output
  lastModuleId: string
  lastScope: ScanScope | null
}
```

Owns the scan lifecycle. Transitions:
- `startScan()` → `isScanning: true`, sends `START_SCAN` to plugin
- `setScanProgress()` → updates progress bar (called by message hook)
- `setScanResult()` → `isScanning: false`, stores result
- `setScanError()` → `isScanning: false`, stores error

### `useUIStore` — UI State

```typescript
interface UIState {
  currentPage: 'dashboard' | 'scan' | 'audit'
  activeModuleId: string
  selectionCount: number          // from Figma selection
  selectedGroupId: string | null  // which group is inspected
  inspectorOpen: boolean
  expandedGroupIds: Set<string>   // which rows are expanded
  searchQuery: string
  sortField: 'count' | 'family' | 'size'
  sortDirection: 'asc' | 'desc'
  toast: ToastState | null
}
```

Owns all UI interaction state. Does not own any data from the scan.

### Why Two Stores

Scan state and UI state have different lifecycles. Scan state is reset when a new scan starts. UI state (active sort, search query, which groups are expanded) persists across scans and should not be cleared when a new result arrives.

Merging them would require carefully tracking which fields to reset on scan start and which to preserve. Two stores make this obvious: the audit store resets completely on each scan; the UI store never resets automatically.

### What State Lives Where

| State | Location | Reason |
|---|---|---|
| `AuditResult` | `useAuditStore` | Computed by plugin, displayed by UI |
| Scan progress | `useAuditStore` | Driven by plugin messages |
| Current page | `useUIStore` | Pure UI navigation |
| Selected group | `useUIStore` | Pure UI interaction |
| Search query | `useUIStore` | Client-side filter, not recomputed by plugin |
| Selection count | `useUIStore` | From plugin, but UI-facing metadata |
| Sort direction | `useUIStore` | Client-side, applied to received data |

---

## Performance Philosophy

The Figma plugin sandbox is a constrained environment. There are no worker threads. There is no parallelism. Every millisecond of synchronous computation is a millisecond the plugin thread is blocked — during which the UI cannot process messages, the user cannot cancel, and the progress bar does not move.

At 500,000 text layers, an O(n²) algorithm is not slow — it is unusable.

### One Traversal

For a given scan, the document is walked exactly once. All information gathered during traversal is recorded in that single pass. The most common violation of this principle is the per-node page lookup: “where in the document does this node live?” This question must be answered during traversal (O(1) per node using a pre-built Map), not after traversal (O(n²) using `figma.root.findOne()` per node).

### Avoid Repeated Document Searches

`findOne`, `findAll`, and `findAllWithCriteria` traverse the document tree. Calling them inside a per-node loop is O(n²). Any information that requires a document search must be computed once and cached before the per-node loop begins.

### Avoid Redundant API Calls

Every access to a `TextNode` property (`node.fontName`, `node.fontSize`, etc.) is a synchronous IPC call from the plugin sandbox to the Figma main thread. The call is not free. For a non-mixed property, accessing it twice costs twice as much:

```typescript
// O(2) API calls for the non-mixed case:
const fontName = node.fontName === figma.mixed ? ... : node.fontName

// O(1) API calls:
const raw = node.fontName
const fontName = raw === figma.mixed ? ... : raw
```

For 500K nodes × 6 properties, the difference is 3 million fewer IPC round-trips.

### Prefer Streaming Over Collecting

Building a complete intermediate array before processing it costs peak memory proportional to that array's size. For 500K nodes, having both the raw node array and the extracted items array live simultaneously means two O(n) structures in memory before either can be released.

The target architecture processes nodes as they are found: extract, normalize, and bucket in a single pass. The raw node reference can be released as soon as its properties are extracted.

### Avoid O(n²) Algorithms

This is an absolute rule, not a guideline. Every loop over N items must not contain an inner loop or API call that is itself O(N). Any contribution that introduces O(n²) behavior into the scan pipeline is a regression.

### Cache Expensive Computations

Normalization keys are computed once per item. String values that appear across thousands of nodes (font families, page names, parent names) are interned so that identical values share a single JavaScript string object. This reduces GC pressure at scale.

### Throttle UI Updates

Progress messages are sent at most every 100ms. This rate is imperceptible to humans on a progress bar but represents a 10×–100× reduction in message volume compared to node-count-based batching on large files.

### Profile Before Optimizing

The profiler in `main.ts` measures every pipeline stage and prints a breakdown after every scan. No performance claim is accepted without profiler output. The profiler prints time spent in each stage and what percentage of total scan time each stage represents. This makes it immediately obvious which stage to optimize and whether an optimization actually helped.

---

## Scalability

### How to Add a New Module

A contributor adding the Colors module follows exactly the same steps as the Typography module:

1. Create `src/modules/colors/types.ts`:
   ```typescript
   export interface ColorProperties {
     hex: string
     opacity: number
     blendMode: string
   }
   ```

2. Create `src/modules/colors/normalizer.ts`:
   ```typescript
   export function normalizeColor(item: AuditItem<ColorProperties>): string {
     return `${item.properties.hex}|${item.properties.opacity}|${item.properties.blendMode}`
   }
   ```

3. Create `src/modules/colors/scanner.ts`: traverse for nodes with fills, extract color properties.

4. Create `src/modules/colors/index.ts`:
   ```typescript
   export const colorsModule: AuditModule<ColorProperties> = {
     id: 'colors',
     // ...
   }
   ```

5. In `src/plugin/main.ts`, add one line:
   ```typescript
   registerModule(colorsModule)
   ```

6. In `src/engine/registry.ts`, update the Colors entry in `MODULE_CATALOG` from `available: false` to `available: true`.

Step 5 and 6 are the only engine-touching steps, and both are additive — no existing code changes. The audit table, the inspector chrome, the search, the sort, the summary cards, the scan progress UI, the message protocol: none of these change.

### The Scalability Test

For every proposed architectural change, ask: *if we were adding the seventh module today, would this change make it easier or harder?*

If the answer is harder, the change is wrong regardless of its other merits.

---

## Future Evolution

```
v0.1  Typography Audit
        Scan → Review. Read-only. No document changes.
  ↓
v0.2  Typography Mapping
        Add the Map step. Select a style, choose a target variable.
        The engine gains a Mapping data structure. No scan changes.
  ↓
v0.3  Typography Preview
        Add the Preview step. Show before/after diff per layer.
        Read-only Figma API calls to simulate appearance.
  ↓
v0.4  Typography Replace
        Add the Apply step. Explicit confirmation. Batch update.
        First time the scanner writes to the document.
  ↓
v1.0  Colors
        Full audit + replace cycle. Engine unchanged.
        UI audit table reused. Inspector leaf node is new.
  ↓
v1.x  Spacing, Radius, Effects, Variables
        Each follows the same pattern.
  ↓
v2.0  Design Health Dashboard
        Aggregate view across all modules. Health scoring.
        Runs multiple modules in sequence. Engine orchestrates.
```

### Why the Workflow Never Changes

Scan → Review → Map → Preview → Apply is not a Typography workflow. It is a *refactoring* workflow. The same steps apply to any design system property: discover what exists, understand the inconsistencies, map them to standards, verify the changes, apply them.

This is why the engine is designed around this workflow rather than around any specific module. The workflow is stable; the domain changes.

---

## Design Decisions

This section explains why specific decisions were made. Future contributors need this context to extend the system without undermining it.

### Why Modules Are Isolated

If Typography and Colors could import from each other, a change to Typography's normalization could break Colors. Shared logic would accumulate in both modules as each evolves. Testing would require understanding the coupling.

Isolation makes modules independently deployable (one module can ship without the others), independently testable, and independently understandable. The cost is that shared utilities must be extracted to `engine/` or `shared/` deliberately — they cannot be borrowed from a neighbor module. This cost is intentional: it creates pressure to keep shared utilities truly generic.

### Why Normalization Exists

Two text layers that look identical — same font, same size, same line height — are not necessarily equal in Figma's data model. One might have `fontName: { family: 'Inter', style: 'Regular' }` and another the same values with trivially different floating-point precision in letter spacing.

Normalization is the process of reducing raw extracted properties to a canonical form where two visually identical styles produce an identical string key. Without normalization, visually identical typography would appear as multiple groups. With it, they collapse to one.

Normalization is a pure function: same properties in, same key out. This is what makes grouping deterministic.

### Why Grouping Happens After Normalization

Grouping requires a key. The key requires normalization. These are strictly ordered: you cannot group before you normalize because you do not yet know which items belong together.

In the current implementation, normalization and grouping happen in the same pass (a single `for` loop over items). Conceptually they are separate stages; implementationally they can be fused for performance. The architecture names them separately so that the fusion is a recognized optimization, not an accident.

### Why React Is Separated From Scanning

React is a UI library. It manages component state, reconciles DOM trees, and handles events. None of these capabilities are useful in a plugin sandbox that has no DOM.

If the scanner imported React types, it would fail to compile against the plugin's TypeScript configuration (which has no DOM lib). If it somehow ran, the React code would be dead weight in the plugin bundle.

The separation is also architectural: the scanner should be portable. It should be testable without a browser, without a DOM, without React. Importing React would couple it to a presentation concern it has no business knowing about.

### Why Shared Types Exist

The plugin sandbox and the React iframe are separate environments connected by `postMessage`. The data that travels between them must be representable as JSON (or structured clone). The types in `src/shared/` define what that data looks like.

If the types were defined in the plugin and imported by the UI, the UI would depend on the plugin codebase — which must not happen (the plugin runs in a sandboxed context the UI iframe cannot access). If they were defined in the UI and imported by the plugin, the plugin would depend on React-adjacent code. `src/shared/` is the neutral ground that both sides can safely import.

### Why Message Passing Exists

The two-environment constraint (sandbox vs iframe) makes it a necessity, not a preference. But given that constraint, the design choice is whether messages are typed or untyped.

Typed discriminated union messages (`UIToPluginMessage`, `PluginToUIMessage`) mean that a handler with an exhaustive switch will produce a compile-time error if a new message type is added but its handler is forgotten. Untyped messages would produce a silent runtime failure.

The message types live in `src/shared/messages.ts` so that both sides of the boundary see the same definitions. Adding a message type is a single change in one file.

### Why the Engine Owns Orchestration

An alternative design would have each module own its full pipeline: the module scans, groups, serializes, and sends the result directly. This makes each module self-sufficient but creates several problems:

- Profiling must be reimplemented per module.
- Cancellation must be reimplemented per module.
- Progress reporting must be reimplemented per module.
- Serialization must be reimplemented per module.
- Testing the pipeline requires testing each module's version of it.

Engine-owned orchestration centralizes these concerns. The engine handles the envelope; the module provides the content. This is the correct separation of concerns for a system where the envelope is identical across all modules and only the content varies.

---

## Engineering Principles

These are not rules imposed from outside. They are the conclusions that follow from designing a system that must support seven modules, enterprise-scale files, and an evolving feature set without accumulating technical debt.

**Composition over inheritance.** Modules do not extend a base class. They implement an interface. This keeps them independent and eliminates the fragile base class problem.

**Keep modules independent.** A change to Typography must never require a change to Colors. Shared logic belongs in the engine, not in one module imported by another.

**The engine owns orchestration.** Modules do not drive the pipeline. The engine drives the pipeline. Modules respond to the engine's calls. This is inversion of control applied to plugin architecture.

**The UI renders data.** The UI receives `AuditResult` and displays it. It does not compute, derive, or transform the result. Derived views (filtered groups, sorted groups) are computed from the already-received data using client-side operations — never by requesting additional data from the plugin.

**The scanner discovers facts.** The scan pipeline answers questions about the current state of the document. It does not answer questions about what the state *should* be. It has no opinions. It reports what it finds.

**Modules interpret facts.** The normalize function takes a raw set of properties and produces a canonical key. The describe function takes a key and produces a human label. These are interpretations: decisions about what makes two things “the same” and what a group should be called. Interpretation belongs in the module, not the engine.

**Never couple infrastructure to a module.** The traversal engine, the grouper, the profiler, the message handler — none of these know what a `TextNode` is. If they did, they would need to change when Colors ships. Infrastructure that changes when a module changes is not infrastructure; it is a leaky abstraction.

**The architecture should make adding a new module easier than modifying an existing one.** If the cost of adding a new module is lower than the cost of significantly changing Typography, the architecture is correctly configured. If it is higher, the abstractions are not abstract enough.

---

*This document reflects the architecture as of v0.1. As the system evolves, this document evolves with it. Architectural changes that are not reflected here are incomplete.*
