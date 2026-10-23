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
test("password change: mobile form, validation, other-session revocation and new login", async ({
  page,
  browser,
  appUrl,
}) => {
  const oldPassword = "my original long password";
  const newPassword = "my replacement long password";
  const email = "password@university.edu";
  const account = await page.request.post(appUrl + "/api/auth/register", {
    data: {
      email,
      password: oldPassword,
      name: "Владелец Аккаунта",
      teamName: "Команда",
    },
  });
  expect(account.ok()).toBeTruthy();
  const other = await browser.newContext();
  try {
    const login = await other.request.post(appUrl + "/api/auth/login", {
      data: { email, password: oldPassword },
    });
    expect(login.ok()).toBeTruthy();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(appUrl);
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await page
      .getByRole("button", { name: "Сменить пароль", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Сменить пароль" });
    await dialog.getByLabel("Текущий пароль", { exact: true }).fill("wrong");
    await dialog.getByLabel("Новый пароль", { exact: true }).fill(newPassword);
    await dialog
      .getByLabel("Повторите новый пароль", { exact: true })
      .fill("different");
    await dialog.getByRole("button", { name: "Сохранить пароль" }).click();
    await expect(dialog.getByText("Пароли не совпадают.")).toBeVisible();
    await expect(
      dialog.getByLabel("Повторите новый пароль", { exact: true }),
    ).toBeFocused();
    await dialog
      .getByLabel("Повторите новый пароль", { exact: true })
      .fill(newPassword);
    await dialog.getByRole("button", { name: "Сохранить пароль" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Текущий пароль указан неверно",
    );
    await dialog
      .getByLabel("Текущий пароль", { exact: true })
      .fill(oldPassword);
    await dialog
      .getByRole("button", { name: "Показать: новый пароль" })
      .click();
    await expect(
      dialog.getByLabel("Новый пароль", { exact: true }),
    ).toHaveAttribute("type", "text");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "test-results/change-password-mobile.png",
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Сохранить пароль" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("status")).toContainText("Пароль изменён");
    expect(
      (await (await other.request.get(appUrl + "/api/auth/session")).json())
        .user,
    ).toBeNull();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Первый этап", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(oldPassword);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Неверный email или пароль",
    );
    await page.getByLabel("Пароль", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Первый этап", exact: true }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});
test("auth: clear validation, preserved email, password visibility and login lifecycle", async ({
  page,
  appUrl,
}) => {
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Проверьте выделенные поля",
  );
  await expect(page.locator("#auth-name")).toBeFocused();
  await expect(page.locator("#auth-name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Ваше имя").fill("Алиса Иванова");
  await page.getByLabel("Название команды").fill("Команда Алисы");
  await page.locator("#auth-email").fill("alice@university.edu");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("four words for a password");
  await page.getByRole("button", { name: "Показать пароль" }).click();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  await expect(page.locator("#auth-email")).toHaveValue("alice@university.edu");
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await expect(page.getByLabel("Ваше имя")).toHaveValue("Алиса Иванова");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("four words for a password");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Первый этап", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Первый этап", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("alice@university.edu");
  await page.getByLabel("Пароль", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Неверный email или пароль",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "alice@university.edu",
  );
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("four words for a password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Первый этап", exact: true }),
  ).toBeVisible();
});

test("auth: mobile form and recoverable connection failure", async ({
  page,
  appUrl,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await page.getByLabel("Ваше имя").fill("Мобильный Участник");
  await page.getByLabel("Название команды").fill("Новая команда");
  await page.getByLabel("Email", { exact: true }).fill("mobile@university.edu");
  await page.getByLabel("Пароль", { exact: true }).fill("long mobile password");
  await page.route("**/api/auth/register", (route) =>
    route.abort("internetdisconnected"),
  );
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Нет соединения с сервером",
  );
  await expect(page.getByLabel("Ваше имя")).toHaveValue("Мобильный Участник");
  await expect(
    page.getByRole("button", { name: "Создать аккаунт", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/auth-mobile.png",
    fullPage: true,
  });
  await page.unroute("**/api/auth/register");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Первый этап", exact: true }),
  ).toBeVisible();
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
    await expect(other.getByLabel("Название команды")).toHaveCount(0);
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
