import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./db.js";
import type { MilestoneTemplate } from "../shared/types.js";
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

export const milestoneTemplates: MilestoneTemplate[] = [
  {
    id: "m1-vision",
    name: "M1: Видение продукта и исследование",
    description:
      "Формулировка проблемы, разбор альтернатив, ключевые гипотезы и план первой проверки.",
    tasks: [
      {
        title: "Зафиксировать проблему и целевую аудиторию",
        goal: "Чётко описать, кто сталкивается с проблемой и почему текущие решения не работают.",
        firstStep:
          "Выпишите 3 конкретных наблюдения из прошлых командных проектов.",
        deliverable: "Раздел «Проблема и аудитория» в документе видения.",
        estimate: 2,
        skill: "Документация",
        checklist: [
          "Описать целевого пользователя и контекст",
          "Собрать реальные примеры сбоев координации",
          "Согласовать формулировку с командой",
        ],
      },
      {
        title: "Провести разбор существующих инструментов",
        goal: "Показать, почему чаты и обычные доски задач не решают проблему.",
        firstStep:
          "Составьте таблицу сравнения Telegram, Trello и Google Docs по 4 критериям.",
        deliverable: "Таблица сравнительного анализа с выводами.",
        estimate: 2,
        skill: "Документация",
        checklist: [
          "Проверить сценарий старта задачи в Trello",
          "Описать потери контекста в групповых чатах",
        ],
      },
      {
        title: "Сформулировать рискованные гипотезы и метрики",
        goal: "Определить, какие допущения нужно проверить в первую очередь.",
        firstStep:
          "Запишите 3 гипотезы в формате: допущение → риск → способ проверки.",
        deliverable: "Таблица гипотез H1–H3 с критериями подтверждения.",
        estimate: 2.5,
        skill: "Тестирование",
        checklist: [
          "Определить самую рискованную гипотезу (H1)",
          "Задать проверяемый порог времени старта (48 ч)",
        ],
      },
      {
        title: "Спроектировать границы первого MVP",
        goal: "Отделить необходимые функции первой версии от второстепенных интеграций.",
        firstStep:
          "Перечислите 3 главные функции MVP и 3 исключённые возможности.",
        deliverable: "Спецификация границ MVP и пользовательского сценария.",
        estimate: 3,
        skill: "Архитектура",
        checklist: [
          "Описать основной путь пользователя от этапа до результата",
          "Исключить сложные внешние интеграции на старте",
        ],
      },
    ],
  },
  {
    id: "m2-prototype",
    name: "M2: Архитектура и рабочий прототип",
    description:
      "Модель данных, серверное API, алгоритм распределения, клиентский интерфейс и автотесты.",
    tasks: [
      {
        title: "Спроектировать схему БД и инварианты",
        goal: "Обеспечить целостность команд, этапов, задач и сессий на уровне PostgreSQL.",
        firstStep:
          "Опишите таблицы users, teams, projects, milestones и tasks в schema.sql.",
        deliverable: "Исполняемая SQL-схема с внешними ключами и индексами.",
        estimate: 3,
        skill: "Базы данных",
        checklist: [
          "Добавить ограничения CHECK для часов и статусов",
          "Проверить уникальность лидера команды",
        ],
      },
      {
        title: "Реализовать доменный алгоритм и API маршруты",
        goal: "Создать объяснимое распределение задач и транзакционное утверждение плана.",
        firstStep:
          "Напишите чистую функцию propose() и покройте её модульными тестами.",
        deliverable: "Маршруты Fastify и проходящие интеграционные тесты.",
        estimate: 5,
        skill: "Backend",
        checklist: [
          "Учесть нагрузку во всех активных проектах недели",
          "Добавить защиту от гонок через SELECT ... FOR UPDATE",
        ],
      },
      {
        title: "Собрать интерактивную доску и диалоги задач",
        goal: "Дать участникам понятный интерфейс с первым шагом, чек-листом и кнопкой помощи.",
        firstStep:
          "Создайте компоненты Board и TaskDialog с подключением к /api/projects/:id/state.",
        deliverable: "Адаптивный интерфейс React без горизонтальной прокрутки.",
        estimate: 5,
        skill: "Frontend",
        checklist: [
          "Проверить работу с клавиатуры и закрытие по Escape",
          "Отобразить индикаторы перегрузки и блокеров",
        ],
      },
      {
        title: "Настроить сквозные проверки и документацию",
        goal: "Подтвердить работоспособность ключевых сценариев перед показом.",
        firstStep:
          "Запустите npm test и добавьте сценарий проверки прав участника.",
        deliverable: "Зелёный прогон тестов и актуальный архитектурный документ.",
        estimate: 3,
        skill: "Тестирование",
        checklist: [
          "Проверить изоляцию чужих команд (404/403)",
          "Проверить запрет завершения задачи без описания результата",
        ],
      },
    ],
  },
  {
    id: "m3-pilot",
    name: "M3: Пилотное тестирование и защита",
    description:
      "Проверка понятности первого шага на студенческих командах, сбор фактов и итоговая демонстрация.",
    tasks: [
      {
        title: "Подготовить протокол и задания для пилота",
        goal: "Проверить, могут ли участники начать работу без дополнительных объяснений лидера.",
        firstStep:
          "Составьте сценарий 5-минутного онбординга и 3 контрольных вопроса.",
        deliverable: "Готовый чек-лист проведения теста для 2 команд.",
        estimate: 2.5,
        skill: "Тестирование",
        checklist: [
          "Проверить время создания первой задачи (< 3 минут)",
          "Подготовить форму фиксации вопросов к координатору",
        ],
      },
      {
        title: "Устранить интерфейсные шероховатости по итогам прогона",
        goal: "Убрать препятствия, мешающие быстрому перехвату задач и оценке часов.",
        firstStep:
          "Проверьте сценарий «Нужна помощь» и перехват задачи на мобильном экране.",
        deliverable: "Исправленный билд и обновлённые E2E-проверки.",
        estimate: 3.5,
        skill: "Frontend",
        checklist: [
          "Проверить читаемость карточек на узком экране (390px)",
          "Убедиться в понятности текстов ошибок",
        ],
      },
      {
        title: "Собрать итоговую презентацию и демо-стенд",
        goal: "Наглядно показать путь от проблемы к работающему продукту и результатам проверки.",
        firstStep:
          "Проверьте доступность продакшен-сервера и подготовьте 2 аккаунта для живого показа.",
        deliverable: "Слайды защиты и сценарий живой демонстрации на 5 минут.",
        estimate: 2,
        skill: "Документация",
        checklist: [
          "Показать распределение с учётом навыков и зон роста",
          "Продемонстрировать запрос помощи и завершение с артефактом",
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

async function applyMilestoneTemplate(
  tx: Sql,
  projectId: string,
  milestoneId: string,
  userId: string,
  templateId: string,
) {
  const tpl = milestoneTemplates.find((t) => t.id === templateId);
  if (!tpl) throw new HttpError(400, "Шаблон этапа не найден.");
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
          templateId: z.string().trim().max(60).optional(),
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
        ...new Set(data.skills.filter((s) => s !== "Любой навык")),
      ];
      const learning = [
        ...new Set(
          data.learningSkills.filter(
            (s) => s !== "Любой навык" && !confident.includes(s),
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
