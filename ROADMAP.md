# Refactor — Product Roadmap

Updated after v0.2.3 platform simplification.

---

## Canonical Platform Architecture

```
Scan Engine
    │
    ▼
AuditItem<T>          ← what was discovered
    │
    ▼
Query Builder         ← user defines what to work on
    │
    ▼
WorkingSet<T>         ← the active dataset
    │
    ▼
Selection<T>          ← user picks which items to act on
    │
    ▼
Assignment            ← user assigns a target (hero action)
    │
    ▼
Mapping<T>            ← internal record of intent
    │
    ▼
Preview               ← deterministic before/after
    │
    ▼
Apply                 ← safe execution
```

**Key principle (v0.2.3):** The Working Set IS the cluster.
No intermediate clustering engine between Working Set and Assignment.
The designer decides which signatures belong together —
the plugin helps execute that decision.

---

## Module workflow (Typography and all future modules)

```
Scan → Audit → Query Builder → Working Set
→ Select Signatures → Assign Target
→ Preview → Apply
```

The same five reusable concepts apply to every module:
- `NodeLocation` — where something exists
- `AuditItem<T>` — what was discovered
- `WorkingSet<T>` — the current dataset
- `Selection<T>` — what the user chose
- `Mapping<T>` — what it should become

---

## Version Map

| Version | Feature |
|---------|--------|
| v0.1.x  | Scan, Typography Audit, Sources, Profiler |
| v0.1.1  | Core Scan Engine, performance optimisations |
| v0.1.2  | Source classification (TypographySource model) |
| v0.1.3  | Similarity Engine, Candidate Families |
| v0.1.4  | Design System Planning, Migration Plan model |
| v0.1.5  | Smart Suggestions, Bulk Planning |
| v0.1.6  | Migration Preview, Impact Analysis |
| v0.1.7  | Migration Simulation |
| v0.2.0  | Typography IA redesign (module-level nav) |
| v0.2.1  | Source detection fix, Usage Explorer |
| v0.2.2  | Query Builder, Working Set, partition-first clustering |
| **v0.2.3** | **Remove clustering layer, Working Set = cluster** |
| v0.3    | Preview, Validation, Impact Analysis |
| v0.4    | Safe Apply, Rollback, Verification |
| v1.0    | Colors module |
| v1.x    | Spacing, Radius, Effects, Variables |
| v2.0    | Design System Health Dashboard |
