import { useEffect, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { api, message } from "../lib/api";
import { ErrorBox } from "../components/ui";
const names: Record<string, string> = {
  "task.created": "created a task",
  "task.updated": "updated a task",
  "task.deleted": "deleted a task",
  "task.claimed": "took over a task",
  "allocation.approved": "approved the allocation",
  "milestone.created": "added a milestone",
  "milestone.template_applied": "filled a milestone from a template",
  "comment.added": "added a comment",
  "resource.added": "added a resource",
  "decision.created": "proposed a decision",
  "decision.closed": "recorded a decision",
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
      <h2>What changed in the team</h2>
      <p className="muted">
        The last 50 project events. The history shows actions; it does not
        measure contribution.
      </p>
      <ErrorBox error={error} />
      {!data.length && (
        <p className="empty-copy">
          Tasks, decisions and shared results will appear here.
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
                {names[e.kind] || "changed the project"}
                {e.details.title && (
                  <>
                    : <strong>{e.details.title}</strong>
                  </>
                )}
                {e.details.helpRequested && " · needs help"}
              </p>
              <time>{new Date(e.created_at).toLocaleString("en-US")}</time>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
