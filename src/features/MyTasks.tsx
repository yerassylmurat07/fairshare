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
      <h1>My tasks</h1>
      <p className="subtitle">Your commitments across all course projects.</p>
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
              {t.staleStart && (
                <span className="stale-tag">
                  In progress &gt;24 h with no steps done: tick a checklist item
                  or ask for help
                </span>
              )}
            </div>
            <div>
              <span className="skill-tag">
                {t.status === "planned"
                  ? "Planned"
                  : t.status === "in_progress"
                    ? "In progress"
                    : "Done"}
              </span>
              <span className="muted">
                <Clock size={15} /> {hours(t.estimate)} h
              </span>
              <Button variant="ghost" onClick={() => onOpen(t)}>
                Open
                <ArrowUpRight size={17} />
              </Button>
            </div>
          </div>
        ))}
        {!tasks.length && !error && (
          <p className="empty-copy">
            No tasks assigned yet. Discuss the allocation with your team.
          </p>
        )}
      </div>
    </div>
  );
}
