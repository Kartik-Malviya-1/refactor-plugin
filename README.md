# Refactor

> Design System Refactoring Workspace for Figma — v0.1

Refactor is a Figma plugin that scans your file for design inconsistencies and helps you standardize them progressively. Version 0.1 ships the **Typography Audit** module.

## Workflow

```
Scan → Group → Review → Map → Preview → Apply
```

v0.1 implements through **Review** (scan, group, inspect). Map / Preview / Apply are stubbed as coming soon.

## Tech Stack

- TypeScript · React · Vite
- Figma Plugin API
- Tailwind CSS
- Zustand (state)
- TanStack Virtual (virtualized lists)
- Zod

## Project Structure

```
src/
  shared/          # Core engine types + message protocol
  engine/          # Module registry
  modules/
    typography/    # Reference module implementation
  plugin/          # Figma plugin backend (sandboxed)
  ui/              # React app (iframe)
    store/
    components/
    pages/
dist/
  main.js          # Plugin backend bundle
  ui.html          # Inlined React app
```

## Getting Started

```bash
pnpm install
pnpm run build      # build both plugin + UI
pnpm run dev        # watch mode
pnpm run typecheck  # UI typecheck
pnpm exec tsc --noEmit -p tsconfig.plugin.json  # plugin typecheck
```

## Loading in Figma

1. Clone this repo locally
2. Run `pnpm install && pnpm run build`
3. In Figma Desktop: **Main Menu → Plugins → Development → Import plugin from manifest…**
4. Select `manifest.json` from this folder
5. Run via **Plugins → Development → Refactor**

## Adding a New Module

1. Create `src/modules/your-module/` with `types.ts`, `scanner.ts`, `index.ts`
2. Implement `AuditModule<YourProperties>` from `src/shared/types.ts`
3. Call `registerModule(yourModule)` in `src/plugin/main.ts`
4. Add an entry to `MODULE_CATALOG` in `src/engine/registry.ts`

The engine, UI layout, inspector chrome, and navigation need zero changes.
