# AI usage

Team FairShare (ISE4133, Fall 2026): Yerassyl Murat, Tursunbekova Suusar, Kamchieva Sezim.

## Where we used AI

| Area | Tool | What it did | How we checked it |
| --- | --- | --- | --- |
| Product vision critique (M1) | Gemini, 20 Sep 2026 | Critiqued our vision and assumptions. Prompt, output and our accept/modify decisions are recorded in the M1 document. | Team discussion; each suggestion was accepted, modified or turned into a verification action. |
| Help with code | Claude Code (Anthropic) | Used as a tool to help with the code: reviewing it, pointing out bugs and missing checks, and suggesting changes. | A change was kept only if we understood it and `npm run typecheck`, `npm test` and the Playwright scenarios still passed. |
| Deployment to the VPS | Claude Code | Helped prepare the server setup: Nginx HTTPS proxy, PostgreSQL, the systemd service and deploy script, backups and hardening steps. | We checked the live site ourselves: `/api/health`, HTTPS registration, cookie flags, restart and rollback, and a backup restored into a separate database. |
| Visualization and design (small part) | Claude Code | Helped with diagram layout (Graphviz) and a few interface styling details. | Visual review in the browser on desktop and mobile; the mobile e2e scenario passes. |
| Midterm report | Claude Code | Helped with writing and formatting the midterm report. | We checked every claim against the code, test logs and the live server, and edited the text ourselves. |

## What AI did not do

- The architecture and product decisions are our own. AI was a tool for help with code; we reviewed and tested every change ourselves.
- AI output is not used as user evidence. The only user feedback in the report is from two students who tried the app (`submission/evidence/user-feedback.md`). The pilot study has not been run yet.
- The app itself has no AI features and sends no data to AI services.

## Verification record

On 24 October 2026: `npm run typecheck` passed, `npm test` 16/16 passed, `npx playwright test` 6/6 passed, `npm run build` succeeded. Logs are in `submission/evidence/`. The live VPS release is a systemd service deployed with `deploy/push.sh`; the server ran the same 16 tests before activating it.
