export type TaskStatus = "planned" | "in_progress" | "done";
export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  skills: string[];
  learningSkills?: string[];
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
export interface TaskEstimateSummary {
  count: number;
  min: number | null;
  max: number | null;
  median: number | null;
  myEstimate: number | null;
  spreadWarning: boolean;
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
  startedAt?: string | null;
  firstEvidenceAt?: string | null;
  doneAt?: string | null;
  checklistTotal?: number;
  checklistDone?: number;
  staleStart?: boolean;
  estimateSummary?: TaskEstimateSummary;
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
  isStretch?: boolean;
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
export interface MilestoneTemplate {
  id: string;
  name: string;
  description: string;
  tasks: {
    title: string;
    goal: string;
    firstStep: string;
    deliverable: string;
    estimate: number;
    skill: string;
    checklist: string[];
  }[];
}
