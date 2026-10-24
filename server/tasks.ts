import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./db.js";
import type { Task } from "../shared/types.js";
import { authGuard } from "./auth.js";
import { uid, param, skills, event } from "./projects.js";
import { lockTeam, state } from "./workspace.js";
import { camel, HttpError } from "./security.js";

const fields = z.object({
  title: z.string().trim().min(3).max(120),
  goal: z.string().trim().min(3).max(800),
  firstStep: z.string().trim().min(3).max(800),
  deliverable: z.string().trim().min(3).max(800),
  estimate: z.number().positive().max(100).multipleOf(0.25),
  skill: z.enum(skills),
  dependencyId: z.string().uuid().nullable(),
});

async function dependency(tx: Sql, task: Task, dep: string | null) {
  if (!dep) return;
  const { rows } = await tx.query(
    "WITH RECURSIVE chain AS (SELECT id,dependency_id,project_id FROM tasks WHERE id=$1 UNION SELECT t.id,t.dependency_id,t.project_id FROM tasks t JOIN chain c ON t.id=c.dependency_id) SELECT * FROM chain",
    [dep],
  );
  if (!rows.length || rows[0].project_id !== task.projectId)
    throw new HttpError(400, "The dependency must be a task in this project.");
  if (rows.some((r) => r.id === task.id))
    throw new HttpError(409, "The dependency creates a cycle.");
}

export async function taskRoutes(app: FastifyInstance, db: Database) {
  const guard = authGuard(db);

  app.post("/api/projects/:id/tasks", { preHandler: guard }, async (req) => {
    const projectId = param(req);
    const data = fields
      .extend({
        milestoneId: z.string().uuid(),
        dependencyId: fields.shape.dependencyId.default(null),
      })
      .parse(req.body);
    return db.transaction(async (tx) => {
      await lockTeam(tx, uid(req), projectId);
      const s = await state(tx, uid(req), projectId, data.milestoneId);
      const id = randomUUID();
      await dependency(tx, { id, projectId } as Task, data.dependencyId);
      await tx.query(
        "INSERT INTO tasks(id,project_id,milestone_id,title,goal,first_step,deliverable,estimate,skill,dependency_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          projectId,
          s.milestone.id,
          data.title,
          data.goal,
          data.firstStep,
          data.deliverable,
          data.estimate,
          data.skill,
          data.dependencyId,
        ],
      );
      await tx.query("UPDATE milestones SET revision=revision+1 WHERE id=$1", [
        s.milestone.id,
      ]);
      await event(tx, projectId, uid(req), "task.created", {
        id,
        title: data.title,
      });
      return { id };
    });
  });

  app.patch(
    "/api/projects/:id/tasks/:taskId",
    { preHandler: guard },
    async (req) => {
      const projectId = param(req),
        taskId = param(req, "taskId");
      const data = fields
        .partial()
        .extend({
          version: z.number().int().positive(),
          assigneeId: z.string().uuid().nullable().optional(),
          status: z.enum(["planned", "in_progress", "done"]).optional(),
          helpReason: z.string().trim().min(3).max(400).nullable().optional(),
          evidence: z.string().trim().max(1200).optional(),
          override: z.boolean().default(false),
        })
        .parse(req.body);
      return db.transaction(async (tx) => {
        const project = await lockTeam(tx, uid(req), projectId);
        const { rows } = await tx.query(
          "SELECT * FROM tasks WHERE id=$1 AND project_id=$2 FOR UPDATE",
          [taskId, projectId],
        );
        if (!rows[0]) throw new HttpError(404, "Task not found.");
        const old = camel<Task>(rows[0]);
        if (old.version !== data.version)
          throw new HttpError(
            409,
            "The task has changed. Close the card and open it again.",
          );
        if (project.role !== "leader" && old.assigneeId !== uid(req))
          throw new HttpError(
            403,
            "Only the assignee or the coordinator can edit this task.",
          );
        if (
          project.role !== "leader" &&
          [
            "title",
            "goal",
            "firstStep",
            "deliverable",
            "estimate",
            "skill",
            "assigneeId",
            "dependencyId",
          ].some(
            (key) =>
              key in data &&
              (data as Record<string, unknown>)[key] !== old[key as keyof Task],
          )
        )
          throw new HttpError(
            403,
            "Only the coordinator can change the task requirements.",
          );
        const task = { ...old, ...data };
        await dependency(tx, task, task.dependencyId);
        const s = await state(tx, uid(req), projectId, task.milestoneId);
        if (task.assigneeId) {
          const member = s.members.find((m) => m.id === task.assigneeId);
          if (!member)
            throw new HttpError(400, "The assignee must be a team member.");
          const changed =
            task.assigneeId !== old.assigneeId ||
            task.estimate !== old.estimate ||
            task.skill !== old.skill ||
            (old.status === "done" && task.status !== "done");
          if (changed) {
            const load =
              member.load -
              (old.assigneeId === member.id && old.status !== "done"
                ? old.estimate
                : 0) +
              (task.status === "done" ? 0 : task.estimate);
            const hasSkillOrStretch =
              task.skill === "Any skill" ||
              member.skills.includes(task.skill) ||
              (member.learningSkills || []).includes(task.skill);
            if (
              (load > member.capacity || !hasSkillOrStretch) &&
              !(project.role === "leader" && data.override)
            )
              throw new HttpError(
                409,
                "The assignment exceeds availability or does not match the skill. Confirm a manual exception.",
              );
          }
        }
        if (task.status !== "planned" && !task.assigneeId)
          throw new HttpError(400, "Assign someone first.");
        if (task.status !== "planned" && task.dependencyId) {
          const dep = await tx.query("SELECT status FROM tasks WHERE id=$1", [
            task.dependencyId,
          ]);
          if (dep.rows[0]?.status !== "done")
            throw new HttpError(409, "Finish the dependency task first.");
        }
        if (task.status === "done" && task.evidence.length < 10)
          throw new HttpError(
            400,
            "Add a link or a description of the result (at least 10 characters).",
          );
        if (task.status === "done" && task.helpReason)
          throw new HttpError(
            400,
            "Clear the help request before completing the task.",
          );
        await tx.query(
          `UPDATE tasks SET title=$2,goal=$3,first_step=$4,deliverable=$5,estimate=$6,skill=$7,assignee_id=$8,status=$9,help_reason=$10,evidence=$11,dependency_id=$12,version=version+1,
   started_at=CASE WHEN $9='in_progress' THEN COALESCE(started_at,now()) ELSE started_at END,
   first_evidence_at=CASE WHEN length($11)>=10 THEN COALESCE(first_evidence_at,now()) ELSE first_evidence_at END,
   done_at=CASE WHEN $9='done' THEN now() ELSE NULL END WHERE id=$1`,
          [
            taskId,
            task.title,
            task.goal,
            task.firstStep,
            task.deliverable,
            task.estimate,
            task.skill,
            task.assigneeId,
            task.status,
            task.helpReason,
            task.evidence,
            task.dependencyId,
          ],
        );
        await tx.query(
          "UPDATE milestones SET revision=revision+1 WHERE id=$1",
          [task.milestoneId],
        );
        await event(tx, projectId, uid(req), "task.updated", {
          id: taskId,
          from: old.status,
          to: task.status,
          helpRequested: !!task.helpReason,
          manualOverride: data.override,
        });
        return { ok: true };
      });
    },
  );

  app.post(
    "/api/projects/:id/tasks/:taskId/claim",
    { preHandler: guard },
    async (req) => {
      const projectId = param(req),
        taskId = param(req, "taskId");
      const { version } = z
        .object({ version: z.number().int().positive() })
        .parse(req.body);
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), projectId);
        const { rows } = await tx.query(
          "SELECT * FROM tasks WHERE id=$1 AND project_id=$2 FOR UPDATE",
          [taskId, projectId],
        );
        if (!rows[0]) throw new HttpError(404, "Task not found.");
        const old = camel<Task>(rows[0]);
        if (old.version !== version)
          throw new HttpError(
            409,
            "The task has changed. Close the card and open it again.",
          );
        if (old.status === "done")
          throw new HttpError(400, "A completed task cannot be taken over.");
        if (!old.helpReason && old.assigneeId !== null)
          throw new HttpError(
            400,
            "You can only take over an unassigned task or one with a help request.",
          );
        if (old.assigneeId === uid(req))
          throw new HttpError(400, "This task is already assigned to you.");
        const s = await state(tx, uid(req), projectId, old.milestoneId);
        const me = s.members.find((m) => m.id === uid(req));
        if (!me)
          throw new HttpError(
            403,
            "You are not a member of this project's team.",
          );
        if (me.load + old.estimate > me.capacity)
          throw new HttpError(
            409,
            "You do not have enough free hours this week to take over this task.",
          );
        await tx.query(
          `UPDATE tasks SET assignee_id=$2,help_reason=NULL,version=version+1 WHERE id=$1`,
          [taskId, uid(req)],
        );
        await tx.query(
          "UPDATE milestones SET revision=revision+1 WHERE id=$1",
          [old.milestoneId],
        );
        await event(tx, projectId, uid(req), "task.claimed", {
          id: taskId,
          title: old.title,
        });
        return { ok: true };
      });
    },
  );

  app.post(
    "/api/projects/:id/tasks/:taskId/estimates",
    { preHandler: guard },
    async (req) => {
      const projectId = param(req),
        taskId = param(req, "taskId");
      const { hours } = z
        .object({
          hours: z.number().positive().max(100).multipleOf(0.25),
        })
        .parse(req.body);
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), projectId);
        const { rows } = await tx.query(
          "SELECT id,title FROM tasks WHERE id=$1 AND project_id=$2",
          [taskId, projectId],
        );
        if (!rows[0]) throw new HttpError(404, "Task not found.");
        await tx.query(
          `INSERT INTO task_estimates(task_id,user_id,hours,updated_at)
           VALUES($1,$2,$3,now())
           ON CONFLICT(task_id,user_id) DO UPDATE SET hours=EXCLUDED.hours,updated_at=now()`,
          [taskId, uid(req), hours],
        );
        return { ok: true };
      });
    },
  );

  app.delete(
    "/api/projects/:id/tasks/:taskId",
    { preHandler: guard },
    async (req) =>
      db.transaction(async (tx) => {
        const projectId = param(req),
          taskId = param(req, "taskId");
        await lockTeam(tx, uid(req), projectId, true);
        const version = z
          .object({ version: z.coerce.number().int().positive() })
          .parse(req.query).version;
        const { rows } = await tx.query(
          "SELECT * FROM tasks WHERE id=$1 AND project_id=$2",
          [taskId, projectId],
        );
        if (!rows[0]) throw new HttpError(404, "Task not found.");
        if (rows[0].status !== "planned" || rows[0].version !== version)
          throw new HttpError(
            409,
            "Only a current planned task can be deleted.",
          );
        const dependents = await tx.query(
          "SELECT id FROM tasks WHERE dependency_id=$1",
          [taskId],
        );
        if (dependents.rows.length)
          throw new HttpError(409, "Another task depends on this task.");
        await tx.query("DELETE FROM tasks WHERE id=$1", [taskId]);
        await tx.query(
          "UPDATE milestones SET revision=revision+1 WHERE id=$1",
          [rows[0].milestone_id],
        );
        await event(tx, projectId, uid(req), "task.deleted", { id: taskId });
        return { ok: true };
      }),
  );
}
