# Explainable workload allocation

## Inputs and the definition of fairness

Planning covers one week starting on Monday UTC. `capacity(member, week)` is the number of hours the member declares for **all** projects in that week, rather than a separate budget for each project. Missing availability is treated as zero: the application does not invent free time.

`load(member, week)` is the sum of estimates for the member's assigned, unfinished tasks in milestones for that week. Completed task counts, page views, and comments are not used as contribution scores. A blocked task continues to consume planned hours until the team moves or changes it.

The workload ratio is `r = planned_hours / declared_hours`. For example, six out of six hours means full capacity, while six out of twelve means half capacity. Equal absolute hours or card counts would produce a different, less appropriate allocation.

## Implemented MVP algorithm

1. Consider only `planned` tasks in the selected milestone. Work in progress keeps its assignee; completed tasks are excluded.
2. Subtract the existing assignments of those planned tasks from total workload, so recalculating a milestone does not count them twice.
3. Find eligible members for each task: positive availability and the required skill. The “Any skill” category skips the skill check.
4. Sort tasks by the fewest eligible members, then the largest estimate, then UUID. This protects scarce-skill tasks from earlier consumption of the capacity they need.
5. Exclude members who would exceed availability if assigned the entire task. The algorithm cannot partially assign an indivisible task.
6. Choose the smallest projected ratio `(existing_load + task_estimate) / capacity`. Break ties using a stable UUID order.
7. If no member is eligible, leave the task unassigned and explain whether the problem is a missing skill or insufficient hours.
8. Show projected workload and assignment reasons. Save the proposal and input snapshot. Actual assignments remain unchanged until approval.
9. The coordinator approves the recommendation after team discussion. This is not individual digital consent from every member; that mechanism is planned for a later version.

The function is in `server/allocation.ts` and has no database or HTTP dependency. The current straightforward implementation has approximately `O(T × M log M + T log T)` complexity plus linear passes, which is adequate for small teams.

## Example

Yerassyl has 12 hours and Backend/Architecture skills; Suusar has eight hours and Frontend/Testing; Sezim has six hours and Documentation/Databases. Existing work includes five UI hours for Suusar and two presentation hours for Sezim. A four-hour architecture task and six-hour API task fit Yerassyl; a three-hour testing task fits Suusar.

| Member | Existing work | Proposed tasks | Total | Availability |
| --- | --- | --- | --- | --- |
| Yerassyl | 0 | 4 + 6 | 10 | 12 |
| Suusar | 5 | 3 | 8 | 8 |
| Sezim | 2 | 0 | 2 | 6 |

Hours are unequal because skills restrict eligible assignments. The application should not artificially assign Sezim a technical task she has not declared herself able to perform.

## Exceptions and uncertainty

- Pairing, learning support, or splitting tasks could help when skills are missing. These are useful future features. The MVP exposes the issue and leaves the decision to the team.
- Existing overcommitment remains visible; the algorithm does not assign additional tasks beyond available hours.
- Manual assignment can override restrictions only after explicit coordinator confirmation; the exception is recorded in the activity log.
- Hour estimates are unreliable. A later version should add ranges, confidence, team review, and reserves. Declared estimates must not be treated automatically as actual working time.
- Dependencies determine start/completion order, not a precise schedule within the week. The algorithm does not verify critical paths or calendar feasibility.
- A greedy heuristic can leave a task unassigned even when another order would yield a feasible plan. Larger teams could compare it with integer programming or CP-SAT; an optimizer is not implemented.

## Consistency

All assignment changes are approved in a single transaction. External PostgreSQL uses team and member row locks; tasks also carry a `version` in the UI. A proposal signature includes tasks, workloads, hours, and skills. A mismatch returns HTTP 409. Reapproving an approved proposal does not reassign anything.

Tests cover zero availability, missing skills, other-project workload, preservation of work in progress, prevention of double counting, scarce skills, large indivisible tasks, different hours-to-availability ratios, and deterministic results.
