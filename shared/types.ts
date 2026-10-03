export type TaskStatus = "planned" | "in_progress" | "done";
export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  skills: string[];
}
export interface Member extends User {
  role: "leader" | "member";
  capacity: number;
  load: number;
}
export interface Project {
  id: string;
  teamId: string;
  name: string;
  course: string;
  teamName: string;
}
export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  weekStart: string;
  revision: number;
}
export interface Task {
  id: string;
  projectId: string;
  milestoneId: string;
  title: string;
  goal: string;
  firstStep: string;
  deliverable: string;
  estimate: number;
  skill: string;
  assigneeId: string | null;
  status: TaskStatus;
  helpReason: string | null;
  evidence: string;
  dependencyId: string | null;
  version: number;
  createdAt: string;
}
export interface Workspace {
  user: User;
  projects: Project[];
}
export interface ProjectState {
  project: Project;
  milestone: Milestone;
  milestones: Milestone[];
  members: Member[];
  tasks: Task[];
  role: "leader" | "member";
}
export interface Assignment {
  taskId: string;
  memberId: string | null;
  reason: string;
  estimate: number;
}
export interface Allocation {
  id: string;
  milestoneId: string;
  revision: number;
  status: "pending" | "approved";
  assignments: Assignment[];
  loads: {
    memberId: string;
    name: string;
    capacity: number;
    before: number;
    after: number;
  }[];
  warnings: string[];
}
