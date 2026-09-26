---
name: porpose-app-architecture
description: >-
  Proposes a fit-for-purpose application architecture from requirements and
  constraints, with trade-offs, boundaries, and a phased adoption path.
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: architecture
  tags: [architecture, propose, design, trade-offs, modular, clean]
  last_updated: "2026-08-03 23:10:00"
  uuid: a7ee7f6c-9ea1-421d-b271-70210a384dbc
---

# Propose App Architecture

## When to use

- User asks to propose, design, or recommend an application architecture
- Greenfield apps, major rewrites, or modularization of a monolith
- After `detect-app-architecture` when the current shape is known and a target is needed
- Exclusions: only detecting current style (`detect-app-architecture`), only listing anti-patterns (`detect-anti-pattern`), implementing features without an architecture ask
- Related: `detect-app-architecture`, `detect-anti-pattern`, `c4-architecture`

## Objective

1. Capture goals, constraints, and non-goals before recommending a style
2. Recommend a primary architecture (and optional secondary) with clear reasons
3. Define module/layer boundaries, dependency rules, and key tech placement
4. Give a phased path from current → target when a codebase already exists

## Workflow

### Step 1: Gather drivers

Ask only for missing critical items (batch questions). Infer from repo/docs when present.

| Driver | Examples |
|--------|----------|
| Goals | Time-to-market, team size, domain complexity, scale, auditability |
| Constraints | .NET version, single DB, on-prem, team skills, existing hosts |
| Workload | CRUD-heavy vs rich domain rules; sync API vs events; batch jobs |
| Quality | Latency, consistency, offline, multi-tenant, compliance |
| Non-goals | “Not microservices yet”, “no new message bus”, etc. |

### Step 2: Assess current state (if brownfield)

- [ ] Run or reuse `detect-app-architecture` verdict
- [ ] Note illegal deps and hotspots that block the target
- [ ] Prefer incremental strangler/modularization over big-bang rewrite unless user demands rewrite

### Step 3: Choose style

Default path (change only when drivers force it):

| Situation | Default proposal |
|-----------|------------------|
| Small/medium modular business API, one team | **Modular monolith** + clear vertical modules |
| Rich domain rules, long-lived system | Modular monolith with **Clean/Hexagonal** inside modules |
| Simple CRUD, tiny team, short life | **Layered** or vertical slices — avoid ceremony |
| Independent scale/deploy/team ownership proven | **Microservices** (only with data ownership story) |
| Heavy async integration | Modular monolith or services + **events** at the edges |

Rules of thumb:

- Prefer **one deployable** until independent deploy/scale is a real requirement
- Prefer **vertical modules** over only technical layers when features grow
- Add CQRS/events only where read/write or integration pain is concrete
- Match team skills — do not propose unfamiliar ceremony without payoff

### Step 4: Specify the design

Document at minimum:

1. **Primary style** + why (3–5 bullets tied to drivers)
2. **Dependency rule** (what may reference what)
3. **Module or layer map** (names + responsibility)
4. **Cross-cutting** (auth, validation, logging, transactions, errors)
5. **Data** (DB ownership, transactions, integration patterns)
6. **Rejected alternatives** (1–2) with why not
7. **Phase plan** (brownfield): extract module → fix deps → optional split

Optional: offer C4 Context/Container via `c4-architecture` if the user wants diagrams.

### Step 5: Deliver proposal

```markdown
# Architecture proposal — <system>

## Drivers
- …

## Recommendation
- Primary: …
- Secondary: …
- Dependency rule: …

## Structure
| Module/Layer | Responsibility | May depend on |
|--------------|----------------|---------------|
| … | … | … |

## Cross-cutting & data
- …

## Trade-offs
- Gains: …
- Costs: …

## Rejected alternatives
- …

## Adoption phases
1. …
```

- Keep proposal implementable; name folders/projects in the repo’s language (.NET projects, etc.)
- Do not start coding the new structure unless the user asks to implement

## Safety rules

1. **Always** tie the recommendation to stated drivers and constraints.
2. **Always** include trade-offs and at least one rejected alternative.
3. **Always** prefer modular monolith over microservices unless independent deploy/scale/ownership is justified.
4. **Never** propose microservices as a default “best practice.”
5. **Never** ignore an existing codebase — detect first when brownfield.
6. **Never** invent requirements; mark assumptions explicitly.
7. **Never** implement a large restructure without explicit user approval.

## Examples

**Example 1:** Greenfield pharmacy distribution API

- Drivers: one team, rich pricing rules, single SQL Server, .NET
- Output: **Modular monolith** with modules `Catalog`, `Pricing`, `Orders`; Clean boundaries inside; shared `BuildingBlocks`; no microservices

**Example 2:** Brownfield “layered” API with god services

- Detect: Layered, fat application services
- Output: Keep one host; carve **vertical modules**; move rules to domain per module; phase: Orders first → strangler the god service

## Additional resources

- Decision cues: [reference.md](reference.md)
