import { useEffect, useState, type FormEvent } from "react";
import {
  MessageSquare,
  Send,
  Plus,
  Check,
  Trash2,
  CircleAlert,
  HandHelping,
  Scale,
  Clock,
} from "lucide-react";
import type { Task, ProjectState, User } from "../../shared/types";
import { api, message } from "../lib/api";
import { Modal, Button, ErrorBox, Avatar, hours } from "../components/ui";
export const SKILLS = [
  "Any skill",
  "Architecture",
  "Backend",
  "Frontend",
  "Testing",
  "Documentation",
  "Databases",
];
const QUICK_ESTIMATES = [1, 2, 3, 4, 6, 8];
type Discussion = {
  comments: {
    id: string;
    body: string;
    name: string;
    initials: string;
    color: string;
    createdAt: string;
  }[];
  checklist: { id: string; title: string; done: boolean }[];
};
function DiscussionPanel({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const [data, setData] = useState<Discussion>({ comments: [], checklist: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [item, setItem] = useState("");
  const path = `/projects/${projectId}/tasks/${taskId}`;
  async function load() {
    try {
      setData(await api<Discussion>(path + "/discussion"));
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
      await api(path + endpoint, { method, body });
      await load();
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="discussion-panel">
      <h3>First steps and checklist</h3>
      <div className="checklist">
        {data.checklist.map((i) => (
          <label
            className={"checklist-item" + (i.done ? " checked" : "")}
            key={i.id}
          >
            <input
              type="checkbox"
              checked={i.done}
              disabled={busy}
              onChange={() =>
                void mutate("/checklist/" + i.id, "PATCH", { done: !i.done })
              }
            />
            <span>{i.title}</span>
          </label>
        ))}
      </div>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await mutate("/checklist", "POST", { title: item })) setItem("");
        }}
      >
        <input
          aria-label="New checklist item"
          placeholder="Add a concrete step"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          minLength={2}
          maxLength={160}
          required
        />
        <Button type="submit" variant="secondary" busy={busy}>
          <Plus size={17} />
          Add
        </Button>
      </form>
      <h3>Task discussion</h3>
      {!data.comments.length && (
        <p className="muted">
          Questions, ideas and help stay next to the task.
        </p>
      )}
      <div className="comments">
        {data.comments.map((c) => (
          <div className="comment" key={c.id}>
            <Avatar user={c} small />
            <div>
              <div className="comment-header">
                <strong>{c.name}</strong>
                <time>
                  {new Date(c.createdAt).toLocaleString("en-US", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p>{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await mutate("/comments", "POST", { body: comment }))
            setComment("");
        }}
      >
        <label>
          Your comment
          <textarea
            required
            maxLength={2000}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What worked? Where do you need help?"
          />
        </label>
        <Button type="submit" busy={busy}>
          <Send size={16} />
          Send
        </Button>
      </form>
      <ErrorBox error={error} />
    </div>
  );
}
export function TaskDialog({
  task,
  state,
  user,
  onClose,
  onSaved,
}: {
  task: Task | null;
  state: ProjectState;
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"task" | "discussion">("task");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsHelp, setNeedsHelp] = useState(!!task?.helpReason);
  const [status, setStatus] = useState(task?.status || "planned");
  const [estimateInput, setEstimateInput] = useState(
    String(task?.estimate || 2),
  );
  const [myVote, setMyVote] = useState<number | null>(
    task?.estimateSummary?.myEstimate ?? null,
  );
  const writable = state.role === "leader" || task?.assigneeId === user.id;
  const leader = state.role === "leader";
  const me = state.members.find((m) => m.id === user.id);
  const canClaim =
    !!task &&
    task.status !== "done" &&
    task.assigneeId !== user.id &&
    (!!task.helpReason || task.assigneeId === null) &&
    !!me &&
    me.load + task.estimate <= me.capacity;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const common = {
      status,
      helpReason: needsHelp
        ? String(f.get("helpReason") || "Need help with the first step.")
        : null,
      evidence: String(f.get("evidence") || ""),
    };
    const conditions = {
      title: String(f.get("title")),
      goal: String(f.get("goal")),
      firstStep: String(f.get("firstStep")),
      deliverable: String(f.get("deliverable")),
      estimate: Number(estimateInput || f.get("estimate")),
      skill: String(f.get("skill")),
      dependencyId: f.get("dependencyId") || null,
    };
    try {
      if (task)
        await api(`/projects/${state.project.id}/tasks/${task.id}`, {
          method: "PATCH",
          body: {
            version: task.version,
            ...common,
            ...(leader
              ? {
                  ...conditions,
                  assigneeId: f.get("assigneeId") || null,
                  override: f.get("override") === "on",
                }
              : {}),
          },
        });
      else
        await api(`/projects/${state.project.id}/tasks`, {
          method: "POST",
          body: { ...conditions, milestoneId: state.milestone.id },
        });
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function quickHelp() {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${state.project.id}/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          version: task.version,
          helpReason: task.helpReason ? null : "Need help with the first step.",
        },
      });
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function claim() {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${state.project.id}/tasks/${task.id}/claim`, {
        method: "POST",
        body: { version: task.version },
      });
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function voteEstimate(val: number) {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${state.project.id}/tasks/${task.id}/estimates`, {
        method: "POST",
        body: { hours: val },
      });
      setMyVote(val);
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!task || !confirm("Delete this planned task?")) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/projects/${state.project.id}/tasks/${task.id}?version=${task.version}`,
        { method: "DELETE" },
      );
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={task ? "Task" : "New task"} onClose={onClose} wide>
      {task && (
        <div className="dialog-tabs">
          <button
            className={tab === "task" ? "active" : ""}
            onClick={() => setTab("task")}
          >
            Context and result
          </button>
          <button
            className={tab === "discussion" ? "active" : ""}
            onClick={() => setTab("discussion")}
          >
            <MessageSquare size={16} />
            Discussion and steps
          </button>
        </div>
      )}
      {tab === "discussion" && task ? (
        <DiscussionPanel projectId={state.project.id} taskId={task.id} />
      ) : (
        <form onSubmit={save}>
          {task?.staleStart && (
            <div className="stale-nudge-box">
              <Clock size={18} />
              <div>
                <strong>This task has been in progress for over 24 hours with no steps done</strong>
                <p>
                  Tick a finished item in “Discussion and steps”, attach
                  a draft of the result or press “Need help” so the team
                  can step in early.
                </p>
              </div>
            </div>
          )}
          <div className="task-form">
            <label className="full">
              Title
              <input
                name="title"
                defaultValue={task?.title}
                required
                minLength={3}
                maxLength={120}
                disabled={!!task && !leader}
                placeholder="For example, build the task screen"
              />
            </label>
            <label className="full">
              Goal: why this is needed
              <textarea
                name="goal"
                defaultValue={task?.goal}
                required
                minLength={3}
                maxLength={800}
                rows={2}
                disabled={!!task && !leader}
                placeholder="Which part of the shared result does this task deliver?"
              />
            </label>
            <label>
              First concrete step
              <textarea
                name="firstStep"
                defaultValue={task?.firstStep}
                required
                minLength={3}
                maxLength={800}
                rows={3}
                disabled={!!task && !leader}
                placeholder="What should you open, create or check first?"
              />
            </label>
            <label>
              Expected result
              <textarea
                name="deliverable"
                defaultValue={task?.deliverable}
                required
                minLength={3}
                maxLength={800}
                rows={3}
                disabled={!!task && !leader}
                placeholder="What do you need to show the team for the task to count as done?"
              />
            </label>
            <label>
              Estimate, hours
              <input
                name="estimate"
                type="number"
                min="0.25"
                max="100"
                step="0.25"
                value={estimateInput}
                onChange={(e) => setEstimateInput(e.target.value)}
                required
                disabled={!!task && !leader}
              />
            </label>
            <label>
              Required skill
              <select
                name="skill"
                defaultValue={task?.skill || "Any skill"}
                disabled={!!task && !leader}
              >
                {SKILLS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {task && task.status === "planned" && (
              <div className="estimation-poker-box full">
                <div className="estimation-poker-header">
                  <div>
                    <strong>
                      <Scale size={15} /> Quick team estimate check
                    </strong>
                    <span>
                      {task.estimateSummary?.count
                        ? `Votes: ${task.estimateSummary.count} · median ${hours(task.estimateSummary.median!)} h (range ${hours(task.estimateSummary.min!)}–${hours(task.estimateSummary.max!)} h)`
                        : "Estimate the task to spot disagreements before starting"}
                    </span>
                  </div>
                  {leader &&
                    task.estimateSummary?.median &&
                    task.estimateSummary.median !== Number(estimateInput) && (
                      <button
                        type="button"
                        className="apply-median-btn"
                        onClick={() =>
                          setEstimateInput(String(task.estimateSummary!.median))
                        }
                      >
                        Use the median ({hours(task.estimateSummary.median)} h)
                      </button>
                    )}
                </div>
                <div className="estimation-chips">
                  {QUICK_ESTIMATES.map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={busy}
                      className={
                        "estimate-chip" + (myVote === h ? " active" : "")
                      }
                      onClick={() => void voteEstimate(h)}
                    >
                      {h} h
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label>
              Dependency
              <select
                name="dependencyId"
                defaultValue={task?.dependencyId || ""}
                disabled={!!task && !leader}
              >
                <option value="">Can start independently</option>
                {state.tasks
                  .filter((t) => t.id !== task?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </label>
            {task && (
              <label>
                Assignee
                <select
                  name="assigneeId"
                  defaultValue={task.assigneeId || ""}
                  disabled={!leader}
                >
                  <option value="">Unassigned</option>
                  {state.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {task && (
              <>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Task["status"])
                    }
                    disabled={!writable}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
                <div className="quick-help">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={quickHelp}
                    disabled={!writable || task.status === "done"}
                    busy={busy}
                  >
                    <CircleAlert size={17} />
                    {task.helpReason ? "Help received" : "Need help"}
                  </Button>
                  {canClaim && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={claim}
                      busy={busy}
                    >
                      <HandHelping size={17} />
                      Take over task
                    </Button>
                  )}
                </div>
                <label className="full">
                  Result link or description
                  <textarea
                    name="evidence"
                    defaultValue={task.evidence}
                    rows={2}
                    maxLength={1200}
                    minLength={status === "done" ? 10 : undefined}
                    required={status === "done"}
                    disabled={!writable}
                    placeholder="Link to a commit or document, or a description of the result"
                  />
                </label>
                <label className="checkbox-label full">
                  <input
                    type="checkbox"
                    checked={needsHelp}
                    onChange={(e) => setNeedsHelp(e.target.checked)}
                    disabled={!writable}
                  />
                  Blocked, need help
                </label>
                {needsHelp && (
                  <label className="full">
                    What would help you continue?
                    <textarea
                      name="helpReason"
                      defaultValue={task.helpReason || ""}
                      required
                      minLength={3}
                      maxLength={400}
                      rows={2}
                      disabled={!writable}
                    />
                  </label>
                )}
                {leader && (
                  <label className="checkbox-label full">
                    <input name="override" type="checkbox" />
                    I confirm a manual exception if the assignment exceeds
                    availability or does not match the skill
                  </label>
                )}
              </>
            )}
          </div>
          <ErrorBox error={error} />
          <div className="modal-actions">
            {task && leader && task.status === "planned" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                busy={busy}
              >
                <Trash2 size={16} />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div>
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
              {(!task || writable) && (
                <Button type="submit" busy={busy}>
                  <Check size={17} />
                  {task ? "Save" : "Create task"}
                </Button>
              )}
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
