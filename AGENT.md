# AGENT.md — FalconsFind Development Guide

This file is the authoritative behavioral contract for any agent or developer working on this project.
**Never assume. Always read the relevant files first.**

---

## Source of Truth — Always Read Before Acting

Before implementing anything, read the relevant doc(s):

- [`docs/technical-foundation.md`](docs/technical-foundation.md) — architecture, layering rules, domain concepts, lifecycle states, API contracts
- [`docs/design-system.md`](docs/design-system.md) — colors, typography, spacing, components, UX rules

These documents override any assumption. If a decision is not covered here or in those docs, **ask**.

---

## Project Overview

**FalconsFind** is a web-based Lost & Found platform for Fanshawe College.

- Public users (students/visitors) report lost/found items and submit claims — **no account required**
- Campus Security (SECURITY / ADMIN roles) manages the item lifecycle via a secured dashboard
- All authentication uses Firebase Auth with Bearer tokens; only internal users authenticate

**Stack:**
| Layer | Technology |
|---|---|
| Frontend | Angular 21 + TypeScript + TailwindCSS v4 |
| Backend | Node.js + Express 5 + TypeScript |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| Validation | Zod (backend) / Angular Reactive Forms (frontend) |
| Backend Tests | Vitest + Supertest |
| Frontend Tests | Angular TestBed + Vitest (jsdom) |

---

## Core Rules — Non-Negotiable

### 1. Small Steps, Minimal File Touch

- Each implementation touches the **minimum number of files necessary**
- Never refactor or reorganize files that are unrelated to the task
- One feature = one small, reviewable change
- Split large tasks into sequential sub-tasks, each independently verifiable

### 2. File Size Limits

| Side | Hard Limit |
|---|---|
| Backend files (`.ts`) | **250 lines** |
| Frontend files (`.ts`, `.html`) | **350 lines** |

If a file approaches its limit, **split it** — extract a helper, sub-service, or sub-component before adding more code.

### 3. DRY — Don't Repeat Yourself

**Before writing any logic, helper, or component:**

1. Search `backend/src/utils/` for existing helpers
2. Search `backend/src/middleware/` for existing middleware
3. Search `frontend/src/app/shared/` for existing components and utilities
4. Search `frontend/src/app/core/services/` for existing services

If something already exists — **use it**. Do not duplicate.

**Shared reusable locations:**
- Backend helpers → `backend/src/utils/`
- Frontend UI components → `frontend/src/app/shared/components/`
- Frontend form utilities → `frontend/src/app/shared/utils/`
- Frontend core services → `frontend/src/app/core/services/`

### 4. Simplicity Over Complexity

- No premature abstractions
- No helper for one-time use
- No over-engineering: if three simple lines work, use them
- No feature flags, no backwards-compat shims
- No extra config options unless explicitly requested

---

## Architecture Rules

### Backend Layering — Strict

```
routes → controllers/route handlers → services → repositories → firestore
```

| Layer | Responsibility | Forbidden |
|---|---|---|
| `routes/` | HTTP wiring, rate limiting, middleware mounting | Business logic, Firestore calls |
| `services/` | Business rules, state transitions | HTTP objects (req/res), Firestore direct |
| `repositories/` | Firestore read/write isolation | Business logic |
| `schemas/` | Zod input validation schemas | — |
| `middleware/` | Auth, error handling, request guards | — |
| `contracts/` | Types, DTOs, enums shared across layers | — |

**No Firestore calls in controllers or routes.**
**All state transitions (item lifecycle, claim lifecycle) go through services.**
**Centralized error handling via `middleware/error-handler.ts`.**

### Frontend Layering — Angular Modules

```
features/ → core/services/ → shared/components/ + shared/utils/
```

| Directory | Responsibility |
|---|---|
| `features/` | Pages, feature components, feature-scoped services |
| `core/services/` | App-wide services (auth, API clients, error handling) |
| `core/guards/` | Route guards (role-based access) |
| `core/http/` | Interceptors (auth token, error normalization, base URL) |
| `shared/components/` | Reusable UI components (Button, Card, Alert, Input, etc.) |
| `shared/utils/` | Pure utility functions (no Angular dependencies) |
| `models/` | TypeScript types, DTOs, enums mirroring backend contracts |

---

## Domain: Item & Claim Lifecycles

All state transitions are **backend-enforced only**. Frontend never assumes a transition is valid.

**Item lifecycle:**
```
REPORTED → PENDING_VALIDATION → VALIDATED → CLAIMED → RETURNED → ARCHIVED
```

**Claim lifecycle:**
```
PENDING → APPROVED → REJECTED → CANCELLED
```

Claims are only allowed on `VALIDATED` items. The backend enforces this — always.

---

## Security Requirements

### Backend — Every Route

- **Rate limiting is mandatory on every route**, including public ones. Minimum: `express-rate-limit` with a reasonable window (e.g. 15 min / 10 requests for mutations). Use tighter limits on auth routes.
- **All public inputs must be validated with Zod** before touching any service or database.
- **Never trust the frontend.** Re-validate everything server-side regardless of what the client sends.
- **Role enforcement is backend-side only.** `createRequireStaffRoles()` middleware must be applied on every secured route.
- **Sanitize all string inputs:** trim whitespace, reject empty strings where content is required.
- **SQL / NoSQL injection:** never interpolate user input into Firestore queries directly — always use `.where(field, '==', value)` with typed values.
- **File uploads (images):** validate MIME type (`image/jpeg`, `image/png` only), enforce max size in multer config, never trust the `Content-Type` header alone — validate the buffer if needed. Never store uploads locally in production; always use Firebase Storage.
- **XSS:** never return raw user-supplied strings in HTML responses. Backend returns JSON only. No `res.send(userInput)`.
- **Sensitive data in logs:** never log tokens, passwords, Firebase credentials, or full user PII. Log only IDs and action codes.
- **Attack surface:** keep public endpoints to the minimum defined in `technical-foundation.md`. Every new public endpoint increases risk — justify it.
- **CSRF:** the API is stateless (Bearer token only, no cookies with session state), which inherently mitigates CSRF. Do not introduce cookie-based sessions.
- **Signed URLs:** Firebase Storage URLs must be short-lived (max 1 hour). Never expose raw `gs://` URLs to public users.

### Frontend — Every Feature

- **Sanitize and validate all form inputs** with Angular Reactive Forms and custom validators before submission.
- **Never display raw API error messages** to the user — normalize through `ErrorService`.
- **Never expose sensitive tokens** in component state, `console.log`, or templates.
- **Guards are client-side UX only.** Security is enforced server-side. Do not rely on guards as the sole access control.
- **Interceptors:** `AuthTokenInterceptor` must attach the Bearer token for all secured routes. `ApiErrorInterceptor` must normalize errors before they reach components.

---

## Testing Requirements

### The Rule

**No feature is complete without passing tests.** Tests ship with the implementation in the same PR/commit. All tests must pass before a feature is considered done.

### Backend Tests (Vitest)

**Commands:**
```bash
cd backend
npm test              # run all unit tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report
npm run test:ci       # unit + integration
npm run test:integration # integration tests (requires build)
```

**What to test in every service function:**
- Happy path with valid inputs
- Edge cases (empty results, boundary values like page=0, limit=0)
- All domain error classes thrown correctly (e.g. `ReportNotFoundError`, `ReportEditConflictError`)
- State transition guards (e.g. reject editing a VALIDATED report)
- Filter combinations (category + location + date range)

**Test file location:** co-located with the source — `services/foo.service.test.ts` next to `services/foo.service.ts`

**Mocking approach (follow existing pattern in `items.service.test.ts`):**
- Mock Firestore with `vi.fn()` chains mimicking `.collection().where().count()` etc.
- Mock Firebase Storage `bucket` with `vi.fn()` for `file().getSignedUrl()`
- Never import Firebase Admin in unit tests — mock dependencies at the boundary

**Middleware tests:**
- `createRequireStaffRoles` — test: missing token → 401, invalid token → 401, revoked token → 401, wrong role → 403, correct role → calls `next()`

**Schema tests (Zod):**
- Valid input passes
- Missing required fields fail with correct messages
- Invalid types/formats fail (e.g. non-datetime string for date fields)
- `.refine()` constraints (e.g. at least one field provided in PATCH schemas)

### Frontend Tests (Angular TestBed + Vitest)

**Commands:**
```bash
cd frontend
npm test        # Karma/Angular test runner (interactive)
npm run test:ci # headless, single run
```

**What to test in every component:**
- Renders correctly in loading, error, and empty states
- Form validation: required fields, invalid formats, submit blocked when invalid
- Successful submission calls the correct service method
- Error from service is displayed via `AlertComponent`
- Route guards redirect unauthenticated users

**What to test in every service:**
- HTTP calls use the correct verb, URL, and payload
- Responses are mapped to the expected model shape
- Error responses are propagated correctly

**What to test in shared utilities (`shared/utils/`):**
- Pure functions: all branches, edge cases, null/undefined inputs (see `photo-upload.util.spec.ts`)

**Test file location:** co-located — `foo.component.spec.ts` next to `foo.component.ts`

---

## Implementation Checklist

Before marking any task as done, verify:

- [ ] All new backend files are under 250 lines
- [ ] All new frontend files are under 350 lines
- [ ] No logic is duplicated — checked `shared/`, `utils/`, `core/`
- [ ] All new public routes have rate limiting applied
- [ ] All new public inputs are validated with Zod before service calls
- [ ] All new secured routes have `requireStaffUser` middleware applied
- [ ] File uploads validated by type and size
- [ ] No sensitive data logged
- [ ] UI follows design system (colors, spacing, typography, component usage)
- [ ] Every UI state handled: loading, error, empty
- [ ] Unit tests written and passing
- [ ] All existing tests still pass

---

## API Conventions

All endpoints are prefixed with `/api/v1`.

**Standard error response format** (from `contracts/responses/error-response.ts`):
```json
{
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Human-readable message"
  }
}
```

**Standard pagination response format** (from `contracts/responses/pagination.ts`):
```json
{
  "page": 1,
  "limit": 20,
  "total": 100,
  "totalPages": 5,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

Never invent new response shapes. Extend existing DTOs in `backend/src/contracts/dtos/` and mirror them in `frontend/src/app/models/`.

---

## Design System — Frontend Rules

Always follow [`docs/design-system.md`](docs/design-system.md). Key enforced rules:

- **Primary color:** `#B9375D` (buttons, links, active states, focus borders)
- **Hover color:** `#D25D5D`
- **Font:** Inter (system-ui fallback)
- **Spacing:** 8px grid — use `xs=4px, sm=8px, md=16px, lg=24px, xl=32px`
- **Border radius:** inputs/buttons `8px`, cards `12px`
- **Status badges:** use design system status colors only (Success `#4CAF50`, Warning `#FFC107`, Error `#E53935`, Info `#2196F3`)
- **Icons:** Lucide or Heroicons only, stroke style, 20–24px, always paired with a label
- **Blur effects:** modal overlays only (4–8px), never on cards or main content
- **No glassmorphism on cards**

**Existing shared components — always use before creating new:**

| Component | Location | Use for |
|---|---|---|
| `ButtonComponent` | `shared/components/buttons/button.component.ts` | All buttons |
| `CardComponent` | `shared/components/layout/card.component.ts` | Content containers |
| `AlertComponent` | `shared/components/feedback/alert.component.ts` | Errors, success, info messages |
| `InputComponent` | `shared/components/forms/input.component.ts` | Text inputs |
| `SelectComponent` | `shared/components/forms/select.component.ts` | Dropdowns |
| `TextareaComponent` | `shared/components/forms/textarea.component.ts` | Multiline text |
| `FormFieldComponent` | `shared/components/forms/form-field.component.ts` | Form field wrapper |
| `PhotoUploadFieldComponent` | `shared/components/forms/photo-upload-field.component.ts` | Image upload |
| `ReportStepsComponent` | `shared/components/navigation/report-steps.component.ts` | Multi-step form nav |
| `NavbarComponent` | `shared/components/layout/navbar.component.ts` | App navigation |
| `FooterComponent` | `shared/components/layout/footer.component.ts` | App footer |

---

## Out of Scope (Do Not Implement)

Per `technical-foundation.md` — these are explicitly out of scope:

- User-to-user messaging
- Push notifications
- AI-based image recognition
- Native mobile apps
- Multi-campus support
- Integration with Fanshawe internal systems

---

## Git & Branch Conventions

- Branch naming: `feature/<us-id>-<short-description>` (e.g. `feature/us1-1-report-lost-item`)
- Each branch should map to a single user story or a clearly bounded sub-task
- All tests must pass before opening a PR
- At least one teammate review required before merging

---

## Common Pitfalls to Avoid

- Do not call Firestore in a route handler directly — always go through a service
- Do not expose `gs://` storage URLs to public API consumers — resolve to signed URLs
- Do not use `as any` or `as unknown` to bypass type checks — fix the type
- Do not add `console.log` with user data or tokens in committed code
- Do not create a new shared component if an equivalent already exists in `shared/`
- Do not skip rate limiting on "just a GET" public routes — they are still attack surfaces
- Do not validate only on the frontend — every input must be validated on the backend too
- Do not transition item/claim status directly from a route — always call the service layer
- Do not show raw `error.message` from the backend directly in the UI — normalize it
