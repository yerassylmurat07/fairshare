import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.js";
import { createDatabase } from "./db.js";
import type { ProjectState, Allocation } from "../shared/types.js";
test("MVP lifecycle, collaboration, tenant isolation, conflicts and session logout", async () => {
  const db = await createDatabase("memory://");
  const app = await createApp(db, { demo: true });
  const req = (
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    cookie?: string,
    payload?: Record<string, unknown>,
  ) => app.inject({ method, url, headers: cookie ? { cookie } : {}, payload });
  try {
    assert.equal((await req("GET", "/api/workspace")).statusCode, 401);
    const demo = await req("POST", "/api/auth/demo");
    assert.equal(demo.statusCode, 200);
    const cookie = String(demo.headers["set-cookie"]).split(";")[0];
    assert.match(String(demo.headers["set-cookie"]), /HttpOnly/);
    const w = (await req("GET", "/api/workspace", cookie)).json();
    const project = w.projects.find(
      (p: { course: string }) => p.course === "ISE4133",
    );
    let s: ProjectState = (
      await req("GET", `/api/projects/${project.id}/state`, cookie)
    ).json();
    assert.equal(s.tasks.length, 6);
    assert.equal(
      s.members.reduce((v, m) => v + m.load, 0),
      20,
    );
    const suggest = async () =>
      (
        await req("POST", `/api/projects/${project.id}/allocations`, cookie, {
          milestoneId: s.milestone.id,
        })
      ).json<Allocation>();
    let allocation = await suggest();
    assert.equal(allocation.assignments.length, 3);
    assert.ok(allocation.loads.every((m) => m.after <= m.capacity));
    const task = s.tasks.find((t) => t.status === "planned")!;
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/tasks/${task.id}`,
          cookie,
          { version: task.version, title: "Новая архитектура" },
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/allocations/${allocation.id}/approve`,
          cookie,
        )
      ).statusCode,
      409,
    );
    allocation = await suggest();
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/allocations/${allocation.id}/approve`,
          cookie,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/allocations/${allocation.id}/approve`,
          cookie,
        )
      ).statusCode,
      200,
    );
    s = (await req("GET", `/api/projects/${project.id}/state`, cookie)).json();
    const assigned = s.tasks.find((t) => t.id === task.id)!;
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/tasks/${task.id}`,
          cookie,
          { version: task.version, status: "in_progress" },
        )
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/tasks/${task.id}`,
          cookie,
          { version: assigned.version, status: "done" },
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/tasks/${task.id}`,
          cookie,
          {
            version: assigned.version,
            status: "in_progress",
            helpReason: "Нужен пример структуры.",
          },
        )
      ).statusCode,
      200,
    );
    s = (await req("GET", `/api/projects/${project.id}/state`, cookie)).json();
    const progress = s.tasks.find((t) => t.id === task.id)!;
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/tasks/${task.id}`,
          cookie,
          {
            version: progress.version,
            status: "done",
            helpReason: null,
            evidence: "Подготовлен документ с архитектурой и примерами.",
          },
        )
      ).statusCode,
      200,
    );
    const outsider = await req("POST", "/api/auth/register", undefined, {
      email: "test@university.edu",
      password: "strong-password-123",
      name: "Тест Участник",
      teamName: "Другая команда",
    });
    assert.equal(outsider.statusCode, 200);
    const other = String(outsider.headers["set-cookie"]).split(";")[0];
    assert.equal(
      (await req("GET", `/api/projects/${project.id}/state`, other)).statusCode,
      404,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/tasks/${task.id}/comments`,
          other,
          { body: "cross-team" },
        )
      ).statusCode,
      404,
    );
    const invitation = (
      await req("POST", `/api/projects/${project.id}/invitations`, cookie)
    ).json();
    assert.equal(
      (
        await req("POST", "/api/invitations/accept", other, {
          token: invitation.token,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req("POST", "/api/invitations/accept", other, {
          token: invitation.token,
        })
      ).statusCode,
      410,
    );
    assert.equal(
      (await req("GET", `/api/projects/${project.id}/state`, other)).statusCode,
      200,
    );
    assert.equal(
      (
        await req("POST", `/api/projects/${project.id}/allocations`, other, {
          milestoneId: s.milestone.id,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/tasks/${task.id}/comments`,
          other,
          { body: "Посмотрел структуру, предлагаю добавить описание модулей." },
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/tasks/${task.id}/checklist`,
          other,
          { title: "Проверить связи модулей" },
        )
      ).statusCode,
      200,
    );
    const discussion = (
      await req(
        "GET",
        `/api/projects/${project.id}/tasks/${task.id}/discussion`,
        cookie,
      )
    ).json();
    assert.equal(discussion.comments.length, 1);
    assert.equal(discussion.checklist.length, 1);
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/tasks/${task.id}/checklist/${discussion.checklist[0].id}`,
          other,
          { done: true },
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req("POST", `/api/projects/${project.id}/resources`, other, {
          title: "Требования",
          url: "javascript:alert(1)",
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await req("POST", `/api/projects/${project.id}/resources`, other, {
          title: "Требования",
          url: "https://example.com/brief",
        })
      ).statusCode,
      200,
    );
    await req("POST", `/api/projects/${project.id}/decisions`, other, {
      title: "Использовать PostgreSQL",
      context: "Транзакции упрощают согласование распределения.",
    });
    const collaboration = (
      await req("GET", `/api/projects/${project.id}/collaboration`, cookie)
    ).json();
    const decision = collaboration.decisions[0];
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/decisions/${decision.id}/vote`,
          other,
          { choice: "yes" },
        )
      ).statusCode,
      200,
    );
    await req(
      "POST",
      `/api/projects/${project.id}/decisions/${decision.id}/vote`,
      other,
      { choice: "no" },
    );
    const voted = (
      await req("GET", `/api/projects/${project.id}/collaboration`, other)
    ).json();
    assert.equal(voted.decisions[0].yes, 0);
    assert.equal(voted.decisions[0].no, 1);
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/decisions/${decision.id}`,
          other,
          { status: "accepted" },
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await req(
          "PATCH",
          `/api/projects/${project.id}/decisions/${decision.id}`,
          cookie,
          { status: "accepted" },
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/decisions/${decision.id}/vote`,
          other,
          { choice: "yes" },
        )
      ).statusCode,
      409,
    );
    const csrf = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/resources`,
      headers: {
        cookie,
        origin: "https://other.example",
        "sec-fetch-site": "cross-site",
      },
      payload: { title: "Injected", url: "https://example.com" },
    });
    assert.equal(csrf.statusCode, 403);
    assert.equal(
      (await req("GET", `/api/projects/${randomUUID()}/state`, cookie))
        .statusCode,
      404,
    );
    await req("POST", "/api/auth/logout", cookie);
    assert.equal((await req("GET", "/api/workspace", cookie)).statusCode, 401);
  } finally {
    await app.close();
    await db.close();
  }
});
