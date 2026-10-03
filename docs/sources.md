# Sources and design decisions

Sources were checked on October 2, 2026. `research/sources.json` records URLs, HTTP statuses, and retrieval times. The research script can retrieve text into `research/*.txt`; those text snapshots are not included in this repository. These checks concern official documentation, rather than user research.

| Source | What was checked | Impact on FairShare |
| --- | --- | --- |
| [React: Creating a React App](https://react.dev/learn/creating-a-react-app) | React recommends frameworks and permits custom setups for appropriate constraints | A Vite SPA was deliberately selected for a private board with a separate API; Next.js remains an alternative |
| [Vite: Guide](https://vite.dev/guide/) | TypeScript/React templates and Node requirements | Reproducible builds and a compatible Node runtime |
| [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) | Row-level locks, FOR UPDATE, and deadlocks | Team and user locks follow a stable order |
| [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | Consistency across concurrent transactions | Snapshot rereading and atomic approval |
| [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny by default and check permissions on every request | The server checks team membership instead of relying on the UI |
| [TanStack Query: Overview](https://tanstack.com/query/latest/docs/framework/react/overview) | Server state, caching, and synchronization | Recommended as the application grows; not integrated in the MVP |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Keyboard use, focus, accessibility, and responsive behavior | Focus traps, visible focus, and mobile layout, without a certification claim |
| [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api) | Schema exposure, grants, and the Data API | If selected as the PostgreSQL provider, server tables must not be exposed to browsers |
| [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | Row-level access policies | Exposed tables require RLS; a separate API does not enable it automatically |
| [Supabase: JWTs](https://supabase.com/docs/guides/auth/jwts) | Token verification and signing keys | A future Identity replacement needs actual JWT verification; the MVP uses server-side sessions |
| [Supabase: Changelog](https://supabase.com/changelog) | Current and breaking changes | Cloud APIs are not assumed to remain unchanged |

The recorded Supabase index reported PostgreSQL minor-version changes dated September 25, 2026, including warnings about reindexing some extensions and legacy-cipher data. The MVP does not use ltree, btree_gist, pgcrypto encryption, or an existing Supabase database; no migration of another project was performed. Signing-key documentation was also checked through official Supabase MCP search.

The NestJS page was retrieved but contained only a short JavaScript placeholder. It was not used as evidence for an architectural choice. Fastify was chosen for the size of the feature modules and simplicity of a small monolith; this is an engineering decision, not the result of a comparative benchmark.

Product boundaries and hypotheses come from the user-supplied PDF, rather than internet sources. The Gemini link in that PDF was not verified; its conclusions were treated as recorded team decisions, not as a new conversation with Gemini.
