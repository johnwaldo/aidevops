# FSD Quick Reference

> **Sources:** [Tutorial](https://feature-sliced.design/docs/get-started/tutorial) | [Layers](https://feature-sliced.design/docs/reference/layers) | [Slices & Segments](https://feature-sliced.design/docs/reference/slices-segments)
> **Deep dives:** [LAYERS.md](LAYERS.md) | [PUBLIC-API.md](PUBLIC-API.md) | [IMPLEMENTATION.md](IMPLEMENTATION.md) | [NEXTJS.md](NEXTJS.md) | [MIGRATION.md](MIGRATION.md)

## Layer Hierarchy

```
app/      → Providers, routing, global styles       [NO slices, REQUIRED]
pages/    → Route screens, one slice per route      [HAS slices, REQUIRED]
widgets/  → Complex reusable UI blocks              [HAS slices, optional]
features/ → User interactions with business value   [HAS slices, optional]
entities/ → Business domain models                  [HAS slices, optional]
shared/   → Project-agnostic infrastructure         [NO slices, REQUIRED]
```

**Import Rule:** Only import from layers BELOW. Never sideways or up.

---

## Import Matrix

|  | app | pages | widgets | features | entities | shared |
|--|-----|-------|---------|----------|----------|--------|
| **app** | - | yes | yes | yes | yes | yes |
| **pages** | no | no | yes | yes | yes | yes |
| **widgets** | no | no | no | yes | yes | yes |
| **features** | no | no | no | no | yes | yes |
| **entities** | no | no | no | no | @x* | yes |
| **shared** | no | no | no | no | no | yes |

*Cross-entity refs use `@x` notation — see [LAYERS.md](LAYERS.md) "entities" section.

---

## "Where does this code go?"

```
├─ App-wide config, providers, routing    → app/
├─ Full page / route component            → pages/
├─ Complex reusable UI block              → widgets/
├─ User action with business value        → features/
├─ Business domain object (data model)    → entities/
└─ Reusable, domain-agnostic code         → shared/
```

### Feature or Entity?

| Entity (noun) | Feature (verb) |
|---------------|----------------|
| `user` | `auth` (login/logout) |
| `product` | `add-to-cart` |
| `comment` | `write-comment` |
| `order` | `checkout` |

**Entities:** THINGS with identity, displayed in lists.
**Features:** ACTIONS with side effects, triggered by user.

---

## Segments

| Segment | Purpose | Examples |
|---------|---------|----------|
| `ui/` | Components, styles | `UserCard.tsx`, `Button.tsx` |
| `api/` | Backend calls, DTOs | `getUser()`, `createOrder()` |
| `model/` | Types, schemas, stores | `User`, `userSchema`, `useUserStore` |
| `lib/` | Slice utilities | `formatUserName()` |
| `config/` | Configuration | Feature flags, constants |

**Naming:** Use purpose-driven names (`api/`, `model/`) not essence-based (`hooks/`, `types/`).

---

## File Structure & Public API

Full structure templates for every layer: [LAYERS.md](LAYERS.md).
Complete entity/feature implementation patterns: [IMPLEMENTATION.md](IMPLEMENTATION.md).
Public API barrel file rules and anti-patterns: [PUBLIC-API.md](PUBLIC-API.md).

**Key rule — import from public API only:**

```typescript
// Good
import { UserCard, type User } from '@/entities/user';

// Bad — bypasses public API
import { UserCard } from '@/entities/user/ui/UserCard';
```

---

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Import from higher layer | Import from lower layers only |
| Cross-slice import (same layer) | Use lower layer or @x |
| Generic segments: `components/`, `hooks/` | Purpose segments: `ui/`, `lib/` |
| Wildcard exports: `export *` | Explicit exports |
| Business logic in `shared/` | Keep shared domain-agnostic |
| Single-use widgets | Keep in page slice |
| Everything is a feature | Only reused interactions |
| Import from internal paths | Always use `index.ts` |

---

## Minimal FSD Setup

Start small, add layers as needed:

```
src/
├── app/
├── pages/
└── shared/
```

Add `entities/`, `features/`, `widgets/` when complexity grows.

---

## Resources

| Resource | Link |
|----------|------|
| Official Docs | [feature-sliced.design](https://feature-sliced.design) |
| Examples | [feature-sliced/examples](https://github.com/feature-sliced/examples) |
| Awesome FSD | [feature-sliced/awesome](https://github.com/feature-sliced/awesome) |
| v2.1 Notes | [Pages Come First!](https://github.com/feature-sliced/documentation/releases/tag/v2.1) |
