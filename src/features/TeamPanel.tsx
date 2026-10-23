import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Check,
  Settings2,
} from "lucide-react";
import type { ProjectState, User } from "../../shared/types";
import { api, message } from "../lib/api";
import { Avatar, Button, ErrorBox, Modal, hours } from "../components/ui";
import { SKILLS } from "./TaskDialog";
type Resource = { id: string; title: string; url: string; author: string };
type Decision = {
  id: string;
  title: string;
  context: string;
  author: string;
  status: "open" | "accepted" | "declined";
  yes: number;
  no: number;
  myVote: "yes" | "no" | null;
};
export function TeamPanel({
  state,
  user,
  onUpdated,
}: {
  state: ProjectState;
  user: User;
  onUpdated: () => void;
}) {
  const [data, setData] = useState<{
    resources: Resource[];
    decisions: Decision[];
  }>({ resources: [], decisions: [] });
  const [dialog, setDialog] = useState<
    "availability" | "resource" | "decision" | null
  >(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const me = state.members.find((m) => m.id === user.id)!;
  const path = "/projects/" + state.project.id;
  async function load() {
    try {
      setData(await api(path + "/collaboration"));
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [path]);
  async function mutate(endpoint: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(endpoint, { method, body });
      await load();
      onUpdated();
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok =
      dialog === "availability"
        ? await mutate("/me/availability", "PUT", {
            weekStart: state.milestone.weekStart,
            hours: Number(f.get("hours")),
            skills: f.getAll("skills"),
            learningSkills: f.getAll("learningSkills"),
          })
        : dialog === "resource"
          ? await mutate(path + "/resources", "POST", {
              title: f.get("title"),
              url: f.get("url"),
            })
          : await mutate(path + "/decisions", "POST", {
              title: f.get("title"),
              context: f.get("context"),
            });
    if (ok) setDialog(null);
  }
  return (
    <section className="team-panel">
      <div className="section-row">
        <div>
          <h2>{state.project.teamName}</h2>
          <p className="muted">
            Доступность на неделю с{" "}
            {new Date(state.milestone.weekStart).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            })}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setDialog("availability");
          }}
        >
          <Settings2 size={17} />
          Моя доступность
        </Button>
      </div>
      <div className="member-list">
        {state.members.map((m) => (
          <div key={m.id} className="team-member">
            <Avatar user={m} />
            <div>
              <strong>
                {m.name}
                {m.id === user.id && <span className="muted"> · вы</span>}
              </strong>
              <small>
                {m.role === "leader" ? "Координатор" : "Участник"} ·{" "}
                {hours(m.capacity)} ч / неделю
              </small>
              <div className="member-skills">
                {m.skills.length || m.learningSkills?.length ? (
                  <>
                    {m.skills.map((s) => (
                      <span key={s} className="skill-tag">
                        {s}
                      </span>
                    ))}
                    {(m.learningSkills || []).map((s) => (
                      <span
                        key={"learn-" + s}
                        className="skill-tag stretch-tag"
                        title="Хочет освоить в работе"
                      >
                        + {s}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="muted">Навыки ещё не указаны</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="collaboration-columns">
        <section>
          <div className="section-row">
            <h3>Общие материалы</h3>
            <button
              className="icon-button"
              aria-label="Добавить материал"
              onClick={() => {
                setError("");
                setDialog("resource");
              }}
            >
              <Plus size={20} />
            </button>
          </div>
          {data.resources.length ? (
            data.resources.map((r) => (
              <a
                className="resource-row"
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Link size={20} />
                <div>
                  <strong>{r.title}</strong>
                  <small>{r.author}</small>
                </div>
              </a>
            ))
          ) : (
            <p className="empty-copy">
              Соберите здесь репозиторий, требования, макеты и общие документы.
            </p>
          )}
        </section>
        <section>
          <div className="section-row">
            <h3>Командные решения</h3>
            <button
              className="icon-button"
              aria-label="Предложить решение"
              onClick={() => {
                setError("");
                setDialog("decision");
              }}
            >
              <Plus size={20} />
            </button>
          </div>
          {data.decisions.length ? (
            data.decisions.map((d) => (
              <div className="decision" key={d.id}>
                <strong>{d.title}</strong>
                <p>{d.context}</p>
                <small className="muted">
                  {d.author} ·{" "}
                  {d.status === "open"
                    ? "Обсуждается"
                    : d.status === "accepted"
                      ? "Принято"
                      : "Отклонено"}
                </small>
                <div className="decision-actions">
                  <button
                    className={d.myVote === "yes" ? "voted" : ""}
                    disabled={busy || d.status !== "open"}
                    onClick={() =>
                      void mutate(
                        path + "/decisions/" + d.id + "/vote",
                        "POST",
                        { choice: "yes" },
                      )
                    }
                  >
                    <ThumbsUp size={15} />
                    За · {d.yes}
                  </button>
                  <button
                    className={d.myVote === "no" ? "voted" : ""}
                    disabled={busy || d.status !== "open"}
                    onClick={() =>
                      void mutate(
                        path + "/decisions/" + d.id + "/vote",
                        "POST",
                        { choice: "no" },
                      )
                    }
                  >
                    <ThumbsDown size={15} />
                    Против · {d.no}
                  </button>
                  {state.role === "leader" && d.status === "open" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void mutate(path + "/decisions/" + d.id, "PATCH", {
                            status: "accepted",
                          })
                        }
                      >
                        Принять
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void mutate(path + "/decisions/" + d.id, "PATCH", {
                            status: "declined",
                          })
                        }
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="empty-copy">
              Предлагайте решения, голосуйте и сохраняйте итог договорённости.
            </p>
          )}
        </section>
      </div>
      <ErrorBox error={dialog ? "" : error} />
      {dialog && (
        <Modal
          title={
            dialog === "availability"
              ? "Моя доступность"
              : dialog === "resource"
                ? "Общий материал"
                : "Предложить решение"
          }
          onClose={() => setDialog(null)}
        >
          <form onSubmit={submit}>
            {dialog === "availability" ? (
              <>
                <p className="muted">
                  Общее доступное время для всех проектов за выбранную неделю.
                  Только вы можете изменить свои часы.
                </p>
                <label>
                  Доступно часов
                  <input
                    type="number"
                    name="hours"
                    defaultValue={me.capacity}
                    min="0"
                    max="100"
                    step="0.25"
                    required
                  />
                </label>
                <fieldset>
                  <legend>Мои навыки (делаю уверенно)</legend>
                  {SKILLS.filter((s) => s !== "Любой навык").map((s) => (
                    <label className="checkbox-label" key={s}>
                      <input
                        type="checkbox"
                        name="skills"
                        value={s}
                        defaultChecked={me.skills.includes(s)}
                      />
                      {s}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Хочу освоить (зона роста)</legend>
                  {SKILLS.filter((s) => s !== "Любой навык").map((s) => (
                    <label className="checkbox-label" key={"learn-" + s}>
                      <input
                        type="checkbox"
                        name="learningSkills"
                        value={s}
                        defaultChecked={(me.learningSkills || []).includes(s)}
                      />
                      {s}
                    </label>
                  ))}
                </fieldset>
              </>
            ) : dialog === "resource" ? (
              <>
                <label>
                  Название
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Репозиторий проекта"
                  />
                </label>
                <label>
                  Ссылка
                  <input
                    name="url"
                    type="url"
                    required
                    maxLength={1000}
                    placeholder="https://..."
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Предложение
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={120}
                    placeholder="Какое решение нужно принять?"
                  />
                </label>
                <label>
                  Контекст и аргументы
                  <textarea
                    name="context"
                    required
                    maxLength={2000}
                    rows={4}
                    placeholder="Почему это важно и какие варианты обсудили?"
                  />
                </label>
              </>
            )}
            <ErrorBox error={error} />
            <div className="modal-actions">
              <span />
              <Button type="submit" busy={busy}>
                <Check size={17} />
                Сохранить
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
