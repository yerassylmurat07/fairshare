import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.js";
import { createDatabase } from "./db.js";
import { hashToken, passwordHash, passwordMatches } from "./security.js";

const account = {
  email: " Alice@University.edu ",
  password: "  four words for a password  ",
  name: "  Алиса Иванова  ",
  teamName: "  Учебная команда  ",
};
const cookieOf = (response: { headers: { [key: string]: unknown } }) =>
  String(response.headers["set-cookie"]).split(";")[0];

test("password change verifies current password, revokes sessions and rejects a concurrent stale login", async () => {
  const db = await createDatabase("memory://");
  let pauseLogin = false;
  let loginRead!: () => void;
  let releaseLogin!: () => void;
  const read = new Promise<void>((resolve) => {
    loginRead = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseLogin = resolve;
  });
  const app = await createApp(
    {
      ...db,
      query: async <T>(sql: string, values?: unknown[]) => {
        const result = await db.query<T>(sql, values);
        if (
          pauseLogin &&
          sql === "SELECT id,password_hash FROM users WHERE email=$1"
        ) {
          pauseLogin = false;
          loginRead();
          await release;
        }
        return result;
      },
    },
    { demo: false },
  );
  const newPassword = "my new password with spaces";
  const payload = {
    currentPassword: account.password,
    newPassword,
    confirmPassword: newPassword,
  };
  const change = (cookie?: string, body = payload) =>
    app.inject({
      method: "POST",
      url: "/api/auth/password",
      headers: cookie ? { cookie } : {},
      payload: body,
    });
  const session = (cookie: string) =>
    app.inject({ url: "/api/auth/session", headers: { cookie } });
  const login = (password: string) =>
    app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: account.email, password },
    });
  try {
    assert.equal((await change()).statusCode, 401);
    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: account,
    });
    const first = cookieOf(registered);
    const second = cookieOf(await login(account.password));
    const originalHash = (await db.query("SELECT password_hash FROM users"))
      .rows[0].password_hash;
    assert.equal(
      (await change(first, { ...payload, currentPassword: "wrong" }))
        .statusCode,
      400,
    );
    const mismatch = await change(first, {
      ...payload,
      confirmPassword: "does not match",
    });
    assert.equal(mismatch.statusCode, 400);
    assert.match(mismatch.json().fieldErrors.confirmPassword, /не совпадают/);
    const same = await change(first, {
      currentPassword: account.password,
      newPassword: account.password,
      confirmPassword: account.password,
    });
    assert.equal(same.statusCode, 400);
    assert.match(same.json().fieldErrors.newPassword, /отличаться/);
    assert.equal(
      (
        await change(first, {
          ...payload,
          newPassword: "short",
          confirmPassword: "short",
        })
      ).statusCode,
      400,
    );
    const csrf = await app.inject({
      method: "POST",
      url: "/api/auth/password",
      headers: {
        cookie: first,
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      payload,
    });
    assert.equal(csrf.statusCode, 403);
    assert.equal(
      (await db.query("SELECT password_hash FROM users")).rows[0].password_hash,
      originalHash,
    );
    assert.ok((await session(first)).json().user);
    assert.ok((await session(second)).json().user);

    pauseLogin = true;
    const staleLogin = login(account.password).then((response) => response);
    await read;
    const changed = await change(first);
    releaseLogin();
    assert.equal(changed.statusCode, 200);
    assert.equal((await staleLogin).statusCode, 401);
    assert.notEqual(cookieOf(changed), first);
    assert.equal((await session(first)).json().user, null);
    assert.equal((await session(second)).json().user, null);
    assert.ok((await session(cookieOf(changed))).json().user);
    assert.equal(
      (await db.query("SELECT token_hash FROM sessions")).rows.length,
      1,
    );
    const stored = String(
      (await db.query("SELECT password_hash FROM users")).rows[0].password_hash,
    );
    assert.notEqual(stored, originalHash);
    assert.ok(await passwordMatches(newPassword, stored));
    assert.equal((await login(account.password)).statusCode, 401);
    assert.equal((await login(newPassword)).statusCode, 200);
  } finally {
    releaseLogin();
    await app.close();
    await db.close();
  }
});

test("shared demo passwords cannot be changed", async () => {
  const db = await createDatabase("memory://");
  const app = await createApp(db, { demo: true });
  try {
    const demo = await app.inject({ method: "POST", url: "/api/auth/demo" });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/password",
      headers: { cookie: cookieOf(demo) },
      payload: {
        currentPassword: "FairShare-demo-2026!",
        newPassword: "a different long password",
        confirmPassword: "a different long password",
      },
    });
    assert.equal(response.statusCode, 403);
    assert.match(response.json().error, /демокоманды/);
  } finally {
    await app.close();
    await db.close();
  }
});

test("auth: validation, normalization, exact passwords, rotation, expiry and logout", async () => {
  const db = await createDatabase("memory://");
  const app = await createApp(db, { demo: false });
  const post = (
    url: string,
    payload: Record<string, unknown>,
    cookie?: string,
  ) =>
    app.inject({
      method: "POST",
      url: "/api/auth/" + url,
      payload,
      headers: cookie ? { cookie } : {},
    });
  const session = (cookie: string) =>
    app.inject({ url: "/api/auth/session", headers: { cookie } });
  try {
    const invalid = await post("register", {
      ...account,
      name: "  ",
      password: "short",
    });
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.json().fieldErrors.name, /имя/);
    assert.match(invalid.json().fieldErrors.password, /15/);
    assert.equal((await db.query("SELECT id FROM users")).rows.length, 0);
    const registered = await post("register", account);
    assert.equal(registered.statusCode, 200);
    assert.equal(registered.json().user.email, "alice@university.edu");
    assert.equal(registered.json().user.name, "Алиса Иванова");
    assert.equal(registered.json().user.passwordHash, undefined);
    const first = cookieOf(registered);
    assert.match(String(registered.headers["set-cookie"]), /HttpOnly/);
    assert.match(String(registered.headers["set-cookie"]), /SameSite=Strict/i);
    assert.equal(registered.headers["cache-control"], "no-store");
    const stored = (await db.query("SELECT password_hash FROM users")).rows[0];
    assert.notEqual(stored.password_hash, account.password);
    assert.ok(
      await passwordMatches(account.password, String(stored.password_hash)),
    );
    assert.notEqual(
      (await db.query("SELECT token_hash FROM sessions")).rows[0].token_hash,
      first.split("=")[1],
    );
    const duplicate = await post("register", {
      ...account,
      email: "alice@university.edu",
    });
    assert.equal(duplicate.statusCode, 409);
    assert.equal((await db.query("SELECT id FROM teams")).rows.length, 1);
    const wrong = await post(
      "login",
      { email: account.email, password: account.password.trim() },
      first,
    );
    const missing = await post("login", {
      email: "missing@university.edu",
      password: "wrong",
    });
    const short = await post("login", {
      email: account.email,
      password: "wrong",
    });
    assert.equal(wrong.statusCode, 401);
    assert.equal(missing.statusCode, 401);
    assert.equal(short.statusCode, 401);
    assert.deepEqual(wrong.json(), missing.json());
    assert.ok((await session(first)).json().user);
    const login = await post(
      "login",
      { email: account.email, password: account.password },
      first,
    );
    assert.equal(login.statusCode, 200);
    const second = cookieOf(login);
    assert.notEqual(second, first);
    assert.equal((await session(first)).json().user, null);
    assert.ok((await session(second)).json().user);
    await post("logout", {}, second);
    assert.equal((await session(second)).json().user, null);
    // Older passwords remain valid even though new registration needs 15 characters.
    await db.query("UPDATE users SET password_hash=$1", [
      await passwordHash("old-pass10"),
    ]);
    const legacy = await post("login", {
      email: account.email,
      password: "old-pass10",
    });
    assert.equal(legacy.statusCode, 200);
    const legacyCookie = cookieOf(legacy);
    await db.query(
      "UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",
      [hashToken(legacyCookie.split("=")[1])],
    );
    assert.equal((await session(legacyCookie)).json().user, null);
    assert.equal(
      (
        await app.inject({
          url: "/api/workspace",
          headers: { cookie: legacyCookie },
        })
      ).statusCode,
      401,
    );
    const csrf = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: account.email, password: "old-pass10" },
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
    });
    assert.equal(csrf.statusCode, 403);
  } finally {
    await app.close();
    await db.close();
  }
});

test("auth: registration joins an invitation atomically without creating an extra team", async () => {
  const db = await createDatabase("memory://");
  const app = await createApp(db, { demo: false });
  try {
    const owner = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: account,
    });
    const cookie = cookieOf(owner);
    const project = (
      await app.inject({ url: "/api/workspace", headers: { cookie } })
    ).json().projects[0];
    const invite = async () =>
      (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/invitations`,
          headers: { cookie },
        })
      ).json().token;
    const token = await invite();
    const member = {
      email: "member@university.edu",
      name: "Новый Участник",
      password: "a sufficiently long password",
      inviteToken: token,
    };
    const joined = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: member,
    });
    assert.equal(joined.statusCode, 200);
    const workspace = (
      await app.inject({
        url: "/api/workspace",
        headers: { cookie: cookieOf(joined) },
      })
    ).json();
    assert.deepEqual(
      workspace.projects.map((p: { id: string }) => p.id),
      [project.id],
    );
    assert.equal((await db.query("SELECT id FROM teams")).rows.length, 1);
    assert.equal(
      (
        await db.query("SELECT role FROM memberships WHERE user_id=$1", [
          joined.json().user.id,
        ])
      ).rows[0].role,
      "member",
    );
    const expired = await invite();
    await db.query(
      "UPDATE invitations SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",
      [hashToken(expired)],
    );
    for (const inviteToken of [token, "x".repeat(43), expired]) {
      const failed = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { ...member, email: "retry@university.edu", inviteToken },
      });
      assert.equal(failed.statusCode, 410);
      assert.equal(failed.headers["set-cookie"], undefined);
      assert.equal(
        (
          await db.query(
            "SELECT id FROM users WHERE email='retry@university.edu'",
          )
        ).rows.length,
        0,
      );
    }
    const fresh = await invite();
    const retry = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...member, email: "retry@university.edu", inviteToken: fresh },
    });
    assert.equal(retry.statusCode, 200);
  } finally {
    await app.close();
    await db.close();
  }
});

test("auth: sign-in and registration share a localized rate limit", async () => {
  const db = await createDatabase("memory://");
  const app = await createApp(db, { demo: false });
  try {
    for (let i = 0; i < 12; i++) {
      const response = await app.inject({
        method: "POST",
        url: `/api/auth/${i % 2 ? "login" : "register"}`,
        payload: {},
      });
      assert.equal(response.statusCode, 400);
    }
    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {},
    });
    assert.equal(blocked.statusCode, 429);
    assert.match(blocked.json().error, /Слишком много попыток/);
    assert.ok(blocked.headers["retry-after"]);
    assert.equal(
      (await app.inject({ url: "/api/auth/session" })).statusCode,
      200,
    );
  } finally {
    await app.close();
    await db.close();
  }
});
