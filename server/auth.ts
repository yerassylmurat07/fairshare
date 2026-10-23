import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
} from "../shared/auth.js";
import { acceptInvitation } from "./invitations.js";
import type { Database, Sql } from "./db.js";
import {
  token,
  hashToken,
  passwordHash,
  passwordMatches,
  initials,
  HttpError,
  currentWeek,
  weekEnd,
} from "./security.js";
import { userById } from "./workspace.js";
import { DEMO_EMAIL } from "./seed.js";
export type AuthRequest = FastifyRequest & { userId: string };
export function authGuard(db: Database) {
  return async (req: FastifyRequest) => {
    const raw = req.cookies.fairshare_session;
    if (!raw) throw new HttpError(401, "Войдите в приложение.");
    const { rows } = await db.query(
      "SELECT s.user_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hashToken(raw)],
    );
    if (!rows[0]) throw new HttpError(401, "Сессия истекла. Войдите снова.");
    (req as AuthRequest).userId = String(rows[0].user_id);
  };
}
async function session(
  tx: Sql,
  userId: string,
  reply: FastifyReply,
  previous?: string,
) {
  if (previous)
    await tx.query("DELETE FROM sessions WHERE token_hash=$1", [
      hashToken(previous),
    ]);
  const raw = token();
  await tx.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [hashToken(raw), userId],
  );
  reply.setCookie("fairshare_session", raw, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 86400,
  });
  return { user: await userById(tx, userId) };
}
export async function authRoutes(
  app: FastifyInstance,
  db: Database,
  demo: boolean,
) {
  // Unknown emails still perform the same password derivation as known accounts.
  const dummyHash = await passwordHash(token());
  const authLimit = app.rateLimit({
    max: 12,
    timeWindow: "1 minute",
    errorResponseBuilder: () =>
      new HttpError(
        429,
        "Слишком много попыток. Подождите минуту и попробуйте снова.",
      ),
  });
  // Reuse one limiter/store across auth routes rather than one store per route.
  const limit = { config: { rateLimit: false as const }, onRequest: authLimit };
  app.post("/api/auth/register", limit, async (req, reply) => {
    const data = registerSchema.parse(req.body);
    const hash = await passwordHash(data.password);
    return db.transaction(async (tx) => {
      const id = randomUUID(),
        team = randomUUID(),
        project = randomUUID();
      await tx.query(
        "INSERT INTO users(id,email,password_hash,name,initials,color) VALUES($1,$2,$3,$4,$5,$6)",
        [id, data.email, hash, data.name, initials(data.name), "#7056e8"],
      );
      if (data.inviteToken) {
        await acceptInvitation(tx, data.inviteToken, id);
      } else {
        await tx.query("INSERT INTO teams(id,name) VALUES($1,$2)", [
          team,
          data.teamName,
        ]);
        await tx.query(
          "INSERT INTO memberships(team_id,user_id,role) VALUES($1,$2,'leader')",
          [team, id],
        );
        await tx.query(
          "INSERT INTO projects(id,team_id,name,course) VALUES($1,$2,$3,$4)",
          [project, team, "Новый проект", ""],
        );
        await tx.query(
          "INSERT INTO milestones(id,project_id,title,due_date,week_start) VALUES($1,$2,$3,$4,$5)",
          [
            randomUUID(),
            project,
            "Первый этап",
            weekEnd(currentWeek()),
            currentWeek(),
          ],
        );
      }
      await tx.query(
        "INSERT INTO availability(user_id,week_start,hours) VALUES($1,$2,$3)",
        [id, currentWeek(), 8],
      );
      return session(tx, id, reply, req.cookies.fairshare_session);
    });
  });
  app.post("/api/auth/login", limit, async (req, reply) => {
    const data = loginSchema.parse(req.body);
    const { rows } = await db.query(
      "SELECT id,password_hash FROM users WHERE email=$1",
      [data.email],
    );
    const matches = await passwordMatches(
      data.password,
      rows[0] ? String(rows[0].password_hash) : dummyHash,
    );
    if (!rows[0] || !matches)
      throw new HttpError(401, "Неверный email или пароль.");
    return db.transaction(async (tx) => {
      // Serialize session creation with a password change. An old password
      // verified just before the change must not create a new session afterward.
      const current = await tx.query(
        "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
        [rows[0].id],
      );
      if (current.rows[0]?.password_hash !== rows[0].password_hash)
        throw new HttpError(401, "Неверный email или пароль.");
      return session(
        tx,
        String(rows[0].id),
        reply,
        req.cookies.fairshare_session,
      );
    });
  });
  app.post(
    "/api/auth/password",
    { ...limit, preHandler: authGuard(db) },
    async (req, reply) => {
      const data = changePasswordSchema.parse(req.body);
      const userId = (req as AuthRequest).userId;
      return db.transaction(async (tx) => {
        const { rows } = await tx.query(
          "SELECT email,password_hash FROM users WHERE id=$1 FOR UPDATE",
          [userId],
        );
        // authGuard runs before the transaction; recheck after locking the user
        // in case a concurrent password change has already revoked this session.
        const active = await tx.query(
          "SELECT user_id FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()",
          [hashToken(req.cookies.fairshare_session!), userId],
        );
        if (!active.rows[0] || !rows[0])
          throw new HttpError(401, "Сессия истекла. Войдите снова.");
        if (demo && String(rows[0].email).endsWith("@fairshare.demo"))
          throw new HttpError(
            403,
            "Пароль общей демокоманды менять нельзя. Создайте свой аккаунт.",
          );
        if (
          !(await passwordMatches(
            data.currentPassword,
            String(rows[0].password_hash),
          ))
        )
          throw new HttpError(400, "Текущий пароль указан неверно.");
        const hash = await passwordHash(data.newPassword);
        await tx.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
          userId,
          hash,
        ]);
        await tx.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
        await session(tx, userId, reply);
        return { ok: true };
      });
    },
  );
  if (demo)
    app.post("/api/auth/demo", limit, async (req, reply) => {
      const { rows } = await db.query("SELECT id FROM users WHERE email=$1", [
        DEMO_EMAIL,
      ]);
      return db.transaction((tx) =>
        session(tx, String(rows[0].id), reply, req.cookies.fairshare_session),
      );
    });
  app.post("/api/auth/logout", async (req, reply) => {
    if (req.cookies.fairshare_session)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hashToken(req.cookies.fairshare_session),
      ]);
    reply.clearCookie("fairshare_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/auth/session", async (req) => {
    if (!req.cookies.fairshare_session) return { user: null };
    const { rows } = await db.query(
      "SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()",
      [hashToken(req.cookies.fairshare_session)],
    );
    return {
      user: rows[0] ? await userById(db, String(rows[0].user_id)) : null,
    };
  });
  app.get("/api/config", () => ({ demoEnabled: demo }));
}
