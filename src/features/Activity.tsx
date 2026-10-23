import { useEffect, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { api, message } from "../lib/api";
import { ErrorBox } from "../components/ui";
const names: Record<string, string> = {
  "task.created": "создал(а) задачу",
  "task.updated": "обновил(а) задачу",
  "task.deleted": "удалил(а) задачу",
  "task.claimed": "перехватил(а) задачу",
  "allocation.approved": "подтвердил(а) распределение",
  "milestone.created": "добавил(а) этап",
  "milestone.template_applied": "заполнил(а) этап по шаблону",
  "comment.added": "добавил(а) комментарий",
  "resource.added": "добавил(а) материал",
  "decision.created": "предложил(а) решение",
  "decision.closed": "зафиксировал(а) решение",
};
export function Activity({ projectId }: { projectId: string }) {
  const [data, setData] = useState<
    {
      kind: string;
      actor: string;
      created_at: string;
      details: { title?: string; helpRequested?: boolean; status?: string };
    }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    api<typeof data>(`/projects/${projectId}/events`, { signal: abort.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(message(e));
      });
    return () => abort.abort();
  }, [projectId]);
  return (
    <section className="workspace-section">
      <h2>Что изменилось в команде</h2>
      <p className="muted">
        Последние 50 событий проекта. История показывает действия, а не измеряет
        вклад.
      </p>
      <ErrorBox error={error} />
      {!data.length && (
        <p className="empty-copy">
          Здесь появятся задачи, решения и общие результаты.
        </p>
      )}
      <div className="activity-list">
        {data.map((e, i) => (
          <div key={i}>
            <span className="activity-icon">
              <ActivityIcon size={18} />
            </span>
            <div>
              <p>
                <strong>{e.actor}</strong>{" "}
                {names[e.kind] || "изменил(а) проект"}
                {e.details.title && (
                  <>
                    : <strong>{e.details.title}</strong>
                  </>
                )}
                {e.details.helpRequested && " · нужна помощь"}
              </p>
              <time>{new Date(e.created_at).toLocaleString("ru-RU")}</time>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
