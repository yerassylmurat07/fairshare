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
    throw new HttpError(400, "Зависимость должна быть задачей этого проекта.");
  if (rows.some((r) => r.id === task.id))
    throw new HttpError(409, "Зависимость образует цикл.");
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
        if (!rows[0]) throw new HttpError(404, "Задача не найдена.");
        const old = camel<Task>(rows[0]);
        if (old.version !== data.version)
          throw new HttpError(
            409,
            "Задача изменилась. Закройте карточку и откройте снова.",
          );
        if (project.role !== "leader" && old.assigneeId !== uid(req))
          throw new HttpError(
            403,
            "Редактировать задачу может её исполнитель или координатор.",
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
            "Изменять условия задачи может координатор.",
          );
        const task = { ...old, ...data };
        await dependency(tx, task, task.dependencyId);
        const s = await state(tx, uid(req), projectId, task.milestoneId);
        if (task.assigneeId) {
          const member = s.members.find((m) => m.id === task.assigneeId);
          if (!member)
            throw new HttpError(
              400,
              "Исполнитель должен быть участником команды.",
            );
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
            if (
              (load > member.capacity ||
                (task.skill !== "Любой навык" &&
                  !member.skills.includes(task.skill))) &&
              !(project.role === "leader" && data.override)
            )
              throw new HttpError(
                409,
                "Назначение превышает доступность или не соответствует навыку. Подтвердите ручное исключение.",
              );
          }
        }
        if (task.status !== "planned" && !task.assigneeId)
          throw new HttpError(400, "Сначала назначьте исполнителя.");
        if (task.status !== "planned" && task.dependencyId) {
          const dep = await tx.query("SELECT status FROM tasks WHERE id=$1", [
            task.dependencyId,
          ]);
          if (dep.rows[0]?.status !== "done")
            throw new HttpError(409, "Сначала завершите задачу-зависимость.");
        }
        if (task.status === "done" && task.evidence.length < 10)
          throw new HttpError(
            400,
            "Укажите ссылку или описание результата (от 10 символов).",
          );
        if (task.status === "done" && task.helpReason)
          throw new HttpError(400, "Перед завершением снимите запрос помощи.");
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
        if (!rows[0]) throw new HttpError(404, "Задача не найдена.");
        if (rows[0].status !== "planned" || rows[0].version !== version)
          throw new HttpError(
            409,
            "Удалить можно актуальную запланированную задачу.",
          );
        const dependents = await tx.query(
          "SELECT id FROM tasks WHERE dependency_id=$1",
          [taskId],
        );
        if (dependents.rows.length)
          throw new HttpError(409, "На эту задачу ссылается другая задача.");
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
