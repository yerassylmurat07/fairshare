# Features for team collaboration

“Implemented” means available in both the API and interface. Other items describe future development, rather than existing code. This catalog is based on M1 and the additional request for broader team functionality.

## Implemented in the MVP

| Feature | Benefit for the team |
| --- | --- |
| Registration, login, logout, and persistent sessions | Personal permissions and commitments |
| A user's own team and membership in multiple teams | Different study groups in one application |
| Single-use invitations valid for 24 hours | Members can join independently |
| Multiple projects and weekly milestones | Separate courses and intermediate deliverables |
| Task context: goal, first step, deliverable | A clear starting point without repeated coordinator explanations |
| Estimated hours and required skill | A discussable scope and feasible work |
| Weekly personal availability | Accounts for classes and other commitments |
| Self-declared skills | Transparent assignment constraints |
| Shared workload across all projects | The same free hours are not spent several times |
| Explainable allocation proposals | A starting point for discussion |
| Coordinator approval after discussion | The team retains decision-making authority |
| Protection against stale proposals | New tasks and availability changes are considered |
| Manual assignment with exception confirmation | Flexibility with visible overcommitment risk |
| A three-state board | A shared view of progress |
| Personal tasks across all projects | Clear individual commitments |
| Task dependencies and cycle protection | Explicit work order |
| One-click help requests with explanations | Early visibility of obstacles |
| Result links or descriptions | Recorded work outcomes |
| Task-specific discussions | Clarifications stay with the task instead of being lost in chat |
| Shared checklists of concrete steps | Easier task starts and handoffs |
| Shared document and repository links | Resources accessible from the project |
| Team decision proposals | Questions are stated explicitly |
| Yes/no voting and vote changes | One current vote per participant |
| Coordinator-recorded decision outcomes | Agreements remain available |
| Recent activity log | Change context without ranking people |
| Refresh every 15 seconds and on window focus | Visibility of other members' changes |
| Responsive interface and keyboard-accessible dialogs | Mobile use without requiring drag-and-drop |

## P1: day-to-day coordination

| Capability | Scenario | Architectural addition |
| --- | --- | --- |
| Individual assignment acceptance | “Accept” / “Request changes” | `assignment_responses` and a plan activation rule |
| Task handoff with context | A member requests a replacement and shares completed work | `handoff_requests` and recipient consent |
| Pair work | A newcomer works with a mentor | `task_collaborators`, with one accountable owner |
| Peer review | An author submits a result to a reviewer | `review_requests` and an `in_review` state |
| Acceptance criteria | The team agrees on completion in advance | Required acceptance checklist items |
| Estimate ranges and confidence | Account for underestimation risk | `estimate_low/high` and workload scenarios |
| Collaborative estimation | Members estimate independently | `estimate_votes`, median, and spread |
| Hour reserves | Allow for mistakes and learning | `capacity_reserve` |
| Multiple dependencies and a graph | Make delivery chains visible | `task_dependencies` and DAG validation |
| Milestone templates | Repeated labs and presentations | Versioned templates |
| Starting-context templates | Examples for UI, API, tests, and reports | First steps, files, and sample deliverables |
| Search and filters | Filter by person, status, skill, or due date | Pagination, server filters, and full-text search |
| Semester archive | Completed work does not distract from current work | `archived_at` and a history policy |
| Project and milestone editing | Refine names and dates | Version checks and workload recalculation |
| Mentions | Direct requests for help | Membership checks and rate limits |
| Task subscriptions | Follow an important dependency | `task_subscriptions` |
| Notification center | Assignments, replies, and help requests | Notifications, a read cursor, and deduplication |
| Personal reminders | Members choose their own timing | Notification preferences, outbox, and worker |
| Team digest | One summary instead of many messages | Scheduler and channel selection |

## P2: agreements and learning

| Capability | Benefit | Conditions |
| --- | --- | --- |
| Meeting agenda | Questions are ready before discussion | Links to milestones and tasks |
| Meeting outcomes | Conversations become actions | Decisions kept separate from new tasks |
| Meeting-time poll | Choose a convenient slot | Time zones and multiple options |
| Asynchronous check-in | “Done / next / blocked” | Brief and voluntary, without timesheets |
| Risk board | Problems surface before deadlines | Impact, likelihood, and a response owner |
| Critical path | Delaying chains are visible | Actual dependencies and durations |
| Retrospective | Preserve useful experience | One agreed experiment for the next milestone |
| Knowledge base | Examples and decisions stay with the team | Search and ownership of updates |
| Team agreement | Shared expectations about replies and help | Versions and member acceptance |
| Rotation of learning roles | Share coordination and development | Learning roles separate from system permissions |
| Personal learning goals | Feasible tasks for a new skill | Distinguish “want to learn” from “can do” |
| Private availability explanations | Members do not have to disclose reasons to everyone | Total available hours are sufficient for planning |
| Handoff and re-estimation history | Agreements can be reconstructed | Author, reason, and approval |
| Project export | Share the team's result | Authorized data only |
| Read-only mentor | Show progress to an instructor | Limited access and revocable invitations |

## P3: integrations

- GitHub/GitLab: attach results and PR checks; commit counts do not measure quality or contribution.
- Files: private object storage, limits, scanning, and signed URLs.
- Shared deadline calendar, ICS, and calendar synchronization; synchronization is excluded from the first M1 version.
- Telegram/email digests: only after a member explicitly subscribes to a channel.
- PWA, offline reading, and later conflict-safe offline changes.
- AI-generated task breakdown drafts with human review; AI syllabus parsing is excluded from the first M1 version.
- Anonymized product metrics for hypothesis validation, without public student rankings.
- CP-SAT/integer optimization if real data shows that the greedy heuristic is insufficient.

## Product boundary

A full messenger, IDE, automatic code grading, mandatory daily timesheets, public inactivity rankings, and academic grading are outside FairShare's scope. Contextual discussions support task completion; the team's main chat can remain in its existing tool.

Recommended order after the MVP: individual acceptance → handoffs → peer review → notifications → templates. Add complex integrations when demand is observed, so the application does not increase administrative work.
