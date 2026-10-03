import { useEffect, useState } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import type { Task } from "../../shared/types";
import { api, message } from "../lib/api";
import { Button, ErrorBox, hours } from "../components/ui";
export function MyTasks({ onOpen }: { onOpen: (t: Task) => void }) {
  const [tasks, setTasks] = useState<
    (Task & { projectName: string; milestoneTitle: string })[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<typeof tasks>("/me/tasks")
      .then(setTasks)
      .catch((e) => setError(message(e)));
  }, []);
  return (
    <div className="page-content">
      <h1>Мои задачи</h1>
      <p className="subtitle">Ваши договорённости во всех учебных проектах.</p>
      <ErrorBox error={error} />
      <div className="my-task-list">
        {tasks.map((t) => (
          <div key={t.id}>
            <div>
              <small className="muted">
                {t.projectName} · {t.milestoneTitle}
              </small>
              <h3>{t.title}</h3>
              <p>{t.firstStep}</p>
            </div>
            <div>
              <span className="skill-tag">
                {t.status === "planned"
                  ? "Запланировано"
                  : t.status === "in_progress"
                    ? "В работе"
                    : "Готово"}
              </span>
              <span className="muted">
                <Clock size={15} /> {hours(t.estimate)} ч
              </span>
              <Button variant="ghost" onClick={() => onOpen(t)}>
                Открыть
                <ArrowUpRight size={17} />
              </Button>
            </div>
          </div>
        ))}
        {!tasks.length && !error && (
          <p className="empty-copy">
            Пока нет назначенных задач. Обсудите распределение с командой.
          </p>
        )}
      </div>
    </div>
  );
}
