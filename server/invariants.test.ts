import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "./db.js";
import { createApp } from "./app.js";
import type { ProjectState, Allocation, Workspace } from "../shared/types.js";

test("preserves dependencies on partial edits, rejects cycles and blocks premature completion", async () => {
  const db = await createDatabase("memory://");
  const app = await createApp(db, { demo: true });
  try {
    const login = await app.inject({ method: "POST", url: "/api/auth/demo" });
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const request = (
      method: "GET" | "POST" | "PATCH" | "PUT",
      url: string,
      payload?: Record<string, unknown>,
    ) => app.inject({ method, url, headers: { cookie }, payload });
    const w = (await request("GET", "/api/workspace")).json<Workspace>();
    const id = w.projects.find((p) => p.course === "ISE4133")!.id;
    const get = async () =>
      (await request("GET", `/api/projects/${id}/state`)).json<ProjectState>();
    let s = await get();
    const root = s.tasks.find((t) => t.skill === "Архитектура")!;
    const follower = s.tasks.find((t) => t.skill === "Backend")!;
    assert.equal(
      (
        await request("PATCH", `/api/projects/${id}/tasks/${follower.id}`, {
          version: follower.version,
          dependencyId: root.id,
        })
      ).statusCode,
      200,
    );
    s = await get();
    let linked = s.tasks.find((t) => t.id === follower.id)!;
    assert.equal(
      (
        await request("PATCH", `/api/projects/${id}/tasks/${follower.id}`, {
          version: linked.version,
          helpReason: "Нужна помощь с зависимостью.",
        })
      ).statusCode,
      200,
    );
    s = await get();
    linked = s.tasks.find((t) => t.id === follower.id)!;
    assert.equal(linked.dependencyId, root.id);
    assert.equal(
      (
        await request("PATCH", `/api/projects/${id}/tasks/${root.id}`, {
          version: root.version,
          dependencyId: follower.id,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await request("PATCH", `/api/projects/${id}/tasks/${follower.id}`, {
          version: linked.version,
          status: "in_progress",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await request("PATCH", `/api/projects/${id}/tasks/${follower.id}`, {
          version: linked.version,
          status: "done",
          helpReason: null,
          evidence: "Ссылка на содержательный результат.",
        })
      ).statusCode,
      409,
    );
    const proposal = (
      await request("POST", `/api/projects/${id}/allocations`, {
        milestoneId: s.milestone.id,
      })
    ).json<Allocation>();
    await request("PUT", "/api/me/availability", {
      weekStart: s.milestone.weekStart,
      hours: 11,
      skills: ["Backend", "Архитектура"],
    });
    assert.equal(
      (
        await request(
          "POST",
          `/api/projects/${id}/allocations/${proposal.id}/approve`,
        )
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
    await db.close();
  }
});

test("a changed commitment in another project invalidates the same-week allocation", async () => {
  const db = await createDatabase("memory://");
  const app = await createApp(db, { demo: true });
  try {
    const login = await app.inject({ method: "POST", url: "/api/auth/demo" });
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const request = (
      method: "GET" | "POST" | "PATCH",
      url: string,
      payload?: Record<string, unknown>,
    ) => app.inject({ method, url, headers: { cookie }, payload });
    const w = (await request("GET", "/api/workspace")).json<Workspace>();
    const project = w.projects.find((p) => p.course === "ISE4133")!,
      other = w.projects.find((p) => p.id !== project.id)!;
    const state = (
      await request("GET", `/api/projects/${project.id}/state`)
    ).json<ProjectState>();
    const otherState = (
      await request("GET", `/api/projects/${other.id}/state`)
    ).json<ProjectState>();
    const proposal = (
      await request("POST", `/api/projects/${project.id}/allocations`, {
        milestoneId: state.milestone.id,
      })
    ).json<Allocation>();
    const created = await request("POST", `/api/projects/${other.id}/tasks`, {
      milestoneId: otherState.milestone.id,
      title: "Проверить запросы",
      goal: "Проверка базы",
      firstStep: "Открыть SQL-файл",
      deliverable: "Проверенные запросы",
      estimate: 3,
      skill: "Backend",
    });
    assert.equal(created.statusCode, 200);
    const task = (
      await request("GET", `/api/projects/${other.id}/state`)
    ).json<ProjectState>().tasks[0];
    assert.equal(
      (
        await request("PATCH", `/api/projects/${other.id}/tasks/${task.id}`, {
          version: task.version,
          assigneeId: w.user.id,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await request("PATCH", `/api/projects/${other.id}/tasks/${task.id}`, {
          version: task.version,
          assigneeId: w.user.id,
          override: true,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await request(
          "POST",
          `/api/projects/${project.id}/allocations/${proposal.id}/approve`,
        )
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
    await db.close();
  }
});

test("accounts, sessions, and saved tasks survive closing and reopening on-disk PostgreSQL", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fairshare-persistence-"));
  let db = await createDatabase(dir);
  let app = await createApp(db, { demo: false });
  try {
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Проверка Сохранения",
        email: "persistence@university.edu",
        password: "durable-password-2026",
        teamName: "Постоянная команда",
      },
    });
    assert.equal(signup.statusCode, 200);
    const cookie = String(signup.headers["set-cookie"]).split(";")[0];
    const w = (
      await app.inject({
        method: "GET",
        url: "/api/workspace",
        headers: { cookie },
      })
    ).json<Workspace>();
    const id = w.projects[0].id;
    const s = (
      await app.inject({
        method: "GET",
        url: `/api/projects/${id}/state`,
        headers: { cookie },
      })
    ).json<ProjectState>();
    const created = await app.inject({
      method: "POST",
      url: `/api/projects/${id}/tasks`,
      headers: { cookie },
      payload: {
        milestoneId: s.milestone.id,
        title: "Сохранённая задача",
        goal: "Проверить сохранение",
        firstStep: "Перезапустить сервер",
        deliverable: "Задача доступна после запуска",
        estimate: 2,
        skill: "Любой навык",
      },
    });
    assert.equal(created.statusCode, 200);
    await app.close();
    await db.close();
    db = await createDatabase(dir);
    app = await createApp(db, { demo: false });
    const session = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: { cookie },
    });
    assert.equal(session.json().user.id, w.user.id);
    const persisted = await app.inject({
      method: "GET",
      url: `/api/projects/${id}/state`,
      headers: { cookie },
    });
    assert.equal(
      persisted.json<ProjectState>().tasks[0].title,
      "Сохранённая задача",
    );
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/auth/demo" })).statusCode,
      404,
    );
  } finally {
    await app.close();
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
