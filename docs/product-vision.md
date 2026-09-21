# FairShare product vision

**Team:** FairShare — Yerassyl Murat, Tursunbekova Suusar, Kamchieva Sezim  
**Primary channel:** Telegram group  
**Vision reviewed:** September 20, 2026

## Problem and evidence

Undergraduate STEM/CS students managing multiple team coursework projects experience recurring workload disparity: one or two students execute most technical deliverables while others remain inactive. Team members have directly observed teammates saying they were unsure how or where to start. The team has not yet isolated task ambiguity from scheduling, motivation, or skill gaps.

Current workarounds include Telegram/WhatsApp chats, Google Docs, and Trello. These tools show status or host discussion but do not provide structured task breakdown or capacity planning.

## What / who / why

- **What:** FairShare is a collaborative web application that decomposes coursework milestones into structured tasks, suggests initial allocations using estimated effort, declared availability, and skills, and tracks progress.
- **Who:** Undergraduate university students managing multi-deliverable team coursework.
- **Why:** Clearer task context and role expectations should help teammates start work, balance planned workloads, and surface blockers before deadlines.

> For university students juggling multiple team projects who struggle with uneven workload distribution and unclear task delegation, FairShare is a student team project coordination workspace that decomposes milestones and suggests capacity-aware task distributions. Unlike unguided boards or chaotic group chats, FairShare helps teams clarify responsibilities, balance planned workloads, and identify blockers early.

## First-version scope

**Main task:** Decompose a project milestone into tasks, review and approve a capacity-based allocation suggestion, and track progress.

**Essential features:**

1. Milestone task decomposition with clear starter context.
2. An allocation suggestion that aims for similar effort-to-availability ratios, subject to skill needs and team approval.
3. A shared progress board with a one-click **Need help** blocker indicator.

**Explicitly excluded for now:** Automated syllabus parsing and calendar meeting sync. These conveniences would distract from validating whether structured task context and planned capacity allocation help teams initiate and balance work.

**Expected dependency:** A cloud database and authentication provider, likely Firebase or Supabase, accessed through standard free-tier APIs and university email credentials. This prototype has no external data dependency.

## Assumptions to test

| Assumption | Why it matters | Evidence now | Confidence |
| --- | --- | --- | --- |
| Structured tasks with explicit initial steps enable teammates to start independently. | If not, task clarity alone cannot improve participation. | Direct observations of teammates wanting to help but not knowing where to start; no controlled test yet. | Medium |
| Teams accept an algorithmic allocation as a fair baseline. | If not, teams will continue assigning work ad hoc and the planning mechanism has little value. | Social hesitation to volunteer has been observed; acceptance of recommendations is unverified. | Medium |
| Students can estimate task effort accurately enough to preserve balance. | Bad estimates create hidden overload and make planned fairness misleading. | Previous projects showed coding tasks were often underestimated. | Low |

## Prototype and verification plan

The riskiest assumption is the first one: does structured task context with assigned capacity reduce time-to-first-contribution and clarification requests to the team leader?

The smallest useful prototype is a low-fidelity interactive representation with six decomposed milestone tasks (goal, starter files, estimated hours) and three member profiles. It deliberately does not build a database, authentication, realtime sync, or notifications.

Test two active student teams (four to six students). Record clarification requests during a comparable task using their usual chat. Then provide structured task cards matched to declared hours for a three-day sprint. Define “starting work” as a first substantive draft or code commit within 48 hours.

Support for the assumption would be independent starts within 48 hours, fewer leader-directed clarification requests than the baseline, and reported clarity of role expectations. If members remain inactive or the leader still needs to explain each task, the team should revise the vision rather than claim the tool solved motivation.

## AI critique and team decisions

The team recorded a Gemini critique on September 20, 2026. The critique highlighted three risks: task cards may lack architectural context, software cannot compel disengaged members, and students may abandon a tool with high onboarding overhead.

| Suggestion | Decision | Verification |
| --- | --- | --- |
| Task cards alone may not provide enough context for inexperienced members. | Accept. A title is not an architectural starting point. | Ask two junior students to explain their first concrete action from a sample card without leader help. |
| The tool cannot prevent disengaged members from remaining passive. | Modify. FairShare should expose blockers early, not promise to create motivation. | During the sprint, check whether stalled work triggers **Need help** within 24 hours. |
| High onboarding overhead will cause teams to abandon the tool. | Accept. | Measure onboarding time with a target under three minutes and interview participants about administrative friction. |

## Repository prototype status

The current `src/` prototype demonstrates the core workflow with representative in-memory data. It is not user evidence and should not be presented as a completed user study. Backend persistence, authentication, allocation algorithms, and formal usability-test instrumentation remain future work after the verification plan produces evidence.

