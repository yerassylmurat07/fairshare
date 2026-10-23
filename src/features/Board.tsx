import {
  Clock,
  MoreVertical,
  CircleAlert,
  Info,
  HandHelping,
  Sparkles,
  Scale,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  Task,
  Member,
  User,
  MilestoneTemplate,
} from "../../shared/types";
import { Avatar, Button, hours } from "../components/ui";
import { api, message } from "../lib/api";

const columns = [
  ["planned", "Запланировано"],
  ["in_progress", "В работе"],
  ["done", "Готово"],
] as const;

export function Board({
  projectId,
  milestoneId,
  role,
  user,
  tasks,
  members,
  onTask,
  onCreate,
  onChanged,
  onError,
}: {
  projectId: string;
  milestoneId: string;
  role: "leader" | "member";
  user: User;
  tasks: Task[];
  members: Member[];
  onTask: (t: Task) => void;
  onCreate: () => void;
  onChanged: (noticeText?: string) => void;
  onError: (errText: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MilestoneTemplate[]>([]);
  const me = members.find((m) => m.id === user.id);

  useEffect(() => {
    if (tasks.length === 0 && role === "leader") {
      api<{ templates: MilestoneTemplate[] }>("/templates")
        .then((res) => setTemplates(res.templates))
        .catch(() => {});
    }
  }, [tasks.length, role]);

  async function claimTask(t: Task) {
    setBusyId(t.id);
    try {
      await api(`/projects/${projectId}/tasks/${t.id}/claim`, {
        method: "POST",
        body: { version: t.version },
      });
      onChanged("Вы перехватили задачу");
    } catch (e) {
      onError(message(e));
    } finally {
      setBusyId(null);
    }
  }

  async function applyTemplate(tpl: MilestoneTemplate) {
    setBusyId(tpl.id);
    try {
      const res = await api<{ count: number }>(
        `/projects/${projectId}/milestones/${milestoneId}/template`,
        {
          method: "POST",
          body: { templateId: tpl.id },
        },
      );
      onChanged(`Добавлено задач из шаблона: ${res.count}`);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="board-wrap">
      {tasks.length === 0 && role === "leader" && templates.length > 0 && (
        <div className="starter-pack-banner">
          <div className="starter-pack-header">
            <Sparkles size={20} />
            <div>
              <strong>Быстрый старт этапа по шаблону</strong>
              <p>
                Заполните этап проверенными задачами с готовыми первыми шагами и
                чек-листами в один клик.
              </p>
            </div>
          </div>
          <div className="starter-pack-grid">
            {templates.map((tpl) => (
              <div key={tpl.id} className="starter-pack-card">
                <div>
                  <strong>{tpl.name}</strong>
                  <p>{tpl.description}</p>
                  <small>{tpl.tasks.length} задачи с чек-листами</small>
                </div>
                <Button
                  variant="secondary"
                  busy={busyId === tpl.id}
                  onClick={() => void applyTemplate(tpl)}
                >
                  Заполнить этап
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="board">
        {columns.map(([status, title]) => (
          <section key={status} className="board-column" aria-label={title}>
            <h3>
              {title}
              <span>{tasks.filter((t) => t.status === status).length}</span>
            </h3>
            <div className="column-tasks">
              {tasks
                .filter((t) => t.status === status)
                .map((t) => {
                  const member = members.find((m) => m.id === t.assigneeId);
                  const canClaim =
                    t.status !== "done" &&
                    t.assigneeId !== user.id &&
                    (!!t.helpReason || t.assigneeId === null) &&
                    !!me &&
                    me.load + t.estimate <= me.capacity;

                  return (
                    <div key={t.id} className="task-card-wrapper">
                      <button
                        className={
                          "task-card" + (t.staleStart ? " stale-card" : "")
                        }
                        onClick={() => onTask(t)}
                      >
                        <div className="card-title">
                          <strong>{t.title}</strong>
                          <MoreVertical size={17} />
                        </div>
                        <p>{t.goal}</p>
                        <div className="card-badges">
                          <span className="skill-tag">{t.skill}</span>
                          {t.estimateSummary &&
                            t.estimateSummary.count > 0 &&
                            t.status === "planned" && (
                              <span
                                className={
                                  "estimate-badge" +
                                  (t.estimateSummary.spreadWarning
                                    ? " spread-warn"
                                    : "")
                                }
                                title={
                                  t.estimateSummary.spreadWarning
                                    ? `Разброс оценок: от ${hours(t.estimateSummary.min!)} до ${hours(t.estimateSummary.max!)} ч`
                                    : `Медиана оценок команды: ${hours(t.estimateSummary.median!)} ч`
                                }
                              >
                                <Scale size={12} />
                                {t.estimateSummary.spreadWarning
                                  ? `Спорная оценка (${hours(t.estimateSummary.min!)}–${hours(t.estimateSummary.max!)} ч)`
                                  : `Оценка команды: ${hours(t.estimateSummary.median!)} ч`}
                              </span>
                            )}
                        </div>
                        {t.helpReason && (
                          <span className="help-tag">
                            <CircleAlert size={14} />
                            Нужна помощь
                          </span>
                        )}
                        {t.staleStart && (
                          <span className="stale-tag">
                            <Clock size={13} />
                            В работе &gt;24 ч без промежуточных шагов
                          </span>
                        )}
                        <div className="card-footer">
                          <span>
                            <Clock size={15} />
                            {hours(t.estimate)} ч
                          </span>
                          {member ? (
                            <Avatar user={member} small />
                          ) : (
                            <span className="unassigned">Не назначена</span>
                          )}
                        </div>
                      </button>
                      {canClaim && (
                        <button
                          type="button"
                          className="claim-inline-btn"
                          disabled={busyId === t.id}
                          onClick={() => void claimTask(t)}
                        >
                          <HandHelping size={14} />
                          {t.helpReason
                            ? "Перехватить и помочь"
                            : "Взять в работу"}
                        </button>
                      )}
                    </div>
                  );
                })}
              {!tasks.some((t) => t.status === status) && (
                <div className="column-empty">
                  {status === "planned" ? (
                    <button onClick={onCreate}>Добавить первую задачу</button>
                  ) : status === "in_progress" ? (
                    "Здесь появятся начатые задачи"
                  ) : (
                    "Здесь будут общие результаты"
                  )}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
      <p className="board-hint">
        <Info size={19} />
        Откройте задачу, чтобы увидеть первый шаг, сверить оценку часов или
        перехватить запрос помощи.
      </p>
    </div>
  );
}
