import type { AuditModule, ModuleRegistration } from '../shared/types'

// ─────────────────────────────────────────────────────────────
// Module Registry
// The engine is completely decoupled from modules. Modules
// register themselves; the engine discovers them here.
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modules = new Map<string, AuditModule<any>>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerModule(module: AuditModule<any>): void {
  modules.set(module.id, module)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModule(id: string): AuditModule<any> | undefined {
  return modules.get(id)
}

export function getAllModuleIds(): string[] {
  return Array.from(modules.keys())
}

/** Static registrations for future/upcoming modules (UI only — no scanner). */
export const MODULE_CATALOG: ModuleRegistration[] = [
  {
    id: 'typography',
    name: 'Typography',
    description: 'Font families, weights, sizes, line heights, and spacing',
    icon: 'Type',
    available: true,
    comingSoon: false,
  },
  {
    id: 'colors',
    name: 'Colors',
    description: 'Fill and stroke colors across all layers',
    icon: 'Palette',
    available: false,
    comingSoon: true,
  },
  {
    id: 'spacing',
    name: 'Spacing',
    description: 'Padding, gap, and margin inconsistencies',
    icon: 'Space',
    available: false,
    comingSoon: true,
  },
  {
    id: 'radius',
    name: 'Radius',
    description: 'Corner radius values across shapes and frames',
    icon: 'SquareDashedBottom',
    available: false,
    comingSoon: true,
  },
  {
    id: 'effects',
    name: 'Effects',
    description: 'Shadows, blurs, and other visual effects',
    icon: 'Sparkles',
    available: false,
    comingSoon: true,
  },
  {
    id: 'variables',
    name: 'Variables',
    description: 'Unbound values that could reference a variable',
    icon: 'Braces',
    available: false,
    comingSoon: true,
  },
]
