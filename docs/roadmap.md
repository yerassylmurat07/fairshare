# Roadmap and product validation

## Already implemented

A working MVP: identity and teams, projects and weekly milestones, task context, availability/skills, recommendations and atomic approval, task board/help/results, discussions/checklists, resources, and team decisions. Code is organized into modules; PostgreSQL schema, adapters, types, and checks are in the repository.

On October 3, 2026, the MVP was deployed to a VPS with HTTPS, separate PostgreSQL, automatic startup/recovery, tested release rollback, and daily backups with verified restoration. The initial backup was also downloaded to the local computer. Operational commands are documented in the [VPS guide](../deploy/README.md).

## Next stages

| Stage | Outcome | Completion criterion |
| --- | --- | --- |
| Pilot 1, one week | Two teams complete the core workflow | Measure first-step clarity, work starts, and setup time |
| Pilot 2, one to two weeks | Validate recommendation usefulness | Record acceptance, reasons for manual changes, and estimate errors |
| Agreement, one to two weeks | Individual assignment acceptance and handoffs | Members explicitly accept changes to their commitments |
| Peer review, one to two weeks | Authors submit results to reviewers | Keep feedback, corrections, and acceptance with the task |
| Operations, one to two weeks | Readiness for a limited external pilot | Verify email verification/reset, migrations, monitoring, and continued backup restoration |
| Usability, one to two weeks | Templates, search, and notifications | Reduce manual work without mandatory daily forms |

Timelines are preliminary estimates for a team of two or three people, not commitments. Development and research can overlap. Calendar and AI integrations remain later work, as specified in M1.

## Validating the M1 hypotheses

### H1: clear context helps people start work

Participants: two real student teams, four to six students, with voluntary participation. The baseline is a comparable task in their usual chat; the intervention is a three-day milestone with six structured tasks. Members read the goal, first step, and expected deliverable before starting.

“Starting meaningful work” means the first substantive document, draft, or code commit within 48 hours, verified by a researcher. Moving a card to “In progress” alone is insufficient evidence. `first_evidence_at` helps locate when evidence was attached, while its substance and actual creation time are verified separately.

Measurements: time to the first artifact, the number of “where do I start?” questions, coordinator intervention, and members' ability to describe the first step and deliverable in their own words. The PDF's support criteria are that members start within 48 hours, ask noticeably fewer questions, and understand expectations. Additional thresholds can be agreed in advance, such as a 30% relative decrease in questions; this has not been tested and is not a factual result.

If members remain inactive, investigate skills, schedules, dependencies, and motivation separately. The application cannot compel effort.

### H2: recommendations are accepted as a starting agreement

Record how many proposals are shown and approved, manual changes, and explanations for them. Ask which constraints the algorithm considered or missed. A coordinator's click does not prove everyone else's agreement; a brief team interview is needed.

### H3: hour estimates are sufficient for planning

Compare the original estimate with a voluntary final effort estimate and qualitative reasons for discrepancies. Do not introduce mandatory daily timesheets. If underestimation is systematic, add ranges, reserves, and peer review of estimates. `done_at - started_at` measures elapsed calendar time, not actual hours worked.

### Reducing administrative work

Measure the time to connect the first member and create the first understandable task. M1 targets initial onboarding below three minutes. Measure the entire project setup path separately: the three-minute target is not a promise for complete system setup.

## Product metrics

| Metric | Definition | What it does not prove |
| --- | --- | --- |
| Starting-point clarity | Share of members who correctly explain the first step and deliverable | Motivation or completion |
| Start within 48 hours | Share of tasks with a manually verified first artifact | Final result quality |
| Recommendation acceptance | Share of approved proposals and reasons for changes | Whole-team agreement without interviews |
| Timely help | Time between a known obstacle and a help request | Absence of unrecorded obstacles |
| Planned overcommitment | Assignment hours beyond declared availability | Actual overload outside the application |
| User friction | Setup time and repeated actions | Market demand |

Do not fabricate feedback, study results, or metric values. The project currently has educational data and technical verification; a user study has not been conducted.

## Suggested team responsibilities

One member owns UI and accessibility; another owns API/data/domain; a third owns testing, research, documentation, and acceptance. For two people, split the third role. Ownership must not prevent shared review: everyone should be able to explain the product, workload model, and main checks.
