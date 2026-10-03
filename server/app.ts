import Fastify from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ZodError } from "zod";
import type { Database } from "./db.js";
import { migrate } from "./db.js";
import { seed } from "./seed.js";
import { HttpError } from "./security.js";
import { authRoutes } from "./auth.js";
import { projectRoutes } from "./projects.js";
import { taskRoutes } from "./tasks.js";
import { allocationRoutes } from "./allocations.js";
import { collaborationRoutes } from "./collaboration.js";
export async function createApp(
  db: Database,
  options: { demo?: boolean } = {},
) {
  const demo =
    options.demo ??
    (process.env.ENABLE_DEMO === "true" ||
      (process.env.ENABLE_DEMO !== "false" &&
        process.env.NODE_ENV !== "production"));
  await migrate(db);
  await db.query("DELETE FROM sessions WHERE expires_at<now()");
  if (demo) await seed(db);
  const app = Fastify({
    bodyLimit: 100_000,
    logger: false,
    // Only the local reverse proxy may supply the client IP for rate limits.
    trustProxy: "127.0.0.1",
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
  app.addHook("onRequest", async (req) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed =
        process.env.APP_ORIGIN || `${req.protocol}://${req.headers.host}`;
      // Vite development proxy forwards the browser's origin at port 5173.
      const dev =
        process.env.NODE_ENV !== "production" &&
        origin &&
        ["http://localhost:5173", "http://127.0.0.1:5173"].includes(origin);
      if (
        req.headers["sec-fetch-site"] === "cross-site" ||
        (origin && origin !== allowed && !dev)
      )
        throw new HttpError(403, "Источник запроса недоступен.");
    }
  });
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    else
      reply.header(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    return payload;
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error:
          "Проверьте поля: " +
          error.issues.map((i) => i.path.join(".") || i.message).join(", "),
      });
    if ((error as { code?: string }).code === "23505")
      return reply.code(409).send({
        error: "Такая запись уже существует. Используйте другой email.",
      });
    const code =
      error instanceof HttpError
        ? error.statusCode
        : (error as { statusCode?: number }).statusCode || 500;
    const detail = error instanceof Error ? error.message : "Ошибка запроса";
    if (code >= 500) console.error("API error:", detail);
    return reply.code(code).send({
      error:
        code >= 500
          ? "Не удалось выполнить действие. Попробуйте ещё раз."
          : detail,
    });
  });
  app.get("/api/health", async () => {
    await db.query("SELECT 1");
    return { ok: true };
  });
  await authRoutes(app, db, demo);
  await projectRoutes(app, db);
  await taskRoutes(app, db);
  await allocationRoutes(app, db);
  await collaborationRoutes(app, db);
  const root = resolve("dist");
  if (existsSync(root)) {
    await app.register(staticFiles, { root });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "Маршрут не найден." })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
