# FairShare

FairShare is a student team project coordination workspace for turning coursework milestones into clear tasks, balancing planned effort against availability, and surfacing blockers early.

This repository contains the first interactive product prototype for the ISE4133 Software Engineering project. It is intentionally a frontend-only prototype: the team is validating whether structured task context and capacity-aware planning help students start work independently before committing to authentication, realtime sync, or a production allocation service.

## MVP flow

1. Review a milestone decomposed into tasks with a concrete starting context.
2. Review and approve a suggested allocation based on member availability and estimated effort.
3. Track progress and flag a task with **Need help** when work is blocked.

The current UI uses representative in-memory data. It does not yet persist changes or send notifications.

## Development

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer

### Commands

```bash
npm install
npm run dev
```

Run the production checks with:

```bash
npm run build
npm run preview
```

## Project structure

```text
src/
  App.tsx       Main FairShare workspace and prototype interactions
  main.tsx      Application entry point
  styles.css    Responsive visual system
docs/
  product-vision.md  Product requirements and validation plan from M1
```

## Scope decisions

The first version focuses on one main task: decompose a milestone, review a capacity-based allocation, and track progress. AI syllabus parsing, calendar sync, chat, code evaluation, and a backend are intentionally excluded while the team tests the riskiest product assumption.

See [`docs/product-vision.md`](docs/product-vision.md) for the source requirements, assumptions, prototype procedure, and team decisions.

## Team workflow

- Create a focused branch from `main`.
- Keep pull requests small and describe the user outcome they support.
- Add or update tests when behavior changes.
- Do not treat prototype observations, AI output, or imagined user comments as user evidence.

