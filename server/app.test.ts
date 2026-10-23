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

    // 1. Starter templates on new milestone
    const templatesRes = (await req("GET", "/api/templates", cookie)).json<{
      templates: { id: string; tasks: unknown[] }[];
    }>();
    assert.ok(templatesRes.templates.length >= 3);
    const createdMs = (
      await req("POST", `/api/projects/${project.id}/milestones`, cookie, {
        title: "Этап из шаблона",
        weekStart: s.milestone.weekStart,
        dueDate: s.milestone.dueDate,
        templateId: "m1-vision",
      })
    ).json<{ id: string }>();
    const msState = (
      await req(
        "GET",
        `/api/projects/${project.id}/state?milestoneId=${createdMs.id}`,
        cookie,
      )
    ).json<ProjectState>();
    assert.equal(msState.tasks.length, 4);
    assert.ok((msState.tasks[0].checklistTotal || 0) >= 2);

    // 2. Micro-estimation poker & spread detection
    const pokerTask = msState.tasks[0];
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/tasks/${pokerTask.id}/estimates`,
          cookie,
          { hours: 2 },
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/tasks/${pokerTask.id}/estimates`,
          other,
          { hours: 6 },
        )
      ).statusCode,
      200,
    );
    const afterVotes = (
      await req(
        "GET",
        `/api/projects/${project.id}/state?milestoneId=${createdMs.id}`,
        cookie,
      )
    ).json<ProjectState>();
    const votedTask = afterVotes.tasks.find((t) => t.id === pokerTask.id)!;
    assert.equal(votedTask.estimateSummary?.count, 2);
    assert.equal(votedTask.estimateSummary?.median, 4);
    assert.equal(votedTask.estimateSummary?.spreadWarning, true);

    // 3. Learning skills + One-click claim of blocked/unassigned task
    assert.equal(
      (
        await req("PUT", "/api/me/availability", other, {
          weekStart: s.milestone.weekStart,
          hours: 10,
          skills: ["Документация"],
          learningSkills: ["Архитектура"],
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await req(
          "POST",
          `/api/projects/${project.id}/tasks/${pokerTask.id}/claim`,
          other,
          { version: votedTask.version },
        )
      ).statusCode,
      200,
    );
    const afterClaim = (
      await req(
        "GET",
        `/api/projects/${project.id}/state?milestoneId=${createdMs.id}`,
        other,
      )
    ).json<ProjectState>();
    const claimedTask = afterClaim.tasks.find((t) => t.id === pokerTask.id)!;
    assert.ok(claimedTask.assigneeId);

    // 4. Stale-start detection (>24h in_progress without checklist or evidence)
    await db.query(
      "UPDATE tasks SET status='in_progress', started_at=now()-interval '26 hours', evidence='', help_reason=NULL WHERE id=$1",
      [claimedTask.id],
    );
    const staleCheck = (
      await req(
        "GET",
        `/api/projects/${project.id}/state?milestoneId=${createdMs.id}`,
        other,
      )
    ).json<ProjectState>();
    assert.equal(
      staleCheck.tasks.find((t) => t.id === claimedTask.id)?.staleStart,
      true,
    );

    await req("POST", "/api/auth/logout", cookie);
    assert.equal((await req("GET", "/api/workspace", cookie)).statusCode, 401);
  } finally {
    await app.close();
    await db.close();
  }
});
