import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Equal } from "lucide-react";
import { api, message } from "../lib/api";
import { Brand, Button, ErrorBox } from "../components/ui";
export function AuthScreen({
  onAuthenticated,
  invited,
}: {
  onAuthenticated: () => void;
  invited: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    api<{ demoEnabled: boolean }>("/config")
      .then((c) => setDemo(c.demoEnabled))
      .catch((e) => setError(message(e)));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      await api("/auth/" + mode, {
        method: "POST",
        body: Object.fromEntries(f.entries()),
      });
      onAuthenticated();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function enterDemo() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/demo", { method: "POST" });
      onAuthenticated();
    } catch (e) {
      setError(message(e));
    } finally {
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
                : "Начнём с вашей команды"}
          </h2>
          <p className="muted">
            {invited
              ? "Войдите или создайте аккаунт, чтобы принять приглашение."
              : "Чуть меньше хаоса. Чуть больше общего результата."}
          </p>
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Вход
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Регистрация
            </button>
          </div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <label>
                  Ваше имя
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Имя Фамилия"
                  />
                </label>
                <label>
                  Название команды
                  <input
                    name="teamName"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Например, Team FairShare"
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@university.edu"
              />
            </label>
            <label>
              Пароль
              <input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="Не менее 10 символов"
              />
            </label>
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
