import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Equal, Eye, EyeOff } from "lucide-react";
import { api, ApiError, message } from "../lib/api";
import {
  authFieldErrors,
  loginSchema,
  registerSchema,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "../../shared/auth";
import { Brand, Button, ErrorBox } from "../components/ui";
export function AuthScreen({
  onAuthenticated,
  inviteToken,
}: {
  onAuthenticated: (acceptedInvite?: boolean) => void | Promise<void>;
  inviteToken: string | null;
}) {
  const invited = !!inviteToken;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [fields, setFields] = useState({
    name: "",
    teamName: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  function focusField(errors: Record<string, string>) {
    if (!Object.keys(errors).length) return;
    // Wait for errors and the enabled fieldset to render; follow visual order.
    requestAnimationFrame(() => {
      const input = Array.from(form.current?.elements ?? []).find(
        (element) =>
          element instanceof HTMLInputElement && errors[element.name],
      );
      if (input instanceof HTMLElement) input.focus();
    });
  }
  function update(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setError("");
    setFieldErrors({});
    setShowPassword(false);
    setCapsLock(false);
    setFields((current) => ({ ...current, password: "" }));
  }
  function fieldProps(key: keyof typeof fields) {
    return {
      id: "auth-" + key,
      name: key,
      value: fields[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        update(key, e.target.value),
      "aria-invalid": !!fieldErrors[key],
      "aria-describedby": fieldErrors[key]
        ? `auth-${key}-error`
        : key === "password" && mode === "register"
          ? "auth-password-hint"
          : undefined,
    };
  }
  function fieldError(key: keyof typeof fields) {
    return fieldErrors[key] ? (
      <small className="auth-field-error" id={`auth-${key}-error`}>
        {fieldErrors[key]}
      </small>
    ) : null;
  }
  useEffect(() => {
    api<{ demoEnabled: boolean }>("/config")
      .then((c) => setDemo(c.demoEnabled))
      // Demo availability must not prevent or distract from signing in.
      .catch(() => {});
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (
      mode === "register" ? registerSchema : loginSchema
    ).safeParse({
      ...values,
      ...(mode === "register" && inviteToken ? { inviteToken } : {}),
    });
    if (!parsed.success) {
      const errors = authFieldErrors(parsed.error.issues);
      setFieldErrors(errors);
      setError("Проверьте выделенные поля.");
      focusField(errors);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      await api("/auth/" + mode, {
        method: "POST",
        body: parsed.data,
      });
      await onAuthenticated(mode === "register" && invited);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        focusField(e.fieldErrors);
      }
      setError(
        e instanceof TypeError
          ? "Нет соединения с сервером. Проверьте интернет и попробуйте снова."
          : message(e),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function enterDemo() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/auth/demo", { method: "POST" });
      await onAuthenticated();
    } catch (e) {
      setError(message(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <section className="auth-story">
        <Brand />
        <div>
          <div className="auth-emblem">
            <Equal size={72} strokeWidth={3} />
          </div>
          <h1>
            Командная работа
            <br />
            начинается с ясности.
          </h1>
          <p>
            Разложите проект на понятные шаги.
            <br />
            Договоритесь о нагрузке. Помогайте вовремя.
          </p>
          <ul>
            <li>
              <Check />У каждой задачи есть первый шаг
            </li>
            <li>
              <Check />
              Распределение учитывает ваше время
            </li>
            <li>
              <Check />
              Решения принимает команда
            </li>
          </ul>
        </div>
        <span className="muted">
          Для учебных проектов, которые делают вместе.
        </span>
      </section>
      <section className="auth-form">
        <div>
          <h2>
            {invited
              ? "Вас пригласили в команду"
              : mode === "login"
                ? "Рады видеть вас"
                : "Создайте аккаунт"}
          </h2>
          <p className="muted">
            {invited
              ? "Войдите или создайте аккаунт, чтобы принять приглашение."
              : mode === "register"
                ? "Создайте команду и пригласите участников после регистрации."
                : "Войдите, чтобы продолжить работу с командой."}
          </p>
          <div className="auth-tabs">
            <button
              type="button"
              disabled={busy}
              aria-pressed={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              Регистрация
            </button>
          </div>
          <form ref={form} onSubmit={submit} noValidate aria-busy={busy}>
            <fieldset className="auth-fields" disabled={busy}>
              <legend className="sr-only">
                {mode === "login" ? "Вход в аккаунт" : "Регистрация аккаунта"}
              </legend>
              {mode === "register" && (
                <>
                  <label htmlFor="auth-name">
                    Ваше имя
                    <input
                      {...fieldProps("name")}
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Имя Фамилия"
                    />
                    {fieldError("name")}
                  </label>
                  {!invited && (
                    <label htmlFor="auth-teamName">
                      Название команды
                      <input
                        {...fieldProps("teamName")}
                        autoComplete="off"
                        required
                        minLength={2}
                        maxLength={80}
                        placeholder="Например, Team FairShare"
                      />
                      {fieldError("teamName")}
                    </label>
                  )}
                </>
              )}
              <label htmlFor="auth-email">
                Email
                <input
                  {...fieldProps("email")}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={200}
                  required
                  placeholder="you@university.edu"
                />
                {fieldError("email")}
              </label>
              <div className="auth-password-field">
                <label htmlFor="auth-password">Пароль</label>
                <div className="auth-password-input">
                  <input
                    {...fieldProps("password")}
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={
                      mode === "register" ? MIN_PASSWORD_LENGTH : undefined
                    }
                    maxLength={MAX_PASSWORD_LENGTH}
                    autoCapitalize="none"
                    spellCheck={false}
                    onKeyDown={(e) =>
                      setCapsLock(e.getModifierState("CapsLock"))
                    }
                    onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                    onBlur={() => setCapsLock(false)}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "register" ? "Придумайте пароль" : "Ваш пароль"
                    }
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={
                      showPassword ? "Скрыть пароль" : "Показать пароль"
                    }
                    aria-controls="auth-password"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                {mode === "register" && (
                  <p className="auth-field-hint" id="auth-password-hint">
                    От 15 до 128 символов. Можно использовать несколько слов с
                    пробелами.
                  </p>
                )}
                {fieldError("password")}
                {capsLock && (
                  <p className="auth-field-hint" role="status">
                    Включён Caps Lock.
                  </p>
                )}
              </div>
            </fieldset>
            <ErrorBox error={error} />
            <Button type="submit" busy={busy}>
              {mode === "login" ? "Войти" : "Создать аккаунт"}
              <ArrowRight size={17} />
            </Button>
          </form>
          {demo && !invited && (
            <div className="demo-entry">
              <span>Хотите сначала посмотреть?</span>
              <Button variant="secondary" onClick={enterDemo} busy={busy}>
                Открыть демо
                <ArrowRight size={17} />
              </Button>
              <small>
                Учебная команда с примерами задач. Изменения сохраняются.
              </small>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
