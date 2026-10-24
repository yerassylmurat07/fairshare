# AI usage

Team FairShare (ISE4133, Fall 2026): Yerassyl Murat, Tursunbekova Suusar, Kamchieva Sezim.

## Where we used AI

| Area | Tool | What it did | How we checked it |
| --- | --- | --- | --- |
| Product vision critique (M1) | Gemini, 20 Sep 2026 | Critiqued our vision and assumptions. Prompt, output and our accept/modify decisions are recorded in the M1 document. | Team discussion; each suggestion was accepted, modified or turned into a verification action. |
| Code review | Claude Code (Anthropic) | Read the code Yerassyl wrote and pointed out possible bugs, missing checks and edge cases. | A suggestion was kept only if we understood it and `npm run typecheck`, `npm test` and the Playwright scenarios still passed. |
| Deployment to the VPS | Claude Code | Helped prepare the server setup: Nginx HTTPS proxy, PostgreSQL, systemd and later the Docker/Coolify build, backups and hardening steps. | We checked the live site ourselves: `/api/health`, HTTPS registration, cookie flags, restart and rollback, and a backup restored into a separate database. |
| Visualization and design (small part) | Claude Code | Helped with diagram layout (Graphviz) and a few interface styling details. | Visual review in the browser on desktop and mobile; the mobile e2e scenario passes. |
| Midterm report | Claude Code | Helped with writing and formatting the midterm report. | We checked every claim against the code, test logs and the live server, and edited the text ourselves. |

## What AI did not do

- The application code, architecture and product decisions are our own.
- AI output is not used as user evidence. We have not run the user pilot yet, and no feedback or study results are claimed.
- The app itself has no AI features and sends no data to AI services.

## Verification record

On 24 October 2026: `npm run typecheck` passed, `npm test` 16/16 passed, `npx playwright test` 6/6 passed, `npm run build` succeeded. Logs are in `submission/evidence/`. The live container on the VPS is built from commit `2c2d601`.
