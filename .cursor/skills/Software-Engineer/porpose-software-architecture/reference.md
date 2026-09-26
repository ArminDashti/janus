# Architecture proposal cues

## Prefer modular monolith when

- One product team (or few) owns the system
- Consistency and simple transactions matter
- Ops cost of many services is not justified
- Domain has several features but shared release cadence is fine

## Prefer Clean/Hexagonal inside modules when

- Business invariants are non-trivial and must be protected
- Multiple adapters expected (HTTP, jobs, messaging)
- Testability of core rules without web/DB is valuable

## Prefer simple layered / vertical slice when

- Mostly CRUD and mappings
- Small codebase / short horizon
- Ceremony would slow delivery more than it helps

## Consider microservices only when

- Independent deploy cadence is required
- Scale profiles differ sharply by capability
- Team ownership boundaries are real and stable
- Data ownership can be split (no shared “integration database” by default)

## Eventing

- Use for integration and decoupling, not as a substitute for module boundaries
- Start with in-process domain events; introduce a broker when cross-process is required

## Common mistakes to avoid in proposals

- Renaming folders to Domain/Infrastructure without a dependency rule
- “Distributed monolith”: many services, one DB, sync chatty calls
- CQRS everywhere on day one
- Copying a reference architecture that does not match team size
