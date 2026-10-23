import { test as base, expect } from "@playwright/test";
import { createDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
const test = base.extend<{ appUrl: string }>({
  appUrl: async ({}, use) => {
    const db = await createDatabase("memory://");
    const app = await createApp(db, { demo: true });
    try {
      const url = await app.listen({ host: "127.0.0.1", port: 0 });
      await use(url);
    } finally {
      await app.close();
      await db.close();
    }
  },
});
test("desktop: allocation, task context, help, discussion and checklist", async ({
  page,
  appUrl,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Открыть демо" }).click();
  await expect(
    page.getByRole("heading", { name: "Первый рабочий прототип" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Распределить задачи" }).click();
  const allocation = page.getByRole("dialog", { name: "Распределение задач" });
  await expect(allocation).toBeVisible();
  await allocation
    .getByRole("button", { name: "Принять распределение" })
    .click();
  await expect(allocation).not.toBeVisible();
  await page.getByRole("button", { name: /Продумать архитектуру/ }).click();
  const task = page.getByRole("dialog", { name: "Задача" });
  await expect(task.getByLabel("Первый конкретный шаг")).not.toHaveValue("");
  // Quick estimation poker vote inside task dialog
  await task.getByRole("button", { name: "3 ч", exact: true }).click();
  await expect(task).not.toBeVisible();
  await expect(page.getByText("Оценка команды: 3 ч")).toBeVisible();

  await page.getByRole("button", { name: /Продумать архитектуру/ }).click();
  await task.getByRole("button", { name: "Обсуждение и шаги" }).click();
  await task
    .getByLabel("Новый пункт чек-листа")
    .fill("Проверить границы модулей");
  await task.getByRole("button", { name: "Добавить", exact: true }).click();
  // The controlled checkbox changes only after the API response and reload.
  await task.getByLabel("Проверить границы модулей").click();
  await expect(task.getByLabel("Проверить границы модулей")).toBeChecked();
  await task
    .getByLabel("Ваш комментарий")
    .fill("Нужен пример структуры, чтобы согласовать границы модулей.");
  await task.getByRole("button", { name: "Отправить" }).click();
  await expect(
    task.getByText(
      "Нужен пример структуры, чтобы согласовать границы модулей.",
    ),
  ).toBeVisible();
  await task.getByRole("button", { name: "Контекст и результат" }).click();
  await task.getByRole("button", { name: "Нужна помощь", exact: true }).click();
  await expect(task).not.toBeVisible();
  await expect(
    page.getByText("Ерасыл: Нужна помощь с первым шагом."),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Нагрузка", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("registration, one-time invitation, shared decisions and participant permissions", async ({
  page,
  browser,
  appUrl,
}) => {
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Открыть демо" }).click();
  await page.getByRole("button", { name: "Пригласить", exact: true }).click();
  const invite = page.getByRole("dialog", { name: "Приглашение в команду" });
  await invite.getByRole("button", { name: "Создать ссылку" }).click();
  const link = await invite.getByLabel("Ссылка", { exact: true }).inputValue();
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    await other.goto(link);
    await other
      .getByRole("button", { name: "Регистрация", exact: true })
      .click();
    await other.getByLabel("Ваше имя").fill("Новый Участник");
    await other.getByLabel("Название команды").fill("Личная учебная команда");
    await other
      .getByLabel("Email", { exact: true })
      .fill("member@university.edu");
    await other
      .getByLabel("Пароль", { exact: true })
      .fill("member-password-2026");
    await other.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(
      other.getByRole("heading", { name: "Первый рабочий прототип" }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", { name: "Распределить задачи" }),
    ).toBeDisabled();
    // Claim the task that has a help request ("Подготовить презентацию")
    await other
      .getByRole("button", { name: "Перехватить и помочь" })
      .first()
      .click();
    await expect(other.getByText("Вы перехватили задачу")).toBeVisible();
    await other.getByRole("tab", { name: "Команда", exact: true }).click();
    await other.getByRole("button", { name: "Предложить решение" }).click();
    const decision = other.getByRole("dialog", { name: "Предложить решение" });
    await decision.getByLabel("Предложение").fill("Провести взаимную проверку");
    await decision
      .getByLabel("Контекст и аргументы")
      .fill(
        "Сначала проверим результаты друг друга, затем соберём презентацию.",
      );
    await decision
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(decision).not.toBeVisible();
    await other.getByRole("button", { name: "За · 0" }).click();
    await expect(other.getByRole("button", { name: "За · 1" })).toBeVisible();
    await invite.getByRole("button", { name: "Закрыть", exact: true }).click();
    await page.getByRole("tab", { name: "Команда", exact: true }).click();
    await expect(
      page.getByText("Провести взаимную проверку", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Принять", exact: true }).click();
    await expect(page.getByText("Новый Участник · Принято")).toBeVisible();
  } finally {
    await context.close();
  }
});
test("mobile: usable board, navigation, availability, and keyboard dialog dismissal", async ({
  page,
  appUrl,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Открыть демо" }).click();
  await expect(
    page.getByRole("heading", { name: "Первый рабочий прототип" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("button", { name: "Как это работает", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Команда", exact: true }).click();
  await page.getByRole("button", { name: "Моя доступность" }).click();
  await page.getByLabel("Доступно часов").fill("10");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Нагрузка", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Общий план на неделю" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
