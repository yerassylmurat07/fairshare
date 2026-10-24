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
            Availability for the week of{" "}
            {new Date(state.milestone.weekStart).toLocaleDateString("en-US", {
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
          My availability
        </Button>
      </div>
      <div className="member-list">
        {state.members.map((m) => (
          <div key={m.id} className="team-member">
            <Avatar user={m} />
            <div>
              <strong>
                {m.name}
                {m.id === user.id && <span className="muted"> · you</span>}
              </strong>
              <small>
                {m.role === "leader" ? "Coordinator" : "Member"} ·{" "}
                {hours(m.capacity)} h / week
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
                        title="Wants to learn on the job"
                      >
                        + {s}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="muted">No skills listed yet</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="collaboration-columns">
        <section>
          <div className="section-row">
            <h3>Shared resources</h3>
            <button
              className="icon-button"
              aria-label="Add resource"
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
              Keep the repository, requirements, mockups and shared documents
              here.
            </p>
          )}
        </section>
        <section>
          <div className="section-row">
            <h3>Team decisions</h3>
            <button
              className="icon-button"
              aria-label="Propose a decision"
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
                    ? "Under discussion"
                    : d.status === "accepted"
                      ? "Accepted"
                      : "Rejected"}
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
                    For · {d.yes}
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
                    Against · {d.no}
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
                        Accept
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void mutate(path + "/decisions/" + d.id, "PATCH", {
                            status: "declined",
                          })
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="empty-copy">
              Propose decisions, vote and record what you agreed.
            </p>
          )}
        </section>
      </div>
      <ErrorBox error={dialog ? "" : error} />
      {dialog && (
        <Modal
          title={
            dialog === "availability"
              ? "My availability"
              : dialog === "resource"
                ? "Shared resource"
                : "Propose a decision"
          }
          onClose={() => setDialog(null)}
        >
          <form onSubmit={submit}>
            {dialog === "availability" ? (
              <>
                <p className="muted">
                  Total available time across all projects for the selected
                  week. Only you can change your hours.
                </p>
                <label>
                  Available hours
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
                  <legend>My skills (confident)</legend>
                  {SKILLS.filter((s) => s !== "Any skill").map((s) => (
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
                  <legend>Want to learn</legend>
                  {SKILLS.filter((s) => s !== "Any skill").map((s) => (
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
                  Title
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Project repository"
                  />
                </label>
                <label>
                  Link
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
                  Proposal
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={120}
                    placeholder="What needs to be decided?"
                  />
                </label>
                <label>
                  Context and arguments
                  <textarea
                    name="context"
                    required
                    maxLength={2000}
                    rows={4}
                    placeholder="Why does it matter and which options were discussed?"
                  />
                </label>
              </>
            )}
            <ErrorBox error={error} />
            <div className="modal-actions">
              <span />
              <Button type="submit" busy={busy}>
                <Check size={17} />
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
