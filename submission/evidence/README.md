# Midterm evidence

Files referenced in the team midterm report (tag `midterm-v1`). All runs are from October 24, 2026.

| File | What it shows | Report section |
| --- | --- | --- |
| `tests.txt` | `npm test`: 16 unit and API tests, all passed | 3, 5, 6 |
| `e2e.txt` | `npx playwright test`: 6 browser scenarios (desktop and mobile), all passed | 3, 5 |
| `typecheck.txt`, `build.txt` | Type check and production build succeeded | 5 |
| `live-checks.txt` | Live site: health check, security headers, foreign-origin request rejected, port 3000 closed from outside | 6 |
| `vps-service.txt` | The app runs as a systemd service listening on 127.0.0.1 only | 4, 6 |
| `user-feedback.md` | Answers from a two-student walkthrough (member and coordinator) | 1, 5 |
| `01-login.png`, `02-board.png`, `03-allocation.png` | Screenshots with demo data (names, hours and skills are made up for the demo) | 5, appendix |

The structure diagram is `../structure.png` (source `../structure.dot`).
