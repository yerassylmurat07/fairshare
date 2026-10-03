import { useState, type FormEvent } from "react";
import { Copy, Check, ArrowRight } from "lucide-react";
import type { ProjectState } from "../../shared/types";
import { api, message } from "../lib/api";
import { Modal, Button, ErrorBox } from "../components/ui";
export function CreateProject({
  state,
  onClose,
  onCreated,
}: {
  state: ProjectState;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/projects", {
        method: "POST",
        body: {
          teamId: state.project.teamId,
          name: f.get("name"),
          course: f.get("course"),
        },
      });
      onCreated(id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Новый проект" onClose={onClose}>
      <p className="muted">
        Для команды {state.project.teamName}. Новый проект начнётся с первого
        этапа.
      </p>
      <form onSubmit={submit}>
        <label>
          Название проекта
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="Например, командный курсовой проект"
          />
        </label>
        <label>
          Курс или предмет
          <input name="course" maxLength={60} placeholder="Например, ISE4133" />
        </label>
        <ErrorBox error={error} />
        <div className="modal-actions">
          <span />
          <Button type="submit" busy={busy}>
            Создать проект
            <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function CreateMilestone({
  state,
  onClose,
  onCreated,
}: {
  state: ProjectState;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>(
        `/projects/${state.project.id}/milestones`,
        { method: "POST", body: Object.fromEntries(f) },
      );
      onCreated(id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Новый этап" onClose={onClose}>
      <p className="muted">
        В MVP каждый этап планируется на одну неделю. Для длинной работы
        создайте несколько этапов.
      </p>
      <form onSubmit={submit}>
        <label>
          Название
          <input
            name="title"
            required
            minLength={2}
            maxLength={100}
            placeholder="Что должна получить команда?"
          />
        </label>
        <label>
          Начало недели — понедельник
          <input
            name="weekStart"
            type="date"
            defaultValue={state.milestone.weekStart}
            required
          />
        </label>
        <label>
          Срок этапа
          <input
            name="dueDate"
            type="date"
            defaultValue={state.milestone.dueDate}
            required
          />
        </label>
        <ErrorBox error={error} />
        <div className="modal-actions">
          <span />
          <Button type="submit" busy={busy}>
            Создать этап
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function InviteDialog({
  state,
  onClose,
  onJoined,
}: {
  state: ProjectState;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ token: string }>(
        `/projects/${state.project.id}/invitations`,
        { method: "POST" },
      );
      setLink(location.origin + "/?invite=" + data.token);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function join(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("token"));
    let token = value;
    try {
      token = new URL(value).searchParams.get("invite") || value;
    } catch {}
    setBusy(true);
    setError("");
    try {
      await api("/invitations/accept", { method: "POST", body: { token } });
      onJoined();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Приглашение в команду" onClose={onClose}>
      {state.role === "leader" && (
        <>
          <p className="muted">
            Одноразовая ссылка для {state.project.teamName}. Действует 24 часа.
            Отправьте её участнику самостоятельно.
          </p>
          {link ? (
            <>
              <label>
                Ссылка
                <input
                  value={link}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setError("Выделите и скопируйте ссылку из поля.");
                  }
                }}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                {copied ? "Скопировано" : "Скопировать ссылку"}
              </Button>
            </>
          ) : (
            <Button onClick={create} busy={busy}>
              Создать ссылку
            </Button>
          )}
        </>
      )}
      <div className="join-section">
        <h3>Присоединиться к другой команде</h3>
        <form onSubmit={join}>
          <label>
            Ссылка или код приглашения
            <input
              name="token"
              required
              minLength={30}
              placeholder="Вставьте приглашение"
            />
          </label>
          <Button variant="secondary" type="submit" busy={busy}>
            Присоединиться
            <ArrowRight size={16} />
          </Button>
        </form>
      </div>
      <ErrorBox error={error} />
    </Modal>
  );
}
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Как работает FairShare" onClose={onClose}>
      <div className="help-steps">
        <section>
          <span>01</span>
          <div>
            <h3>Дайте понятный первый шаг</h3>
            <p>
              Создайте этап и задачи с целью, конкретным действием для начала и
              ожидаемым результатом.
            </p>
          </div>
        </section>
        <section>
          <span>02</span>
          <div>
            <h3>Договоритесь о доступном времени</h3>
            <p>
              Каждый участник указывает собственные навыки и часы на неделю.
              Нагрузка учитывается сразу во всех проектах.
            </p>
          </div>
        </section>
        <section>
          <span>03</span>
          <div>
            <h3>Проверьте предложение вместе</h3>
            <p>
              Алгоритм подбирает исполнителя по навыку и отношению часов к
              доступности. Координатор подтверждает рекомендацию после
              обсуждения.
            </p>
          </div>
        </section>
        <section>
          <span>04</span>
          <div>
            <h3>Начните работу и просите помощь</h3>
            <p>
              Переведите задачу в работу, используйте чек-лист и обсуждение.
              Кнопка «Нужна помощь» сразу делает препятствие видимым.
            </p>
          </div>
        </section>
        <section>
          <span>05</span>
          <div>
            <h3>Сохраните общий результат</h3>
            <p>
              Добавьте ссылку или описание результата перед завершением.
              Материалы, голосования и история доступны всей команде.
            </p>
          </div>
        </section>
      </div>
      <p className="plain-note">
        Часы — оценка плана. FairShare не измеряет качество работы, не
        выставляет оценки и не гарантирует мотивацию участников.
      </p>
    </Modal>
  );
}
