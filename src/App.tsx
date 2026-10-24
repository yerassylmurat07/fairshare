import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  List,
  Clock,
  Users,
  Equal,
  Plus,
  LoaderCircle,
  ChevronDown,
  UserPlus,
} from "lucide-react";
import type {
  Workspace,
  ProjectState,
  Allocation,
  Task,
  User,
} from "../shared/types";
import { api, ApiError, message } from "./lib/api";
import { Button, ErrorBox, hours, Brand } from "./components/ui";
import { AppShell } from "./components/AppShell";
import { AuthScreen } from "./features/AuthScreen";
import { ChangePasswordDialog } from "./features/ChangePasswordDialog";
import { Board } from "./features/Board";
import { WorkloadRail, WorkloadTable } from "./features/Workload";
import { AllocationDialog } from "./features/AllocationDialog";
import { TaskDialog } from "./features/TaskDialog";
import { TeamPanel } from "./features/TeamPanel";
import { Activity } from "./features/Activity";
import { MyTasks } from "./features/MyTasks";
import {
  CreateProject,
  CreateMilestone,
  InviteDialog,
  HelpDialog,
} from "./features/WorkspaceDialogs";
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [state, setState] = useState<ProjectState | null>(null),
    [initializing, setInitializing] = useState(true),
    [projectId, setProjectId] = useState(""),
    [milestoneId, setMilestoneId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Board"),
    [view, setView] = useState<"project" | "mine">("project");
  const [dialog, setDialog] = useState<
      | "task"
      | "allocation"
      | "invite"
      | "project"
      | "milestone"
      | "help"
      | "password"
      | null
    >(null),
    [task, setTask] = useState<Task | null>(null),
    [allocation, setAllocation] = useState<Allocation | null>(null),
    [notice, setNotice] = useState("");
  const pendingInvite = useRef(
    new URLSearchParams(location.search).get("invite"),
  );
  const requests = useRef(0);
  const pendingTask = useRef<string | null>(null);
  const bootstrap = useCallback(async () => {
    setError("");
    try {
      const session = await api<{ user: User | null }>("/auth/session");
      if (!session.user) {
        setWorkspace(null);
        return;
      }
      let w = await api<Workspace>("/workspace");
      if (pendingInvite.current) {
        try {
          await api("/invitations/accept", {
            method: "POST",
            body: { token: pendingInvite.current },
          });
          w = await api("/workspace");
          setNotice("You joined the team.");
        } catch (e) {
          setError(message(e));
        } finally {
          pendingInvite.current = null;
          history.replaceState(null, "", location.pathname);
        }
      }
      setWorkspace(w);
      setProjectId((current) =>
        w.projects.some((p) => p.id === current)
          ? current
          : w.projects[0]?.id || "",
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setWorkspace(null);
      else setError(message(e));
    } finally {
      setInitializing(false);
    }
  }, []);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  const refresh = useCallback(async () => {
    if (!workspace || !projectId) return;
    const seq = ++requests.current;
    try {
      const s = await api<ProjectState>(
        `/projects/${projectId}/state` +
          (milestoneId ? "?milestoneId=" + milestoneId : ""),
      );
      if (seq !== requests.current) return;
      setState(s);
      if (pendingTask.current) {
        const found = s.tasks.find((t) => t.id === pendingTask.current);
        if (found) {
          setTask(found);
          setDialog("task");
        }
        pendingTask.current = null;
      }
    } catch (e) {
      if (seq === requests.current) {
        if (e instanceof ApiError && e.status === 401) {
          setWorkspace(null);
          setState(null);
        } else setError(message(e));
      }
    }
  }, [workspace, projectId, milestoneId]);
  useEffect(() => {
    setState(null);
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      requests.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  function selectProject(id: string) {
    setProjectId(id);
    setMilestoneId("");
    setTab("Board");
    setView("project");
    setDialog(null);
    setError("");
  }
  async function suggest() {
    if (!state) return;
    setBusy(true);
    setError("");
    try {
      setAllocation(
        await api<Allocation>(`/projects/${state.project.id}/allocations`, {
          method: "POST",
          body: { milestoneId: state.milestone.id },
        }),
      );
      setDialog("allocation");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function saved(text = "Changes saved") {
    setDialog(null);
    setNotice(text);
    void refresh();
  }
  function openTask(t: Task) {
    setTask(t);
    setDialog("task");
  }
  if (initializing)
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" />
      </div>
    );
  if (!workspace)
    return (
      <>
        <AuthScreen
          onAuthenticated={async (acceptedInvite) => {
            if (acceptedInvite) {
              pendingInvite.current = null;
              history.replaceState(null, "", location.pathname);
              setNotice("You joined the team.");
            }
            await bootstrap();
          }}
          inviteToken={pendingInvite.current}
        />
        {error && (
          <div className="auth-global-error">
            <ErrorBox error={error} />
          </div>
        )}
      </>
    );
  return (
    <>
      <AppShell
        workspace={workspace}
        state={state}
        view={view}
        onProject={selectProject}
        onView={setView}
        onInvite={() => setDialog("invite")}
        onNewProject={() => {
          if (state?.role === "leader") setDialog("project");
          else setError("Only the team coordinator can create a project.");
        }}
        onLogout={async () => {
          await api("/auth/logout", { method: "POST" });
          setWorkspace(null);
          setState(null);
        }}
        onHelp={() => setDialog("help")}
        onChangePassword={() => setDialog("password")}
      >
        {view === "mine" ? (
          <MyTasks
            onOpen={(t) => {
              pendingTask.current = t.id;
              setView("project");
              setTab("Board");
              if (projectId === t.projectId && milestoneId === t.milestoneId) {
                openTask(t);
              } else {
                setProjectId(t.projectId);
                setMilestoneId(t.milestoneId);
              }
            }}
          />
        ) : !state ? (
          <div className="page-content">
            <ErrorBox error={error} />
            {!error && (
              <div className="loading">
                <LoaderCircle className="spin" />
                Loading the team workspace…
              </div>
            )}
          </div>
        ) : (
          <div className="page-content">
            <div className="project-meta">
              <span>
                {state.project.course}
                {state.project.course ? " · " : ""}
                {state.project.teamName}
              </span>
              {state.milestones.length > 1 && (
                <label className="milestone-picker">
                  <span className="sr-only">Current milestone</span>
                  <select
                    value={state.milestone.id}
                    onChange={(e) => setMilestoneId(e.target.value)}
                  >
                    {state.milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </label>
              )}
              {state.role === "leader" && (
                <button
                  className="icon-button add-milestone"
                  aria-label="Create milestone"
                  title="Create milestone"
                  onClick={() => setDialog("milestone")}
                >
                  <Plus size={17} />
                </button>
              )}
            </div>
            <div className="project-title">
              <div>
                <h1>{state.milestone.title}</h1>
                <p className="subtitle">
                  Clear tasks. Fair workload. Shared result.
                </p>
              </div>
              <div className="due-date">
                <CalendarDays size={25} />
                <div>
                  <span>Milestone due</span>
                  <strong>
                    {new Date(state.milestone.dueDate).toLocaleDateString(
                      "en-US",
                      { day: "numeric", month: "long", timeZone: "UTC" },
                    )}
                  </strong>
                </div>
              </div>
            </div>
            <div className="metrics">
              <span>
                <List size={21} />
                {state.tasks.length}{" "}
                {state.tasks.length === 1 ? "task" : "tasks"}
              </span>
              <span>
                <Clock size={21} />
                {hours(state.tasks.reduce((sum, t) => sum + t.estimate, 0))} h
                of work
              </span>
              <span>
                <Users size={22} />
                {state.members.length}{" "}
                {state.members.length === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="allocation-banner">
              <Equal size={36} strokeWidth={4} />
              <div>
                <strong>Start with a fair allocation</strong>
                <p>Compare the workload with each member's available time.</p>
              </div>
              <Button
                onClick={suggest}
                busy={busy}
                disabled={state.role !== "leader"}
                title={
                  state.role !== "leader"
                    ? "The coordinator approves the allocation"
                    : undefined
                }
              >
                Allocate tasks
              </Button>
            </div>
            <ErrorBox error={error} />
            <div className="workspace-toolbar">
              <div
                className="workspace-tabs"
                role="tablist"
                aria-label="Project sections"
              >
                {["Board", "Workload", "Team", "Activity"].map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setTask(null);
                  setDialog("task");
                }}
              >
                <Plus size={20} />
                New task
              </Button>
            </div>
            {tab === "Board" ? (
              <div className="board-layout">
                <Board
                  projectId={state.project.id}
                  milestoneId={state.milestone.id}
                  role={state.role}
                  user={workspace.user}
                  tasks={state.tasks}
                  members={state.members}
                  onTask={openTask}
                  onCreate={() => {
                    setTask(null);
                    setDialog("task");
                  }}
                  onChanged={(msg) => saved(msg)}
                  onError={(err) => setError(err)}
                />
                <WorkloadRail
                  members={state.members}
                  tasks={state.tasks}
                  onTask={openTask}
                />
              </div>
            ) : tab === "Workload" ? (
              <WorkloadTable members={state.members} />
            ) : tab === "Team" ? (
              <>
                <TeamPanel
                  state={state}
                  user={workspace.user}
                  onUpdated={() => void refresh()}
                />
                <Button variant="ghost" onClick={() => setDialog("invite")}>
                  <UserPlus size={17} />
                  Join another team
                </Button>
              </>
            ) : (
              <Activity projectId={state.project.id} />
            )}
          </div>
        )}
      </AppShell>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}{" "}
      {dialog === "password" && (
        <ChangePasswordDialog
          onClose={() => setDialog(null)}
          onSaved={() =>
            saved("Password changed. Other sessions were signed out.")
          }
        />
      )}
      {state && dialog === "task" && (
        <TaskDialog
          key={task?.id || "new"}
          task={task}
          state={state}
          user={workspace.user}
          onClose={() => setDialog(null)}
          onSaved={() => saved(task ? "Task updated" : "Task created")}
        />
      )}{" "}
      {state && dialog === "allocation" && allocation && (
        <AllocationDialog
          allocation={allocation}
          state={state}
          onClose={() => setDialog(null)}
          onApproved={() => saved("The team approved the allocation")}
        />
      )}{" "}
      {state && dialog === "invite" && (
        <InviteDialog
          state={state}
          onClose={() => setDialog(null)}
          onJoined={() => {
            setDialog(null);
            void bootstrap();
          }}
        />
      )}{" "}
      {state && dialog === "project" && (
        <CreateProject
          state={state}
          onClose={() => setDialog(null)}
          onCreated={(id) => {
            setDialog(null);
            void bootstrap();
            selectProject(id);
          }}
        />
      )}{" "}
      {state && dialog === "milestone" && (
        <CreateMilestone
          state={state}
          onClose={() => setDialog(null)}
          onCreated={(id) => {
            setDialog(null);
            setMilestoneId(id);
            setNotice("New milestone created");
          }}
        />
      )}
    </>
  );
}
