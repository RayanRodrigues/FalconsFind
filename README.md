# FalconFind

FalconFind is a campus lost-and-found web platform for Fanshawe College. It replaces a manual, fragmented process with a clear, secure, and student‑friendly experience.

## What problem does it solve?

Lost-and-found workflows on campus are often slow, uncertain, and dependent on in‑person visits or phone calls. Unlike informal lost-and-found processes, FalconFind is operated and validated by Campus Security, ensuring trust, privacy, and operational control.

## Who is it for?

- Students, staff, and visitors who need to report lost or found items
- Campus Security, who validate items and manage the recovery process

## How it works

- A user submits a lost or found report with key details and an optional photo
- Campus Security reviews and validates found items
- Once validated, items are published for public browsing
- Claims are submitted and processed until the item is returned

## Where to find details

- Technical foundation and architecture: `docs/technical-foundation.md`
- Design system and UI standards: `docs/design-system.md`
- Product backlog: managed via project board (to be published)

## Issue Prefixes

| Prefix | Meaning |
| --- | --- |
| US | User Story |
| TECH | Technical infrastructure |
| QA | Testing / Quality |
| CI | Continuous Integration |
| DOC | Documentation / Swagger |

## Run the app

```bash
# install all dependencies (root, frontend, backend)
npm run install:all

# run frontend + backend in parallel
npm run dev

# run frontend only
npm run dev:front

# run backend only
npm run dev:back

# build both apps
npm run build

# lint both apps
npm run lint

# format the repo
npm run format
```

## Project status

Academic project in active development.
