import {
  Folder,
  SquareCheck,
  CircleHelp,
  Plus,
  LogOut,
  Menu,
  UserPlus,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Workspace, ProjectState } from "../../shared/types";
import { Avatar, Brand, Button } from "./ui";
export function AppShell({
  workspace,
  state,
  view,
  children,
  onProject,
  onView,
  onInvite,
  onNewProject,
  onLogout,
  onHelp,
  onChangePassword,
}: {
  workspace: Workspace;
  state: ProjectState | null;
  view: "project" | "mine";
  children: ReactNode;
  onProject: (id: string) => void;
  onView: (v: "project" | "mine") => void;
  onInvite: () => void;
  onNewProject: () => void;
  onLogout: () => void;
  onHelp: () => void;
  onChangePassword: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  const choose = (id: string) => {
    onProject(id);
    setMobile(false);
  };
  return (
    <div className="app-shell">
      <aside className={"sidebar" + (mobile ? " mobile-open" : "")}>
        <Brand />
        <nav aria-label="Main navigation">
          <button
            className={view === "project" ? "selected" : ""}
            onClick={() => {
              onView("project");
              setMobile(false);
            }}
          >
            <Folder />
            My projects
          </button>
          <button
            className={view === "mine" ? "selected" : ""}
            onClick={() => {
              onView("mine");
              setMobile(false);
            }}
          >
            <SquareCheck />
            My tasks
          </button>
          <button
            onClick={() => {
              onHelp();
              setMobile(false);
            }}
          >
            <CircleHelp />
            How it works
          </button>
          <button
            onClick={() => {
              onChangePassword();
              setMobile(false);
            }}
          >
            <KeyRound />
            Change password
          </button>
        </nav>
        <div className="project-heading">
          <span>PROJECTS</span>
          <button
            className="icon-button"
            aria-label="Create project"
            title="Create project"
            onClick={onNewProject}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="project-list">
          {workspace.projects.map((p) => (
            <button
              key={p.id}
              className={
                p.id === state?.project.id && view === "project"
                  ? "selected"
                  : ""
              }
              onClick={() => choose(p.id)}
            >
              <span className="project-dot" />
              {p.name}
            </button>
          ))}
        </div>
        <div className="sidebar-user">
          <Avatar user={workspace.user} />
          <div>
            <strong>{workspace.user.name}</strong>
            <small>
              {workspace.user.email.endsWith(".demo")
                ? "Demo · sample data"
                : state?.project.teamName || "FairShare"}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={onLogout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open menu"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            <span>My projects</span>
            <ChevronRight size={15} />
            <strong>
              {view === "mine" ? "My tasks" : state?.project.name || "Loading"}
            </strong>
          </div>
          <div className="topbar-right">
            {state?.role === "leader" && (
              <Button variant="secondary" onClick={onInvite}>
                <UserPlus size={18} />
                Invite
              </Button>
            )}
            <div className="avatar-group">
              {state?.members.slice(0, 4).map((m) => (
                <Avatar key={m.id} user={m} small />
              ))}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
