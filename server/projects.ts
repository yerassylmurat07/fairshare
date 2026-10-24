import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./db.js";
import type { MilestoneTemplate } from "../shared/types.js";
import type { AuthRequest } from "./auth.js";
import { authGuard } from "./auth.js";
import { acceptInvitation } from "./invitations.js";
import { projectsFor, userById, state, lockTeam, access } from "./workspace.js";
import {
  currentWeek,
  weekEnd,
  token,
  hashToken,
  HttpError,
} from "./security.js";

export const skills = [
  "Any skill",
  "Architecture",
  "Backend",
  "Frontend",
  "Testing",
  "Documentation",
  "Databases",
] as const;

export const milestoneTemplates: MilestoneTemplate[] = [
  {
    id: "m1-vision",
    name: "M1: Product vision and research",
    description:
      "Problem statement, review of alternatives, key assumptions and a plan for the first test.",
    tasks: [
      {
        title: "Define the problem and target users",
        goal: "Describe clearly who faces the problem and why current solutions do not work.",
        firstStep:
          "Write down 3 concrete observations from past team projects.",
        deliverable: "The “Problem and users” section of the vision document.",
        estimate: 2,
        skill: "Documentation",
        checklist: [
          "Describe the target user and context",
          "Collect real examples of coordination failures",
          "Agree on the wording with the team",
        ],
      },
      {
        title: "Review existing tools",
        goal: "Show why chats and ordinary task boards do not solve the problem.",
        firstStep:
          "Make a table comparing Telegram, Trello and Google Docs on 4 criteria.",
        deliverable: "Comparison table with conclusions.",
        estimate: 2,
        skill: "Documentation",
        checklist: [
          "Try the task start flow in Trello",
          "Describe how context gets lost in group chats",
        ],
      },
      {
        title: "Write down risky assumptions and metrics",
        goal: "Decide which assumptions to test first.",
        firstStep:
          "Write 3 assumptions as: assumption → risk → how to test.",
        deliverable: "Table of assumptions H1–H3 with support criteria.",
        estimate: 2.5,
        skill: "Testing",
        checklist: [
          "Pick the riskiest assumption (H1)",
          "Set a testable start-time threshold (48 h)",
        ],
      },
      {
        title: "Define the scope of the first MVP",
        goal: "Separate the essential first-version features from secondary integrations.",
        firstStep:
          "List 3 core MVP features and 3 excluded ones.",
        deliverable: "MVP scope and main user flow specification.",
        estimate: 3,
        skill: "Architecture",
        checklist: [
          "Describe the main user path from milestone to result",
          "Leave out complex external integrations at the start",
        ],
      },
    ],
  },
  {
    id: "m2-prototype",
    name: "M2: Architecture and working prototype",
    description:
      "Data model, server API, allocation algorithm, client UI and automated tests.",
    tasks: [
      {
        title: "Design the database schema and invariants",
        goal: "Keep teams, milestones, tasks and sessions consistent at the PostgreSQL level.",
        firstStep:
          "Define the users, teams, projects, milestones and tasks tables in schema.sql.",
        deliverable: "Executable SQL schema with foreign keys and indexes.",
        estimate: 3,
        skill: "Databases",
        checklist: [
          "Add CHECK constraints for hours and statuses",
          "Check that each team has one coordinator",
        ],
      },
      {
        title: "Implement the domain algorithm and API routes",
        goal: "Build an explainable task allocation and transactional plan approval.",
        firstStep:
          "Write a pure propose() function and cover it with unit tests.",
        deliverable: "Fastify routes and passing integration tests.",
        estimate: 5,
        skill: "Backend",
        checklist: [
          "Count workload across all active projects of the week",
          "Prevent races with SELECT ... FOR UPDATE",
        ],
      },
      {
        title: "Build the interactive board and task dialogs",
        goal: "Give members a clear UI with a first step, checklist and help button.",
        firstStep:
          "Create the Board and TaskDialog components connected to /api/projects/:id/state.",
        deliverable: "Responsive React UI without horizontal scrolling.",
        estimate: 5,
        skill: "Frontend",
        checklist: [
          "Check keyboard use and closing with Escape",
          "Show overload and blocker indicators",
        ],
      },
      {
        title: "Set up end-to-end checks and documentation",
        goal: "Confirm the key scenarios work before the demo.",
        firstStep:
          "Run npm test and add a scenario for member permissions.",
        deliverable: "A green test run and an up-to-date architecture document.",
        estimate: 3,
        skill: "Testing",
        checklist: [
          "Check isolation from other teams (404/403)",
          "Check that a task cannot be closed without a result",
        ],
      },
    ],
  },
  {
    id: "m3-pilot",
    name: "M3: Pilot test and final demo",
    description:
      "Test how clear the first step is with student teams, collect evidence and give the final demo.",
    tasks: [
      {
        title: "Prepare the pilot protocol and tasks",
        goal: "Check whether members can start without extra explanation from the leader.",
        firstStep:
          "Write a 5-minute onboarding script and 3 check questions.",
        deliverable: "A ready test checklist for 2 teams.",
        estimate: 2.5,
        skill: "Testing",
        checklist: [
          "Measure the time to create the first task (< 3 minutes)",
          "Prepare a form to log questions to the coordinator",
        ],
      },
      {
        title: "Fix UI rough edges found in the run",
        goal: "Remove obstacles to quickly taking over tasks and estimating hours.",
        firstStep:
          "Check the “Need help” flow and taking over a task on a phone screen.",
        deliverable: "A fixed build and updated E2E checks.",
        estimate: 3.5,
        skill: "Frontend",
        checklist: [
          "Check card readability on a narrow screen (390px)",
          "Make sure error messages are clear",
        ],
      },
      {
        title: "Prepare the final presentation and demo setup",
        goal: "Show the path from the problem to a working product and test results.",
        firstStep:
          "Check the production server and prepare 2 accounts for the live demo.",
        deliverable: "Demo slides and a 5-minute live demo script.",
        estimate: 2,
        skill: "Documentation",
        checklist: [
          "Show allocation with skills and learning skills",
          "Demonstrate a help request and closing a task with a result",
        ],
      },
    ],
  },
];

export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const monday = date.refine(
  (v) => new Date(v).getUTCDay() === 1,
  "The week starts on Monday",
);
export const uid = (req: FastifyRequest) => (req as AuthRequest).userId;
export function param(req: FastifyRequest, key = "id") {
  return z
    .string()
    .uuid()
    .parse((req.params as Record<string, string>)[key]);
}
export async function event(
  tx: Sql,
  projectId: string,
  userId: string,
  kind: string,
  details: unknown,
) {
  await tx.query(
    "INSERT INTO events(id,project_id,actor_id,kind,details) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), projectId, userId, kind, JSON.stringify(details)],
  );
}

async function applyMilestoneTemplate(
  tx: Sql,
  projectId: string,
  milestoneId: string,
  userId: string,
  templateId: string,
) {
  const tpl = milestoneTemplates.find((t) => t.id === templateId);
  if (!tpl) throw new HttpError(400, "Milestone template not found.");
  let createdCount = 0;
  for (const item of tpl.tasks) {
    const taskId = randomUUID();
    await tx.query(
      "INSERT INTO tasks(id,project_id,milestone_id,title,goal,first_step,deliverable,estimate,skill,dependency_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        taskId,
        projectId,
        milestoneId,
        item.title,
        item.goal,
        item.firstStep,
        item.deliverable,
        item.estimate,
        item.skill,
        null,
      ],
    );
    for (const stepTitle of item.checklist) {
      await tx.query(
        "INSERT INTO checklist(id,task_id,title) VALUES($1,$2,$3)",
        [randomUUID(), taskId, stepTitle],
      );
    }
    createdCount++;
  }
  await tx.query("UPDATE milestones SET revision=revision+1 WHERE id=$1", [
    milestoneId,
  ]);
  await event(tx, projectId, userId, "milestone.template_applied", {
    milestoneId,
    title: tpl.name,
    count: createdCount,
  });
  return createdCount;
}

export async function projectRoutes(app: FastifyInstance, db: Database) {
  const guard = authGuard(db);
  app.get("/api/templates", { preHandler: guard }, async () => ({
    templates: milestoneTemplates,
  }));
  app.get("/api/workspace", { preHandler: guard }, async (req) => ({
    user: await userById(db, uid(req)),
    projects: await projectsFor(db, uid(req)),
  }));
  app.get("/api/me/tasks", { preHandler: guard }, async (req) =>
    (
      await db.query(
        `SELECT t.*,p.name AS project_name,m.title AS milestone_title,
          (SELECT count(*)::int FROM checklist c WHERE c.task_id=t.id) AS checklist_total,
          (SELECT count(*)::int FROM checklist c WHERE c.task_id=t.id AND c.done=true) AS checklist_done
         FROM tasks t JOIN projects p ON p.id=t.project_id JOIN milestones m ON m.id=t.milestone_id JOIN memberships member ON member.team_id=p.team_id AND member.user_id=$1 WHERE t.assignee_id=$1 ORDER BY CASE WHEN t.status='done' THEN 1 ELSE 0 END,m.due_date,t.created_at`,
        [uid(req)],
      )
    ).rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r))
        out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] =
          k === "estimate"
            ? Number(v)
            : v instanceof Date
              ? v.toISOString()
              : v;
      const startedMs = out.startedAt
        ? new Date(String(out.startedAt)).getTime()
        : null;
      out.staleStart =
        out.status === "in_progress" &&
        !out.helpReason &&
        String(out.evidence || "").trim().length < 10 &&
        Number(out.checklistDone || 0) === 0 &&
        startedMs !== null &&
        Date.now() - startedMs >= 24 * 60 * 60 * 1000;
      return out;
    }),
  );
  app.get("/api/projects/:id/state", { preHandler: guard }, (req) =>
    state(
      db,
      uid(req),
      param(req),
      z.object({ milestoneId: z.string().uuid().optional() }).parse(req.query)
        .milestoneId,
    ),
  );
  app.post("/api/projects", { preHandler: guard }, async (req) => {
    const data = z
      .object({
        teamId: z.string().uuid(),
        name: z.string().trim().min(2).max(100),
        course: z.string().trim().max(60).default(""),
      })
      .parse(req.body);
    return db.transaction(async (tx) => {
      const { rows } = await tx.query(
        "SELECT role FROM memberships WHERE team_id=$1 AND user_id=$2",
        [data.teamId, uid(req)],
      );
      if (rows[0]?.role !== "leader")
        throw new HttpError(403, "Only the team coordinator can create a project.");
      const id = randomUUID();
      await tx.query(
        "INSERT INTO projects(id,team_id,name,course) VALUES($1,$2,$3,$4)",
        [id, data.teamId, data.name, data.course],
      );
      await tx.query(
        "INSERT INTO milestones(id,project_id,title,due_date,week_start) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          id,
          "First milestone",
          weekEnd(currentWeek()),
          currentWeek(),
        ],
      );
      return { id };
    });
  });
  app.post(
    "/api/projects/:id/milestones",
    { preHandler: guard },
    async (req) => {
      const projectId = param(req);
      const data = z
        .object({
          title: z.string().trim().min(2).max(100),
          weekStart: monday,
          dueDate: date,
          templateId: z.string().trim().max(60).optional(),
        })
        .refine(
          (v) => v.dueDate >= v.weekStart && v.dueDate <= weekEnd(v.weekStart),
          "The due date must be inside the selected week",
        )
        .parse(req.body);
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), projectId, true);
        const id = randomUUID();
        await tx.query(
          "INSERT INTO milestones(id,project_id,title,week_start,due_date) VALUES($1,$2,$3,$4,$5)",
          [id, projectId, data.title, data.weekStart, data.dueDate],
        );
        await event(tx, projectId, uid(req), "milestone.created", {
          id,
          title: data.title,
        });
        if (data.templateId) {
          await applyMilestoneTemplate(
            tx,
            projectId,
            id,
            uid(req),
            data.templateId,
          );
        }
        return { id };
      });
    },
  );
  app.post(
    "/api/projects/:id/milestones/:milestoneId/template",
    { preHandler: guard },
    async (req) => {
      const projectId = param(req),
        milestoneId = param(req, "milestoneId");
      const { templateId } = z
        .object({ templateId: z.string().trim().min(2).max(60) })
        .parse(req.body);
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), projectId, true);
        const s = await state(tx, uid(req), projectId, milestoneId);
        const count = await applyMilestoneTemplate(
          tx,
          projectId,
          s.milestone.id,
          uid(req),
          templateId,
        );
        return { ok: true, count };
      });
    },
  );
  app.put("/api/me/availability", { preHandler: guard }, async (req) => {
    const data = z
      .object({
        weekStart: monday,
        hours: z.number().min(0).max(100).multipleOf(0.25),
        skills: z.array(z.enum(skills)).max(7),
        learningSkills: z.array(z.enum(skills)).max(7).optional().default([]),
      })
      .parse(req.body);
    return db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid(req)]);
      await tx.query(
        "INSERT INTO availability(user_id,week_start,hours) VALUES($1,$2,$3) ON CONFLICT(user_id,week_start) DO UPDATE SET hours=EXCLUDED.hours",
        [uid(req), data.weekStart, data.hours],
      );
      const confident = [
        ...new Set(data.skills.filter((s) => s !== "Any skill")),
      ];
      const learning = [
        ...new Set(
          data.learningSkills.filter(
            (s) => s !== "Any skill" && !confident.includes(s),
          ),
        ),
      ];
      await tx.query(
        "UPDATE users SET skills=$2,learning_skills=$3 WHERE id=$1",
        [uid(req), confident, learning],
      );
      return { ok: true };
    });
  });
  app.post(
    "/api/projects/:id/invitations",
    { preHandler: guard },
    async (req) =>
      db.transaction(async (tx) => {
        const project = await lockTeam(tx, uid(req), param(req), true);
        const raw = token();
        await tx.query(
          "INSERT INTO invitations(token_hash,team_id,created_by,expires_at) VALUES($1,$2,$3,now()+interval '24 hours')",
          [hashToken(raw), project.teamId, uid(req)],
        );
        return { token: raw, expiresInHours: 24 };
      }),
  );
  app.post("/api/invitations/accept", { preHandler: guard }, async (req) => {
    const { token: raw } = z
      .object({ token: z.string().min(30).max(100) })
      .parse(req.body);
    return db.transaction(async (tx) => {
      await acceptInvitation(tx, raw, uid(req));
      return { ok: true };
    });
  });
  app.get("/api/projects/:id/events", { preHandler: guard }, async (req) => {
    const id = param(req);
    await access(db, uid(req), id);
    return (
      await db.query(
        "SELECT e.kind,e.details,e.created_at,u.name AS actor FROM events e JOIN users u ON u.id=e.actor_id WHERE e.project_id=$1 ORDER BY e.created_at DESC LIMIT 50",
        [id],
      )
    ).rows;
  });
}
