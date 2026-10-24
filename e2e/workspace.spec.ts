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
      name: "Account Owner",
      teamName: "Team",
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
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Change password" });
    await dialog.getByLabel("Current password", { exact: true }).fill("wrong");
    await dialog.getByLabel("New password", { exact: true }).fill(newPassword);
    await dialog
      .getByLabel("Repeat new password", { exact: true })
      .fill("different");
    await dialog.getByRole("button", { name: "Save password" }).click();
    await expect(dialog.getByText("The passwords do not match.")).toBeVisible();
    await expect(
      dialog.getByLabel("Repeat new password", { exact: true }),
    ).toBeFocused();
    await dialog
      .getByLabel("Repeat new password", { exact: true })
      .fill(newPassword);
    await dialog.getByRole("button", { name: "Save password" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "The current password is incorrect",
    );
    await dialog
      .getByLabel("Current password", { exact: true })
      .fill(oldPassword);
    await dialog.getByRole("button", { name: "Show: new password" }).click();
    await expect(
      dialog.getByLabel("New password", { exact: true }),
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
    await dialog.getByRole("button", { name: "Save password" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("status")).toContainText("Password changed");
    expect(
      (await (await other.request.get(appUrl + "/api/auth/session")).json())
        .user,
    ).toBeNull();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "First milestone", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(oldPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Incorrect email or password",
    );
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "First milestone", exact: true }),
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
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Check the highlighted fields",
  );
  await expect(page.locator("#auth-name")).toBeFocused();
  await expect(page.locator("#auth-name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Your name").fill("Alice Ivanova");
  await page.getByLabel("Team name").fill("Alice's Team");
  await page.locator("#auth-email").fill("alice@university.edu");
  await page
    .getByLabel("Password", { exact: true })
    .fill("four words for a password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator("#auth-email")).toHaveValue("alice@university.edu");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Alice Ivanova");
  await page
    .getByLabel("Password", { exact: true })
    .fill("four words for a password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First milestone", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "First milestone", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("alice@university.edu");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Incorrect email or password",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "alice@university.edu",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("four words for a password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "First milestone", exact: true }),
  ).toBeVisible();
});

test("auth: mobile form and recoverable connection failure", async ({
  page,
  appUrl,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Your name").fill("Mobile Member");
  await page.getByLabel("Team name").fill("New team");
  await page.getByLabel("Email", { exact: true }).fill("mobile@university.edu");
  await page
    .getByLabel("Password", { exact: true })
    .fill("long mobile password");
  await page.route("**/api/auth/register", (route) =>
    route.abort("internetdisconnected"),
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "No connection to the server",
  );
  await expect(page.getByLabel("Your name")).toHaveValue("Mobile Member");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
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
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First milestone", exact: true }),
  ).toBeVisible();
});
test("desktop: allocation, task context, help, discussion and checklist", async ({
  page,
  appUrl,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Open demo" }).click();
  await expect(
    page.getByRole("heading", { name: "First working prototype" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allocate tasks" }).click();
  const allocation = page.getByRole("dialog", { name: "Task allocation" });
  await expect(allocation).toBeVisible();
  await allocation.getByRole("button", { name: "Approve allocation" }).click();
  await expect(allocation).not.toBeVisible();
  await page.getByRole("button", { name: /Plan the architecture/ }).click();
  const task = page.getByRole("dialog", { name: "Task" });
  await expect(task.getByLabel("First concrete step")).not.toHaveValue("");
  // Quick estimation poker vote inside task dialog
  await task.getByRole("button", { name: "3 h", exact: true }).click();
  await expect(task).not.toBeVisible();
  await expect(page.getByText("Team estimate: 3 h")).toBeVisible();

  await page.getByRole("button", { name: /Plan the architecture/ }).click();
  await task.getByRole("button", { name: "Discussion and steps" }).click();
  await task.getByLabel("New checklist item").fill("Check module boundaries");
  await task.getByRole("button", { name: "Add", exact: true }).click();
  // The controlled checkbox changes only after the API response and reload.
  await task.getByLabel("Check module boundaries").click();
  await expect(task.getByLabel("Check module boundaries")).toBeChecked();
  await task
    .getByLabel("Your comment")
    .fill("I need an example structure to agree on module boundaries.");
  await task.getByRole("button", { name: "Send" }).click();
  await expect(
    task.getByText(
      "I need an example structure to agree on module boundaries.",
    ),
  ).toBeVisible();
  await task.getByRole("button", { name: "Context and result" }).click();
  await task.getByRole("button", { name: "Need help", exact: true }).click();
  await expect(task).not.toBeVisible();
  await expect(
    page.getByText("Yerassyl: Need help with the first step."),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Workload", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("registration, one-time invitation, shared decisions and participant permissions", async ({
  page,
  browser,
  appUrl,
}) => {
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Open demo" }).click();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  const invite = page.getByRole("dialog", { name: "Team invitation" });
  await invite.getByRole("button", { name: "Create link" }).click();
  const link = await invite.getByLabel("Link", { exact: true }).inputValue();
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    await other.goto(link);
    await other.getByRole("button", { name: "Sign up", exact: true }).click();
    await other.getByLabel("Your name").fill("New Member");
    await expect(other.getByLabel("Team name")).toHaveCount(0);
    await other
      .getByLabel("Email", { exact: true })
      .fill("member@university.edu");
    await other
      .getByLabel("Password", { exact: true })
      .fill("member-password-2026");
    await other.getByRole("button", { name: "Create account" }).click();
    await expect(
      other.getByRole("heading", { name: "First working prototype" }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", { name: "Allocate tasks" }),
    ).toBeDisabled();
    // Claim the task that has a help request ("Prepare the presentation")
    await other
      .getByRole("button", { name: "Take over and help" })
      .first()
      .click();
    await expect(other.getByText("You took over the task")).toBeVisible();
    await other.getByRole("tab", { name: "Team", exact: true }).click();
    await other.getByRole("button", { name: "Propose a decision" }).click();
    const decision = other.getByRole("dialog", { name: "Propose a decision" });
    await decision.getByLabel("Proposal").fill("Do a peer review");
    await decision
      .getByLabel("Context and arguments")
      .fill(
        "First we review each other's results, then we assemble the presentation.",
      );
    await decision.getByRole("button", { name: "Save", exact: true }).click();
    await expect(decision).not.toBeVisible();
    await other.getByRole("button", { name: "For · 0" }).click();
    await expect(other.getByRole("button", { name: "For · 1" })).toBeVisible();
    await invite.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("tab", { name: "Team", exact: true }).click();
    await expect(
      page.getByText("Do a peer review", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.getByText("New Member · Accepted")).toBeVisible();
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
  await page.getByRole("button", { name: "Open demo" }).click();
  await expect(
    page.getByRole("heading", { name: "First working prototype" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "How it works", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: "My availability" }).click();
  await page.getByLabel("Available hours").fill("10");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Workload", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Weekly plan" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
