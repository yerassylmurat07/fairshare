import { Clock, MoreVertical, CircleAlert, Info } from "lucide-react";
import type { Task, Member } from "../../shared/types";
import { Avatar, hours } from "../components/ui";
const columns = [
  ["planned", "Запланировано"],
  ["in_progress", "В работе"],
  ["done", "Готово"],
] as const;
export function Board({
  tasks,
  members,
  onTask,
  onCreate,
}: {
  tasks: Task[];
  members: Member[];
  onTask: (t: Task) => void;
  onCreate: () => void;
}) {
  return (
    <div className="board-wrap">
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
                  return (
                    <button
                      key={t.id}
                      className="task-card"
                      onClick={() => onTask(t)}
                    >
                      <div className="card-title">
                        <strong>{t.title}</strong>
                        <MoreVertical size={17} />
                      </div>
                      <p>{t.goal}</p>
                      <span className="skill-tag">{t.skill}</span>
                      {t.helpReason && (
                        <span className="help-tag">
                          <CircleAlert size={14} />
                          Нужна помощь
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
        Откройте задачу, чтобы увидеть первый шаг и ожидаемый результат.
      </p>
    </div>
  );
}
