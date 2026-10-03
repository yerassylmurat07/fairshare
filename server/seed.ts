import { randomUUID } from "node:crypto";
import type { Database } from "./db.js";
import { currentWeek, weekEnd, passwordHash, initials } from "./security.js";
export const DEMO_EMAIL = "yerassyl@fairshare.demo";
export async function seed(db: Database) {
  const password = await passwordHash("FairShare-demo-2026!");
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(4133002)");
    const existing = await tx.query("SELECT id FROM users WHERE email=$1", [
      DEMO_EMAIL,
    ]);
    if (existing.rows.length) return;
    const team = randomUUID(),
      project = randomUUID(),
      milestone = randomUUID(),
      second = randomUUID();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const profiles = [
      ["Ерасыл Мурат", DEMO_EMAIL, "#7056e8", ["Архитектура", "Backend"], 12],
      [
        "Суусар Турсунбекова",
        "suusar@fairshare.demo",
        "#7f71d6",
        ["Frontend", "Тестирование"],
        8,
      ],
      [
        "Сезим Камчиева",
        "sezim@fairshare.demo",
        "#afa0df",
        ["Документация", "Базы данных"],
        6,
      ],
    ] as const;
    await tx.query("INSERT INTO teams(id,name) VALUES($1,$2)", [
      team,
      "Team FairShare",
    ]);
    for (let i = 0; i < profiles.length; i++) {
      const [name, email, color, skills, hours] = profiles[i];
      await tx.query(
        "INSERT INTO users(id,name,email,password_hash,initials,color,skills) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [ids[i], name, email, password, initials(name), color, [...skills]],
      );
      await tx.query(
        "INSERT INTO memberships(team_id,user_id,role) VALUES($1,$2,$3)",
        [team, ids[i], i === 0 ? "leader" : "member"],
      );
      await tx.query(
        "INSERT INTO availability(user_id,week_start,hours) VALUES($1,$2,$3)",
        [ids[i], currentWeek(), hours],
      );
    }
    await tx.query(
      "INSERT INTO projects(id,team_id,name,course) VALUES($1,$2,$3,$4)",
      [project, team, "Инженерия ПО", "ISE4133"],
    );
    await tx.query(
      "INSERT INTO milestones(id,project_id,title,due_date,week_start) VALUES($1,$2,$3,$4,$5)",
      [
        milestone,
        project,
        "Первый рабочий прототип",
        weekEnd(currentWeek()),
        currentWeek(),
      ],
    );
    await tx.query(
      "INSERT INTO projects(id,team_id,name,course) VALUES($1,$2,$3,$4)",
      [second, team, "Базы данных", "CS Database"],
    );
    await tx.query(
      "INSERT INTO milestones(id,project_id,title,due_date,week_start) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        second,
        "Схема учебного проекта",
        weekEnd(currentWeek()),
        currentWeek(),
      ],
    );
    const tasks = [
      [
        "Продумать архитектуру",
        "Модули, связи и границы системы",
        "Откройте README проекта и нарисуйте три основных модуля.",
        "Схема архитектуры и объяснение решений.",
        4,
        "Архитектура",
        0,
        "planned",
        null,
      ],
      [
        "Реализовать API",
        "Маршруты для проектов и задач",
        "Создайте GET /projects и проверьте ответ в браузере.",
        "Рабочие маршруты и примеры запросов.",
        6,
        "Backend",
        0,
        "planned",
        null,
      ],
      [
        "Подготовить тесты",
        "Проверить основной сценарий",
        "Запишите сценарий: создать задачу → распределить → завершить.",
        "Тесты основного сценария и ошибок.",
        3,
        "Тестирование",
        1,
        "planned",
        null,
      ],
      [
        "Собрать интерфейс",
        "Доска задач и экран нагрузки",
        "Создайте компонент TaskCard и подключите данные API.",
        "Рабочая доска с тремя статусами.",
        5,
        "Frontend",
        1,
        "in_progress",
        null,
      ],
      [
        "Подготовить презентацию",
        "Показать сценарий команды",
        "Создайте первый слайд: пользователь, проблема, решение.",
        "Презентация с демонстрацией продукта.",
        2,
        "Документация",
        2,
        "in_progress",
        "нужен пример структуры презентации.",
      ],
      [
        "Спроектировать базу",
        "Сущности и ограничения данных",
        "Перечислите сущности User, Team, Project и Task.",
        "ER-диаграмма и SQL-схема.",
        2,
        "Базы данных",
        2,
        "done",
        null,
      ],
    ];
    for (const t of tasks)
      await tx.query(
        "INSERT INTO tasks(id,project_id,milestone_id,title,goal,first_step,deliverable,estimate,skill,assignee_id,status,help_reason,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [
          randomUUID(),
          project,
          milestone,
          t[0],
          t[1],
          t[2],
          t[3],
          t[4],
          t[5],
          ids[Number(t[6])],
          t[7],
          t[8],
          t[7] === "done"
            ? "Учебный пример: ER-диаграмма и схема данных подготовлены."
            : "",
        ],
      );
  });
}
