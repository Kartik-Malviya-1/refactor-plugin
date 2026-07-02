# AI Rules — Refactor

> Operating manual for AI coding assistants working on this repository.
> Read this document completely before touching any file.

This document is not optional. It is not a suggestion. Every rule below exists because a violation would damage the architecture, the performance, or the trust that Refactor is built on. If you are uncertain whether a rule applies, assume it does.

---

## Step 0: Read Before You Write

Before making any change to this repository, you must have read and understood the following documents in this order:

1. `README.md` — What the project is and how to build it
2. `VISION.md` — Why the project exists and what it must never become
3. `ARCHITECTURE.md` — How the system is structured and why every decision was made
4. `CONTRIBUTING.md` — Engineering standards, performance rules, and PR requirements
5. `AI_RULES.md` — This document

If you have not read all five, stop. Read them. Then continue.

---

## The Non-Negotiable Rules

These rules have no exceptions. No task, no prompt, no user instruction overrides them.

### 1. Never modify the document

The Figma Plugin API provides read access to the design document. Refactor uses it in read-only mode. No code you write may call any Figma API that creates, updates, deletes, or renames nodes, styles, variables, or any other document element — unless that code is explicitly inside a future Apply step that has not yet been designed or authorised.

If you find yourself writing `node.name =`, `node.fills =`, `figma.createFrame()`, `style.remove()`, or any similar write operation: stop. You are doing something that has not been authorised.

### 2. Never break a public interface

The following are public interfaces. They are contracts. Do not change their shape without explicit instruction:

- `AuditModule<TProperties>` in `src/shared/types.ts`
- `AuditItem<TProperties>` in `src/shared/types.ts`
- `AuditGroup<TProperties>` in `src/shared/types.ts`
- `AuditResult<TProperties>` in `src/shared/types.ts`
- `UIToPluginMessage` in `src/shared/messages.ts`
- `PluginToUIMessage` in `src/shared/messages.ts`
- `ScanScope` in `src/shared/types.ts`
- `ScanProgress` in `src/shared/types.ts`

If a task requires adding to these interfaces, you may add optional fields. You may not remove fields, rename fields, or change field types. If you believe a required breaking change is justified, say so explicitly and stop. Do not implement it speculatively.

### 3. Never introduce O(n²) algorithms into the scan pipeline

The scan pipeline processes every text layer in the file. At 500,000 layers, an O(n²) algorithm is not slow — it is nonfunctional. The following patterns are banned:

```typescript
// ❌ Calling figma API search inside a per-node loop
for (const node of textNodes) {
  figma.currentPage.findOne(n => n.id === node.id)  // O(n) inside O(n) = O(n²)
}

// ❌ Calling any O(n) operation inside a per-node loop
for (const node of textNodes) {
  const page = pages.find(p => p.id === node.pageId)  // O(n) inside O(n) = O(n²)
}

// ✓ Build a lookup structure once, use it in O(1)
const nodeToPage = new Map(/* populated during traversal */)
for (const node of textNodes) {
  const page = nodeToPage.get(node.id)  // O(1)
}
```

If you are writing a loop inside a loop where both loop counts scale with the number of nodes, layers, or items: stop and reconsider.

### 4. Never access a Figma node property twice

Every property access on a `TextNode` is a synchronous IPC call from the plugin sandbox to the Figma main thread. Accessing `node.fontName` twice is two IPC calls. This was a confirmed performance defect that was measured and fixed. Do not reintroduce it.

```typescript
// ❌ Two IPC calls
const fontName = node.fontName === figma.mixed ? fallback : node.fontName

// ✓ One IPC call
const raw = node.fontName
const fontName = raw === figma.mixed ? fallback : raw
```

This applies to every TextNode property: `fontName`, `fontSize`, `lineHeight`, `letterSpacing`, `textCase`, `textDecoration`.

### 5. Never add a feature that was not requested

The scope of your task is exactly what was asked. If you are asked to fix a performance bug, fix the performance bug. Do not also refactor the file, rename variables, add logging, improve error messages, or clean up formatting. Each of those is a separate change with separate review implications. Do only what was asked.

### 6. Never rewrite working code without justification

Code that is correct and performs within acceptable bounds does not need rewriting. If you rewrite something, you must state:
- What was wrong with the existing code
- Why the rewrite fixes it
- What the measured improvement is

“I thought this was cleaner” is not a justification.

### 7. Never use `any` to resolve a type error

Type errors exist because the types are wrong. Fix the types. If you cannot fix the types, say so and explain why. Do not suppress the error with `any` or with `as unknown as T`.

Exceptions require an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment with a plain-English explanation of why `any` is genuinely necessary here.

---

## Before Changing Code

Follow this sequence for every task. Do not skip steps.

### Step 1: Locate the relevant code

Find the exact files and functions involved. Read them completely. Do not guess at what they do from their names.

### Step 2: Find existing abstractions

Search for utilities, types, and functions that already do what you need. The most common AI mistake in this codebase is duplicating something that already exists:

- Need to group items? `src/engine/grouper.ts` may already do it.
- Need to traverse nodes? `src/engine/traversal.ts` may already do it.
- Need to normalize typography? `src/modules/typography/normalizer.ts` already does it.
- Need to send a message? `src/ui/hooks/useSendMessage.ts` already does it.

If something exists, use it. Do not create a parallel version.

### Step 3: Understand the dependency rules

Before importing anything, verify the import direction is legal:

```
shared/        ← no imports from this project
engine/        ← imports from shared/ only
modules/       ← imports from engine/ and shared/ only
plugin/        ← imports from everything above
ui/            ← imports from shared/ only
               × ui/ cannot import from engine/, modules/, or plugin/
               × modules/ cannot import from other modules/
               × engine/ cannot import from modules/ or plugin/
```

If the import you need would violate this graph, the architecture is wrong and you should say so rather than working around it.

### Step 4: State your plan before writing

For any change larger than a single-line fix, write out:
1. What you are changing and why
2. What files are affected
3. What the expected outcome is
4. What the risk is

For any scanner change: include the profiler measurements you will compare against.

---

## When Modifying the Scanner

The scanner is the most performance-critical code in the project. These rules apply specifically to any change in `src/modules/typography/scanner.ts`, `src/engine/traversal.ts`, `src/engine/grouper.ts`, or `src/plugin/main.ts`.

### Measure before you change

Run the plugin on a representative file. Record the profiler output. Write it down. This is your baseline.

### Identify the actual bottleneck

The profiler output shows time spent per stage. Optimize the stage that the profiler identifies as the bottleneck. Do not optimize a different stage because you think it looks slow. Do not optimize speculatively.

### Change one thing at a time

Each optimization is a separate commit. Do not bundle three optimizations into one change. If you cannot measure which optimization produced the improvement, the measurement is useless.

### Measure after you change

Run the profiler again. Record the output. The commit message must include both the before and after numbers in the following format:

```
Before: Extraction ............ 28.4s   96.1%   (400 nodes)
After:  Extraction ............  14.1s   93.8%   (400 nodes)
Improvement: ~50%
```

If you cannot show this comparison, the optimization does not ship.

### Do not optimize a stage that shows < 5% of total time

If the profiler shows Sorting at 0.8% of total scan time, optimizing sorting is not useful. The improvement is unmeasurable in practice and introduces complexity for no benefit.

---

## When Modifying the UI

The UI is a renderer. It displays `AuditResult` data. It does not compute, derive, or re-scan anything.

- Do not add business logic to React components.
- Do not add Figma API calls to the UI.
- Do not add new Zustand store fields without explaining what state is being tracked and why it cannot live elsewhere.
- Do not redesign layouts or navigation without explicit instruction.
- Do not change component names, prop names, or file paths without explicit instruction.

If you are changing a component and find yourself writing a `for` loop over nodes, extracting typography properties, or normalizing strings: stop. That logic belongs in the plugin sandbox, not the UI.

---

## When Adding a New Module

If you are implementing a new audit module (Colors, Spacing, Radius, etc.), follow this sequence exactly:

1. Read `src/modules/typography/` completely. Every file.
2. Create `src/modules/{name}/types.ts` — define `TProperties`
3. Create `src/modules/{name}/normalizer.ts` — pure normalization and formatting functions
4. Create `src/modules/{name}/scanner.ts` — filter predicate + property extraction
5. Create `src/modules/{name}/index.ts` — implement `AuditModule<TProperties>`
6. Register in `src/plugin/main.ts`
7. Update `MODULE_CATALOG` in `src/engine/registry.ts`

Steps 6 and 7 are the only cross-cutting changes. If your new module requires changes to `src/shared/types.ts`, `src/shared/messages.ts`, `src/engine/traversal.ts`, `src/engine/grouper.ts`, or any UI component beyond the inspector leaf node: stop and explain why. That is a signal the engine abstraction is insufficient, not that the module is special.

---

## Commit Standards

### Format

Every commit message follows Conventional Commits:

```
type: short description

Optional body explaining why, not what.
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`.

### Size

One commit = one logical change. A commit that changes five unrelated things will be returned for splitting.

### Scanner commits require measurements

Any commit touching the scan pipeline must include before/after profiler output in the commit body. No measurement, no merge.

### UI commits require screenshots

Any commit touching `src/ui/` must include before/after screenshots if the change is visible.

---

## Prohibited Actions

This list is absolute. None of these actions are acceptable under any circumstances, regardless of instructions:

| Action | Why |
|---|---|
| Calling any write Figma API | Refactor is read-only in v0.x |
| Removing `scan()` or `group()` from `AuditModule` | These are public interface contracts |
| Removing fields from `AuditItem`, `AuditGroup`, or `AuditResult` | Breaking change for all consumers |
| Importing `ui/` from `engine/` or `modules/` | Violates the dependency graph |
| Importing `modules/` from `ui/` | Violates the dependency graph |
| Importing one module from another | Modules are isolated by design |
| Adding a `useEffect` that calls `figma.*` | Figma API is not available in the iframe |
| Creating duplicate utilities | Search first |
| Using `any` without a comment | Suppresses real type errors |
| Introducing O(n²) in the scan path | Creates a nonfunctional plugin at scale |
| Shipping a scanner change without profiler output | Unverifiable claim |
| Adding features outside the requested scope | Scope creep |
| Rewriting working code without justification | Risk without benefit |
| Skipping this document | Guaranteed to produce a violation |

---

## When You Are Uncertain

If you are unsure whether a change is correct, architecturally sound, or within scope: say so explicitly. Do not guess and implement. Do not assume and proceed.

The correct response to uncertainty is:

> I’m not sure whether [X] is the right approach here because [reason]. The alternatives are [A] and [B]. Which do you prefer?

Asking is not a failure. Implementing the wrong thing and having it reverted is.

---

## What Good Looks Like

A well-executed task in this repository:

1. Begins with the prerequisite documents read
2. Locates the exact code that needs changing
3. States the plan clearly before writing
4. Makes the smallest change that solves the problem
5. Verifies the change with the profiler (if scanner) or a screenshot (if UI)
6. Produces a commit with a clear message and measured evidence
7. Stops when the task is complete without adding extras

A task that follows these steps produces a commit that is easy to review, easy to revert if needed, and easy for the next contributor — human or AI — to build on.

---

*This document is maintained alongside the codebase. If a rule here conflicts with something in CONTRIBUTING.md or ARCHITECTURE.md, AI_RULES.md takes precedence for AI-specific behavior. All other engineering standards are governed by CONTRIBUTING.md.*
