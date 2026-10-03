# FairShare

A working MVP for student teams, based on `M1_product_vision_filled.pdf`. The application interface is in Russian. Tasks, accounts, sessions, discussions, and votes are stored in PostgreSQL.

Deployed on a VPS: **https://fairshare.15.235.192.28.sslip.io**. Demo mode is disabled on the server; register your own account. See the [VPS guide](deploy/README.md) for management, deployment, and backup commands.

## Getting started

Requires Node.js 22.12 or later. The original development build was verified on Node.js 24.19.0; the VPS runs Node.js 22.22.1.

```bash
npm ci
npm run build
npm start
```

Open **http://localhost:3000** and select the **Open demo** action in the Russian interface, or register your own team. Embedded PostgreSQL through PGlite automatically creates `.data/postgres`. Local startup requires no Docker, API keys, or cloud account. Data survives restarts. Only one server process may use a given PGlite directory.

For development:

```bash
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:3000. Do not run `start` and `dev` against the same database and port at the same time.

## Implemented features

- Registration, login, logout, and server-side HttpOnly sessions.
- Teams and single-use invitations valid for 24 hours; a user can join multiple teams.
- Multiple projects and weekly milestones, with a user's availability shared across projects.
- Tasks with a goal, first step, expected deliverable, estimated hours, and required skill.
- Allocation proposals, explanations for each assignment, and coordinator approval after team discussion.
- Weekly unfinished workload across all projects; assignments for work in progress remain unchanged.
- A task board, personal tasks, manual assignment with explicit exception confirmation, and dependency cycle protection.
- One-click help requests; completing a task requires a result description or link.
- Task discussions, checklists, shared links, decision proposals, voting, and recorded outcomes.
- An activity log and responsive interface. Team changes refresh every 15 seconds and when the window regains focus.

## Architecture documentation

- [Architecture and technology choices](docs/architecture.md)
- [Extended feature catalog](docs/features.md)
- [Allocation algorithm](docs/allocation.md)
- [Data model and permissions](docs/data-and-security.md)
- [Roadmap and hypothesis validation](docs/roadmap.md)
- [API contract](contracts/openapi.yaml)
- [Sources and design decisions](docs/sources.md)
- [Visual specification](docs/design-system.md)

Diagrams are in `diagrams/`. The executable database schema is `server/schema.sql`.

For a single-document version, use the [PDF](FairShare-architecture.pdf) or the [self-contained HTML](FairShare-architecture.html).

To regenerate the documentation, install the optional Python packages `reportlab` and `PyYAML`, and Graphviz. These tools are not required to run the application.

```bash
python3 tools/create-contract.py
dot -Tsvg diagrams/containers.dot -o diagrams/containers.svg
dot -Tpng diagrams/containers.dot -o diagrams/containers.png
python3 tools/export-docs.py
```

The exporter uses DejaVu Sans fonts from `/usr/share/fonts/truetype/dejavu` by default. Set `FAIRSHARE_FONT_DIR` to a directory containing `DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`, and `DejaVuSans-Oblique.ttf` on other systems.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Tests use a separate in-memory PostgreSQL database and do not change your local data. They cover allocation, the main API lifecycle, team permissions, single-use invitations, conflicts, discussions, checklists, and voting.

Additional checks cover persistence after reopening PostgreSQL, dependency preservation during partial task edits, and allocation invalidation when another project's workload changes. All 10 automated tests passed.

Browser scenarios:

```bash
npm run test:e2e
```

Tests use system Chromium when available, otherwise Playwright's browser. If needed, install it with `npx playwright install chromium`. You can also set `CHROMIUM_PATH`. Tests start a separate in-memory database and local server. They cover the desktop workflow, a second participant joining and voting, and the mobile interface.

All three browser scenarios passed on October 3, 2026. Live VPS checks also verified HTTPS registration, secure sessions, task creation, persistence across restarts and release rollbacks, and backup restoration into a separate PostgreSQL database.

## External PostgreSQL

When `DATABASE_URL` is set, the server automatically uses the `pg` adapter. Supply the connection string through your environment's secret management. Configure TLS as required by your provider, keeping certificate verification enabled. The SQL schema uses standard PostgreSQL constraints; the database must not contain unrelated tables with the same names.

For external hosting, set `NODE_ENV=production`, `ENABLE_DEMO=false`, and `APP_ORIGIN` to the application's exact HTTPS origin. Place the server behind an HTTPS proxy. Production sessions use Secure cookies, and demo login is disabled by default. Local `.env` files are not loaded automatically: provide variables through a process manager or run `node --env-file=.env --import tsx server/index.ts`.

The deployed VPS uses a local PostgreSQL Unix socket with peer authentication, as documented in the [VPS guide](deploy/README.md).

## Current limitations

This MVP is deployed on a VPS with separate PostgreSQL and HTTPS. Login does not verify email ownership; password recovery is not implemented. There is no email delivery, file upload, push notification delivery, or WebSocket synchronization. Voting supports discussion; the coordinator records the final decision manually. A milestone covers one selected week; estimates use 0.25-hour increments. The allocation heuristic does not guarantee a globally optimal plan or eliminate inactivity.

Demo accounts exist only when demo mode is enabled. To test the participant role locally, use `suusar@fairshare.demo` or `sezim@fairshare.demo` with password `FairShare-demo-2026!`. These are educational credentials. Use a separate clean PostgreSQL database and disable demo mode for external hosting.
