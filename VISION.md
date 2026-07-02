# Refactor — Vision

---

## What Refactor Is

Refactor is a Design System Refactoring Platform.

Not a typography plugin. Not a variable manager. Not a design token editor. Not a cleanup utility you run once and forget.

A platform. One with a clear workflow, a growing set of modules, and a long-term mission: to help designers understand, organize, standardize, migrate, and continuously improve design systems inside Figma.

Typography is the first thing Refactor does. It is not the last. Every decision in the product — the workflow, the architecture, the interface — was made with the full platform in mind, not just the first feature.

---

## The Problem

Design systems degrade. Not quickly, not dramatically — gradually, almost invisibly.

A designer duplicates a text style because the one they need isn’t easy to find. A new component is built with hardcoded values because connecting it to the token would take too long. A color gets defined locally because the shared library hasn’t been updated. Small decisions, made by reasonable people under real time pressure, accumulate over months and years into files that are genuinely difficult to work with.

This is the normal lifecycle of a large Figma file.

At some point, someone looks at the design system and realizes that what was meant to create consistency has become a source of inconsistency. There are forty-seven text styles when there should be twelve. There are six shades of gray that are nearly identical but technically distinct. Spacing values are arbitrary. Variables exist but half the components don’t use them.

The team knows the system needs work. They don’t know where to start. They are afraid to change things they don’t fully understand. They have no way to see the scope of what needs to be done before they begin. And they have no way to verify that what they’ve done has actually improved anything.

So they do nothing, or they do a little, or they start over. None of these outcomes is good.

This is the problem Refactor exists to solve.

---

## Why Refactor Exists

Refactor exists to give designers confidence.

Not confidence to create — Figma is already exceptional at that. Confidence to *improve*. To look at a large, complex, inconsistent file and understand what’s actually in it. To see exactly where the inconsistencies are. To plan a migration without guessing. To make changes without fear.

The goal is not automation. Automation without understanding is how you introduce new problems while fixing old ones. The goal is *trusted* automation: tooling that explains what it found, shows you exactly what it intends to do, and only acts when you confirm.

Trust is not a feature. It is the product.

---

## Product Philosophy

Six principles govern every product decision in Refactor. They are listed in the order they apply.

**Understand before changing.** The first step is always a scan. Refactor looks at the file, reads it completely, and shows you what it found. Nothing changes until after this step is finished and the results are in front of you.

**Measure before recommending.** Refactor does not tell you that you have a problem. It shows you the evidence and lets you decide whether it is a problem. Forty-seven text styles may be intentional. Six near-identical grays may be a legacy decision with a reason. Refactor surfaces the data; you make the judgment.

**Preview before applying.** Before any change touches the document, you see exactly what that change will do. Layer by layer. Before and after. The preview is not a summary. It is specific.

**Explain before automating.** Every recommendation Refactor makes is accompanied by the reasoning behind it. Not “this style is inconsistent” but “this style appears in 47 layers and differs from the nearest matching style by a single decimal point in letter spacing.” The explanation is the product, not a footnote.

**Never surprise the user.** Unexpected behavior destroys trust faster than bugs do. The workflow is predictable. The interface behaves consistently. Actions that cannot be undone require confirmation. There are no automatic changes.

**Never perform destructive actions without explicit confirmation.** This is not a setting. It is not configurable. It is the product.

---

## The Core Workflow

Refactor has one workflow. It does not change. It does not vary by module. It is the same for Typography, for Colors, for Spacing, for Variables, for everything Refactor will ever do.

```
Scan
  ↓
Review
  ↓
Map
  ↓
Preview
  ↓
Apply
```

**Scan** answers: what is here?  
**Review** answers: what does this mean?  
**Map** answers: what should it become?  
**Preview** answers: what will change?  
**Apply** answers: is it done?

The data in each step changes depending on the module. The structure of the workflow does not. A designer who learns this workflow for Typography already knows it for Colors. There is no retraining. There is no relearning. The workflow is the product.

This is not a constraint. It is the design. A workflow that changes per module is a collection of tools. A workflow that stays constant is a platform.

---

## What Refactor Will Become

Refactor is not finished. It is beginning.

Version 0.1 ships Typography Audit: the ability to scan a file, see every text style grouped by visual identity, and understand what you have before you start cleaning. This is the foundation. Everything that follows builds on it.

After Typography: Colors, Spacing, Radius, Effects, Variables. Each module follows the same workflow. Each uses the same engine. Each produces the same kind of audit result, the same kind of group inspector, the same kind of migration interface. The platform grows without fragmenting.

After individual modules: a Design Health view. A single screen that shows the state of every tracked dimension in a design system — how many unique text styles, how many color values, how much spacing variance, what percentage of components use variables. A number that goes up as the design system improves. A view that makes the value of maintenance work visible to people who fund it.

After Health: continuous audits. Refactor runs before a library update is published. It catches regressions. It flags new inconsistencies before they accumulate. It becomes part of how design systems are maintained, not just how they are fixed.

Eventually: Refactor becomes the place a design team opens before making any significant change to a design system. Not because they are required to, but because the alternative — making large changes without understanding the current state — feels reckless by comparison.

---

## Design Principles

The interface should disappear behind the workflow. When the tool is working well, users are thinking about their design system, not about the tool.

**Clarity.** Every number on screen has a meaning. Every label is specific. Vague summaries are replaced with precise counts. “47 layers” not “many layers.” “Inter Regular 16px / 24px” not “a text style.” Precision builds trust.

**Density.** The people who will use Refactor most often are working on large, complex files. They need to see a lot of information at once. The interface is dense because its users are sophisticated. Simplicity at the expense of information is the wrong trade.

**Speed.** The interface responds immediately. Interactions feel instant. A scan that takes thirty seconds to run does not mean the interface takes thirty seconds to respond to a click. Performance in the UI is as important as performance in the scanner.

**Professionalism.** Refactor should feel like the kind of tool that belongs in a senior designer’s toolkit. Not playful. Not decorative. Calm, focused, capable. The visual benchmark is Figma’s own interface, not a consumer product.

**No surprises.** If something is about to happen, the user already knows it is about to happen. If something might take a while, the interface said so before it started. If something cannot be undone, the interface asked first.

---

## Engineering Principles

Product quality and engineering quality are the same thing. A scanner that produces incorrect results is a broken product, regardless of how good the interface looks. An interface that freezes while scanning a large file is a broken product, regardless of how correct the scanner is.

**Correctness before speed.** A result that is fast but wrong destroys trust. There is no acceptable error rate in audit results. If a layer belongs to a group, it must appear in that group. If it does not, that is a bug, not an acceptable approximation.

**Performance before convenience.** Building a scanner that works correctly on a 500-layer file and breaks on a 50,000-layer file is building the wrong thing. Enterprise files are not edge cases. They are the primary use case. Every architecture decision is made against the largest realistic file size.

**Scalability before shortcuts.** The architecture supports seven planned modules without modification. Adding Colors should not require rewriting the engine. Adding Variables should not require rethinking the message protocol. Shortcuts that prevent this are not shortcuts; they are debt.

**Architecture before hacks.** When a new capability requires bending the existing architecture, the question is whether the architecture is right, not whether the hack is acceptable. Hacks compound. Good architecture is self-reinforcing.

Every module should make the platform stronger. A module that only works within its own silo, that requires special-casing elsewhere in the codebase, that cannot be built upon by future contributors — that module has weakened the platform rather than extended it.

---

## User Experience Principles

**Never overwhelm.** A new user opening Refactor for the first time should understand what to do next. The dashboard answers one question: what needs cleanup? The answer is visible immediately.

**Never hide important information.** The inspector shows everything. Font family, weight, size, line height, letter spacing, text case, decoration. The list of affected layers is not truncated. If something matters to the decision, it is on screen.

**Always explain recommendations.** Refactor does not say “you should fix this.” It says “this group has 47 layers using a style that differs from your most common style by 0.02px in letter spacing.” The designer decides what to do with that information.

**Allow inspection of every change.** No batch operation is opaque. Before Apply runs, every affected layer is visible. After Apply runs, there is a record of what changed. The designer can verify the work.

**Support enterprise-scale files.** A file with 300,000 text layers is a real file that real design teams maintain. Refactor must work with it without freezing, without crashing, without producing different results than it would on a smaller file.

**Treat migration as a process, not an event.** Large design system improvements do not happen in one session. Refactor should support a designer who works through a migration over days or weeks: running partial scans, mapping a few styles at a time, reviewing before each apply step. The workflow accommodates the reality of how this work actually gets done.

---

## What Refactor Will Never Become

These boundaries exist to keep Refactor focused. They should be revisited only with strong evidence that a boundary is wrong — not because an opportunity seemed obvious.

**Refactor is not a design editor.** It does not create new layers, new components, or new styles. It operates on what already exists. The moment Refactor starts generating design elements, it becomes a different product with a different mission.

**Refactor is not a replacement for Figma.** It is a companion. It helps designers work better inside Figma. It has no ambition to become the design environment itself.

**Refactor is not an AI design generator.** It does not produce visual outputs from prompts. It audits and migrates existing design systems. The intelligence in Refactor is in its analysis and its workflow, not in generative capabilities.

**Refactor is not a plugin that makes unexplained automatic changes.** Every change Refactor can make is one the designer sees, understands, and explicitly confirms. A plugin that silently modifies a production design file is not a trusted tool. It is a liability.

When a proposed feature conflicts with any of these boundaries, the question is not “how do we fit it in?” It is “why does it belong here?” The answer may exist. But it must be found, not assumed.

---

## Decision Framework

Every feature proposal should pass this test before it is built.

**Does it help designers understand their design system?** Understanding comes before everything. A feature that improves speed without improving understanding is solving the wrong problem.

**Does it reduce inconsistency or make reduction easier?** The core problem is inconsistency. If a feature does not address this directly or indirectly, it is probably outside scope.

**Does it increase trust?** Does it make the designer more confident that the result is correct? More confident that nothing unexpected will happen? More confident that they understand what the tool is doing?

**Does it fit inside Scan → Review → Map → Preview → Apply?** If a proposed feature cannot be mapped to one of these stages, it is either a new stage that the entire product needs to accommodate — which requires significant justification — or it is outside Refactor’s scope.

**Would it work the same way for Typography and Colors and Spacing?** A feature that only makes sense for one module is a module-specific feature, not a platform feature. Module-specific features have a place. But they should not drive architectural decisions.

If the answer to any of these questions is uncertain, the feature is not ready to build.

---

## Roadmap

**Stage 1 — Foundation**  
Typography Audit. Scan, group, review, inspect. The entire platform in one module. The workflow established. The architecture proven.

**Stage 2 — Core Modules**  
Colors, Spacing, Radius, Effects, Variables. Each module extends the platform without changing it. The workflow is the same. The engine is the same. Only the domain differs.

**Stage 3 — Advanced Modules**  
Components, Design Tokens, Asset Consistency. Higher-order concerns that build on the foundation of Stage 2. More complex to scan. More complex to map. The same workflow.

**Stage 4 — Design Health**  
A unified view across all modules. A health score for the design system. Migration reports. Insights across teams and files. The beginning of Refactor as a continuous practice rather than a periodic intervention.

**Stage 5 — The Platform**  
Refactor becomes the operating system for design system maintenance inside Figma. Teams run it before publishing library updates. Organizations use it to understand system health across projects. It is not something designers use occasionally. It is something they depend on.

Each stage builds on the previous one. Nothing in Stage 4 is possible without Stage 2. Nothing in Stage 2 requires redesigning Stage 1. The roadmap is sequential by design.

---

## What Success Looks Like

Refactor succeeds when a senior designer at a large company with a 500,000-layer design system opens it without hesitation, runs a full audit, and trusts the results enough to use them as the basis for a migration that touches thousands of components.

That is a high bar. It requires correctness, performance, and trust all at once. None of these can be compromised for the others.

The more specific version of success:

Designers trust Refactor with their largest production files. They do not run it on a copy first “just to be safe.” They run it on the source because they trust the preview and the confirmation steps.

Large migrations become routine. A task that previously required a senior designer to spend a week manually searching and updating styles takes an afternoon. The quality of the result is higher because the process is systematic rather than manual.

Teams use Refactor before making significant design system changes, not after. It becomes part of the process of maintaining a design system, not a recovery tool for when things have gone wrong.

The design system improves over time rather than degrading. Refactor makes the cost of maintaining consistency lower than the cost of letting it drift.

---

## The Five-Year Picture

Imagine a design team preparing to update their design system’s type scale.

Before writing a single variable, they open Refactor. The first screen they see is a Design Health view: their current system’s state across every dimension — 37 unique text styles in production, 4 that are used fewer than five times, 2 that are within 1px of each other. Colors: 94% bound to variables. Spacing: 78% consistent. Components: 23 with detached overrides.

They click into Typography. They see which styles are used heavily and which are legacy. They map the type scale they want to retire to the new one. They preview the changes across every affected layer. They apply, in batches, with verification at each step.

When they publish the updated library, Refactor confirms that the migration is complete and the system is more consistent than before.

The session took three hours. The equivalent manual process would have taken a week and introduced errors.

That is what Refactor is building toward. Not a better cleanup tool. A practice.

---

## Guiding Principle

> Every feature should make large-scale design system improvements safer, faster, and more understandable — without ever sacrificing user trust.

This sentence should be read before any feature is scoped, any architecture is proposed, and any trade-off is made. If a decision makes Refactor faster but less trustworthy, it is the wrong decision. If it makes Refactor more capable but harder to understand, it is the wrong decision. If it makes Refactor easier to build but less safe, it is the wrong decision.

Safe. Fast. Understandable. In that order. Never at the expense of trust.
