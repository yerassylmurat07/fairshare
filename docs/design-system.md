# FairShare visual specification

Reference: `diagrams/ui-concept.png`, 1536 × 1024. This is an application workspace with an open board, three columns, and a separate right-hand workload area. The reference image shows the original Russian interface. There is no marketing page inside the workspace.

## Tokens and geometry

- Main background: cool off-white `#f7f8fb`; surfaces and sidebar: `#ffffff`.
- Primary text: `#171928`; secondary text: `#737d96`; borders: `#e5e8f0`.
- Accent: `#7056e8`; light accent background: `#eeebff`; help background: `#fff5df`, text `#946018`.
- Font: Inter when available, otherwise system sans-serif; distinct sizes for headings, buttons, captions, and fields.
- Milestone heading: 38–40 px, weight 700; interface text: 14–16 px; captions: 12–14 px.
- Navigation: 278 px on a wide screen, 230 px on a laptop; top bar: 64 px; workspace padding: 30 px.
- Card radius: 12 px; button radius: 9 px. Subtle shadows, without gradients or decorative illustrations.
- Lucide icons: 18–22 px, stroke width 1.7–2. The equals sign is a meaningful UI icon; branding remains text.

## Approved first-screen content

The following English equivalents describe the existing Russian labels:

FairShare; Work in balance; My projects; My tasks; How it works; PROJECTS; Software Engineering; Databases; Invite; ISE4133 · Team FairShare; First working prototype; Clear tasks. Manageable workload. Shared results.; Milestone due date; dynamic date; task, hour, and member counts; Start with a fair allocation; Compare workload with each person's available time.; Allocate tasks; Board; Workload; Team; New task; Planned; In progress; Done; Team workload; This week's plan; Ask for help in time; We count planned hours, not contribution or grades.; Open a task to see its first step and expected deliverable.

Task data and member names come from the API. Counts, dates, and workload change with the data: the design reference is not a source of business data.

## Additional required states

- Login and registration, with demo mode labeled separately.
- Allocation dialog with explanations and explicit approval.
- Task dialog: goal, first step, deliverable, hour estimate, skill, assignee, dependency, state, help request, and result link/description.
- Project and milestone creation, plus milestone selection when several exist.
- Team view: editing personal availability and skills, and creating single-use invitations.
- Workload view: hour totals and ratios to availability.
- Loading, empty projects, no eligible assignees, stale proposals, and access errors.

These states are necessary functional extensions of the reference. On mobile, navigation moves behind a menu button, the board becomes vertical, and workload moves below it. Dialogs support keyboards: they trap focus, close with Escape, and return focus to their trigger. Visible focus rings are required. Reduced animation respects `prefers-reduced-motion`.
