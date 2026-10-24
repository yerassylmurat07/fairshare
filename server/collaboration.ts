import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./db.js";
import { authGuard } from "./auth.js";
import { uid, param, event } from "./projects.js";
import { access, lockTeam } from "./workspace.js";
import { HttpError, camel } from "./security.js";
async function taskAccess(
  tx: Sql,
  user: string,
  project: string,
  task: string,
) {
  await access(tx, user, project);
  const { rows } = await tx.query(
    "SELECT * FROM tasks WHERE id=$1 AND project_id=$2",
    [task, project],
  );
  if (!rows[0]) throw new HttpError(404, "Task not found.");
  return rows[0];
}
const text = z.string().trim().min(1).max(2000);
export async function collaborationRoutes(app: FastifyInstance, db: Database) {
  const guard = authGuard(db);
  app.get(
    "/api/projects/:id/tasks/:taskId/discussion",
    { preHandler: guard },
    async (req) => {
      const project = param(req),
        task = param(req, "taskId");
      await taskAccess(db, uid(req), project, task);
      return {
        comments: (
          await db.query(
            "SELECT c.*,u.name,u.initials,u.color FROM comments c JOIN users u ON u.id=c.author_id WHERE task_id=$1 ORDER BY created_at,id",
            [task],
          )
        ).rows.map(camel),
        checklist: (
          await db.query(
            "SELECT * FROM checklist WHERE task_id=$1 ORDER BY created_at,id",
            [task],
          )
        ).rows.map(camel),
      };
    },
  );
  app.post(
    "/api/projects/:id/tasks/:taskId/comments",
    { preHandler: guard },
    async (req) => {
      const { body } = z.object({ body: text }).parse(req.body);
      return db.transaction(async (tx) => {
        const project = param(req),
          task = param(req, "taskId");
        await lockTeam(tx, uid(req), project);
        await taskAccess(tx, uid(req), project, task);
        await tx.query(
          "INSERT INTO comments(id,task_id,author_id,body) VALUES($1,$2,$3,$4)",
          [randomUUID(), task, uid(req), body],
        );
        await event(tx, project, uid(req), "comment.added", { taskId: task });
        return { ok: true };
      });
    },
  );
  app.post(
    "/api/projects/:id/tasks/:taskId/checklist",
    { preHandler: guard },
    async (req) => {
      const { title } = z
        .object({ title: z.string().trim().min(2).max(160) })
        .parse(req.body);
      return db.transaction(async (tx) => {
        const project = param(req),
          task = param(req, "taskId");
        await lockTeam(tx, uid(req), project);
        await taskAccess(tx, uid(req), project, task);
        await tx.query(
          "INSERT INTO checklist(id,task_id,title) VALUES($1,$2,$3)",
          [randomUUID(), task, title],
        );
        return { ok: true };
      });
    },
  );
  app.patch(
    "/api/projects/:id/tasks/:taskId/checklist/:itemId",
    { preHandler: guard },
    async (req) => {
      const { done } = z.object({ done: z.boolean() }).parse(req.body);
      return db.transaction(async (tx) => {
        const project = param(req),
          task = param(req, "taskId");
        await lockTeam(tx, uid(req), project);
        await taskAccess(tx, uid(req), project, task);
        const { rows } = await tx.query(
          "UPDATE checklist SET done=$2 WHERE id=$1 AND task_id=$3 RETURNING id",
          [param(req, "itemId"), done, task],
        );
        if (!rows.length) throw new HttpError(404, "Checklist item not found.");
        return { ok: true };
      });
    },
  );
  app.get(
    "/api/projects/:id/collaboration",
    { preHandler: guard },
    async (req) => {
      const project = param(req);
      await access(db, uid(req), project);
      const resources = (
        await db.query(
          "SELECT r.*,u.name AS author FROM resources r JOIN users u ON u.id=r.author_id WHERE project_id=$1 ORDER BY created_at DESC",
          [project],
        )
      ).rows.map(camel);
      const decisions = (
        await db.query(
          `SELECT d.*,u.name AS author,(SELECT count(*)::int FROM votes WHERE decision_id=d.id AND choice='yes') AS yes,(SELECT count(*)::int FROM votes WHERE decision_id=d.id AND choice='no') AS no,(SELECT choice FROM votes WHERE decision_id=d.id AND user_id=$2) AS my_vote FROM decisions d JOIN users u ON u.id=d.author_id WHERE project_id=$1 ORDER BY created_at DESC`,
          [project, uid(req)],
        )
      ).rows.map(camel);
      return { resources, decisions };
    },
  );
  app.post(
    "/api/projects/:id/resources",
    { preHandler: guard },
    async (req) => {
      const data = z
        .object({
          title: z.string().trim().min(2).max(100),
          url: z
            .string()
            .url()
            .max(1000)
            .refine(
              (s) => ["http:", "https:"].includes(new URL(s).protocol),
              "An HTTP/HTTPS link is required",
            ),
        })
        .parse(req.body);
      return db.transaction(async (tx) => {
        const project = param(req);
        await lockTeam(tx, uid(req), project);
        await tx.query(
          "INSERT INTO resources(id,project_id,author_id,title,url) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), project, uid(req), data.title, data.url],
        );
        await event(tx, project, uid(req), "resource.added", {
          title: data.title,
        });
        return { ok: true };
      });
    },
  );
  app.post(
    "/api/projects/:id/decisions",
    { preHandler: guard },
    async (req) => {
      const data = z
        .object({ title: z.string().trim().min(3).max(120), context: text })
        .parse(req.body);
      return db.transaction(async (tx) => {
        const project = param(req);
        await lockTeam(tx, uid(req), project);
        await tx.query(
          "INSERT INTO decisions(id,project_id,author_id,title,context) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), project, uid(req), data.title, data.context],
        );
        await event(tx, project, uid(req), "decision.created", {
          title: data.title,
        });
        return { ok: true };
      });
    },
  );
  app.post(
    "/api/projects/:id/decisions/:decisionId/vote",
    { preHandler: guard },
    async (req) => {
      const { choice } = z
        .object({ choice: z.enum(["yes", "no"]) })
        .parse(req.body);
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), param(req));
        const { rows } = await tx.query(
          "SELECT id FROM decisions WHERE id=$1 AND project_id=$2 AND status='open' FOR UPDATE",
          [param(req, "decisionId"), param(req)],
        );
        if (!rows.length)
          throw new HttpError(409, "The decision is closed or unavailable.");
        await tx.query(
          "INSERT INTO votes(decision_id,user_id,choice) VALUES($1,$2,$3) ON CONFLICT(decision_id,user_id) DO UPDATE SET choice=EXCLUDED.choice",
          [param(req, "decisionId"), uid(req), choice],
        );
        return { ok: true };
      });
    },
  );
  app.patch(
    "/api/projects/:id/decisions/:decisionId",
    { preHandler: guard },
    async (req) => {
      const { status } = z
        .object({ status: z.enum(["accepted", "declined"]) })
        .parse(req.body);
      return db.transaction(async (tx) => {
        const project = param(req);
        await lockTeam(tx, uid(req), project, true);
        const { rows } = await tx.query(
          "UPDATE decisions SET status=$3,closed_at=now() WHERE id=$1 AND project_id=$2 AND status='open' RETURNING title",
          [param(req, "decisionId"), project, status],
        );
        if (!rows.length)
          throw new HttpError(409, "The decision is closed or unavailable.");
        await event(tx, project, uid(req), "decision.closed", {
          title: rows[0].title,
          status,
        });
        return { ok: true };
      });
    },
  );
}
