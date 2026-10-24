import { useEffect, useState, type FormEvent } from "react";
import { Copy, Check, ArrowRight } from "lucide-react";
import type { ProjectState, MilestoneTemplate } from "../../shared/types";
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
    <Modal title="New project" onClose={onClose}>
      <p className="muted">
        For team {state.project.teamName}. The new project starts with a first
        milestone.
      </p>
      <form onSubmit={submit}>
        <label>
          Project name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="For example, a team course project"
          />
        </label>
        <label>
          Course or subject
          <input
            name="course"
            maxLength={60}
            placeholder="For example, ISE4133"
          />
        </label>
        <ErrorBox error={error} />
        <div className="modal-actions">
          <span />
          <Button type="submit" busy={busy}>
            Create project
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
  const [templates, setTemplates] = useState<MilestoneTemplate[]>([]);
  useEffect(() => {
    api<{ templates: MilestoneTemplate[] }>("/templates")
      .then((res) => setTemplates(res.templates))
      .catch(() => {});
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(f) as Record<string, string>;
    if (!body.templateId) delete body.templateId;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>(
        `/projects/${state.project.id}/milestones`,
        { method: "POST", body },
      );
      onCreated(id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="New milestone" onClose={onClose}>
      <p className="muted">
        In the MVP each milestone covers one week. For longer work create
        several milestones.
      </p>
      <form onSubmit={submit}>
        <label>
          Title
          <input
            name="title"
            required
            minLength={2}
            maxLength={100}
            placeholder="What should the team end up with?"
          />
        </label>
        <label>
          Starter task template
          <select name="templateId" defaultValue="">
            <option value="">No template (empty milestone)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.tasks.length} tasks)
              </option>
            ))}
          </select>
        </label>
        <label>
          Week start (Monday)
          <input
            name="weekStart"
            type="date"
            defaultValue={state.milestone.weekStart}
            required
          />
        </label>
        <label>
          Milestone due
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
            Create milestone
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
    <Modal title="Team invitation" onClose={onClose}>
      {state.role === "leader" && (
        <>
          <p className="muted">
            Single-use link for {state.project.teamName}. Valid for 24 hours.
            Send it to the member yourself.
          </p>
          {link ? (
            <>
              <label>
                Link
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
                    setError("Select and copy the link from the field.");
                  }
                }}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </>
          ) : (
            <Button onClick={create} busy={busy}>
              Create link
            </Button>
          )}
        </>
      )}
      <div className="join-section">
        <h3>Join another team</h3>
        <form onSubmit={join}>
          <label>
            Invitation link or code
            <input
              name="token"
              required
              minLength={30}
              placeholder="Paste the invitation"
            />
          </label>
          <Button variant="secondary" type="submit" busy={busy}>
            Join
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
    <Modal title="How FairShare works" onClose={onClose}>
      <div className="help-steps">
        <section>
          <span>01</span>
          <div>
            <h3>Give a clear first step</h3>
            <p>
              Create a milestone and tasks with a goal, a concrete first action
              and an expected result.
            </p>
          </div>
        </section>
        <section>
          <span>02</span>
          <div>
            <h3>Agree on available time</h3>
            <p>
              Each member enters their own skills and hours for the week.
              Workload is counted across all projects at once.
            </p>
          </div>
        </section>
        <section>
          <span>03</span>
          <div>
            <h3>Review the suggestion together</h3>
            <p>
              The algorithm picks an assignee by skill and the ratio of hours to
              availability. The coordinator approves the suggestion after
              discussion.
            </p>
          </div>
        </section>
        <section>
          <span>04</span>
          <div>
            <h3>Start working and ask for help</h3>
            <p>
              Move the task to in progress and use the checklist and discussion.
              The “Need help” button makes a blocker visible right away.
            </p>
          </div>
        </section>
        <section>
          <span>05</span>
          <div>
            <h3>Save the shared result</h3>
            <p>
              Add a link or a description of the result before completing.
              Resources, votes and history are visible to the whole team.
            </p>
          </div>
        </section>
      </div>
      <p className="plain-note">
        Hours are a planning estimate. FairShare does not measure work quality,
        give grades or guarantee anyone's motivation.
      </p>
    </Modal>
  );
}
