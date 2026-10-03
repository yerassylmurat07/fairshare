import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./db.js";
import type { AuthRequest } from "./auth.js";
import { authGuard } from "./auth.js";
import { projectsFor, userById, state, lockTeam, access } from "./workspace.js";
import {
  currentWeek,
  weekEnd,
  token,
  hashToken,
  HttpError,
} from "./security.js";
export const skills = [
  "Любой навык",
  "Архитектура",
  "Backend",
  "Frontend",
  "Тестирование",
  "Документация",
  "Базы данных",
] as const;
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Некорректная дата",
  );
export const monday = date.refine(
  (v) => new Date(v).getUTCDay() === 1,
  "Неделя начинается в понедельник",
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
export async function projectRoutes(app: FastifyInstance, db: Database) {
  const guard = authGuard(db);
  app.get("/api/workspace", { preHandler: guard }, async (req) => ({
    user: await userById(db, uid(req)),
    projects: await projectsFor(db, uid(req)),
  }));
  app.get("/api/me/tasks", { preHandler: guard }, async (req) =>
    (
      await db.query(
        `SELECT t.*,p.name AS project_name,m.title AS milestone_title FROM tasks t JOIN projects p ON p.id=t.project_id JOIN milestones m ON m.id=t.milestone_id JOIN memberships member ON member.team_id=p.team_id AND member.user_id=$1 WHERE t.assignee_id=$1 ORDER BY CASE WHEN t.status='done' THEN 1 ELSE 0 END,m.due_date,t.created_at`,
        [uid(req)],
      )
    ).rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r))
        out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] =
          k === "estimate" ? Number(v) : v;
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
        throw new HttpError(403, "Создать проект может координатор команды.");
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
          "Первый этап",
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
        })
        .refine(
          (v) => v.dueDate >= v.weekStart && v.dueDate <= weekEnd(v.weekStart),
          "Срок должен попадать в выбранную неделю",
        )
        .parse(req.body);
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), projectId, true);
        const id = randomUUID();
        await tx.query(
          "INSERT INTO milestones(id,project_id,title,week_start,due_date) VALUES($1,$2,$3,$4,$5)",
          [id, projectId, data.title, data.weekStart, data.dueDate],
        );
        await event(tx, projectId, uid(req), "milestone.created", { id });
        return { id };
      });
    },
  );
  app.put("/api/me/availability", { preHandler: guard }, async (req) => {
    const data = z
      .object({
        weekStart: monday,
        hours: z.number().min(0).max(100).multipleOf(0.25),
        skills: z.array(z.enum(skills)).max(7),
      })
      .parse(req.body);
    return db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid(req)]);
      await tx.query(
        "INSERT INTO availability(user_id,week_start,hours) VALUES($1,$2,$3) ON CONFLICT(user_id,week_start) DO UPDATE SET hours=EXCLUDED.hours",
        [uid(req), data.weekStart, data.hours],
      );
      await tx.query("UPDATE users SET skills=$2 WHERE id=$1", [
        uid(req),
        [...new Set(data.skills.filter((s) => s !== "Любой навык"))],
      ]);
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
      const initial = await tx.query(
        "SELECT team_id FROM invitations WHERE token_hash=$1",
        [hashToken(raw)],
      );
      if (!initial.rows[0])
        throw new HttpError(410, "Приглашение истекло или уже использовано.");
      await tx.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [
        initial.rows[0].team_id,
      ]);
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid(req)]);
      const { rows } = await tx.query(
        "SELECT * FROM invitations WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [hashToken(raw)],
      );
      const invitation = rows[0];
      if (!invitation || invitation.used_by)
        throw new HttpError(410, "Приглашение истекло или уже использовано.");
      await tx.query(
        "INSERT INTO memberships(team_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING",
        [invitation.team_id, uid(req)],
      );
      await tx.query("UPDATE invitations SET used_by=$2 WHERE token_hash=$1", [
        hashToken(raw),
        uid(req),
      ]);
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
