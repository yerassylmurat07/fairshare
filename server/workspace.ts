import type { Sql } from "./db.js";
import type {
  User,
  Member,
  Project,
  Milestone,
  Task,
  ProjectState,
  TaskEstimateSummary,
} from "../shared/types.js";
import { camel, HttpError, hashToken } from "./security.js";

const STALE_START_MS = 24 * 60 * 60 * 1000;

export async function userById(tx: Sql, id: string) {
  const { rows } = await tx.query(
    "SELECT id,name,email,initials,color,skills,learning_skills FROM users WHERE id=$1",
    [id],
  );
  if (!rows[0]) return null;
  const u = camel<User>(rows[0]);
  return { ...u, learningSkills: u.learningSkills || [] };
}

export async function projectsFor(tx: Sql, userId: string) {
  const { rows } = await tx.query(
    "SELECT p.*,t.name AS team_name FROM projects p JOIN teams t ON t.id=p.team_id JOIN memberships m ON m.team_id=p.team_id WHERE m.user_id=$1 ORDER BY p.course DESC,p.name",
    [userId],
  );
  return rows.map((r) => camel<Project>(r));
}

export async function access(
  tx: Sql,
  userId: string,
  projectId: string,
  leader = false,
) {
  const { rows } = await tx.query(
    "SELECT p.*,t.name AS team_name,m.role FROM projects p JOIN teams t ON t.id=p.team_id JOIN memberships m ON m.team_id=p.team_id WHERE p.id=$1 AND m.user_id=$2",
    [projectId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "Project not available.");
  if (leader && rows[0].role !== "leader")
    throw new HttpError(403, "Only the team coordinator can do this.");
  return camel<Project & { role: "leader" | "member" }>(rows[0]);
}

export async function lockTeam(
  tx: Sql,
  userId: string,
  projectId: string,
  leader = false,
) {
  const project = await access(tx, userId, projectId, leader);
  await tx.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [
    project.teamId,
  ]);
  await tx.query(
    "SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.team_id=$1 ORDER BY u.id FOR UPDATE OF u",
    [project.teamId],
  );
  return project;
}

function buildEstimateSummary(
  taskEstimate: number,
  votes: { userId: string; hours: number }[],
  currentUserId: string,
): TaskEstimateSummary {
  if (!votes.length) {
    return {
      count: 0,
      min: null,
      max: null,
      median: null,
      myEstimate: null,
      spreadWarning: false,
    };
  }
  const sorted = votes.map((v) => v.hours).sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  const myEstimate =
    votes.find((v) => v.userId === currentUserId)?.hours ?? null;
  const spreadWarning =
    (votes.length >= 2 && (max - min >= 2 || max / Math.max(min, 0.25) >= 1.75)) ||
    Math.abs(median - taskEstimate) >= 2;
  return {
    count: votes.length,
    min,
    max,
    median,
    myEstimate,
    spreadWarning,
  };
}

export async function state(
  tx: Sql,
  userId: string,
  projectId: string,
  milestoneId?: string,
): Promise<ProjectState> {
  const project = await access(tx, userId, projectId);
  const ms = await tx.query(
    "SELECT * FROM milestones WHERE project_id=$1 ORDER BY due_date,id",
    [projectId],
  );
  const milestones = ms.rows.map((r) => {
    const m = camel<Milestone>(r);
    return {
      ...m,
      weekStart: m.weekStart.slice(0, 10),
      dueDate: m.dueDate.slice(0, 10),
    };
  });
  const milestone = milestoneId
    ? milestones.find((m) => m.id === milestoneId)
    : milestones[0];
  if (!milestone) throw new HttpError(404, "Milestone not found.");
  milestone.weekStart = milestone.weekStart.slice(0, 10);
  milestone.dueDate = milestone.dueDate.slice(0, 10);

  const memberRows = await tx.query(
    `SELECT u.id,u.name,u.email,u.initials,u.color,u.skills,u.learning_skills,m.role,COALESCE(a.hours,0) AS capacity,
 COALESCE((SELECT SUM(task.estimate) FROM tasks task JOIN milestones ms ON ms.id=task.milestone_id WHERE task.assignee_id=u.id AND ms.week_start=$2 AND task.status<>'done'),0) AS load
 FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN availability a ON a.user_id=u.id AND a.week_start=$2 WHERE m.team_id=$1 ORDER BY CASE WHEN m.role='leader' THEN 0 ELSE 1 END,u.created_at,u.id`,
    [project.teamId, milestone.weekStart],
  );

  const taskRows = await tx.query(
    `SELECT t.*,
      (SELECT count(*)::int FROM checklist c WHERE c.task_id=t.id) AS checklist_total,
      (SELECT count(*)::int FROM checklist c WHERE c.task_id=t.id AND c.done=true) AS checklist_done
     FROM tasks t WHERE t.milestone_id=$1 ORDER BY t.created_at,t.id`,
    [milestone.id],
  );

  const estimateRows = await tx.query<{
    task_id: string;
    user_id: string;
    hours: string | number;
  }>(
    `SELECT te.task_id, te.user_id, te.hours
     FROM task_estimates te
     JOIN tasks t ON t.id = te.task_id
     WHERE t.milestone_id = $1`,
    [milestone.id],
  );

  const votesByTask = new Map<string, { userId: string; hours: number }[]>();
  for (const row of estimateRows.rows) {
    const list = votesByTask.get(row.task_id) || [];
    list.push({ userId: row.user_id, hours: Number(row.hours) });
    votesByTask.set(row.task_id, list);
  }

  const nowMs = Date.now();

  const tasks = taskRows.rows.map((r) => {
    const t = camel<Task>(r);
    const checklistTotal = Number(r.checklist_total || 0);
    const checklistDone = Number(r.checklist_done || 0);
    const startedMs = t.startedAt ? new Date(t.startedAt).getTime() : null;
    const staleStart =
      t.status === "in_progress" &&
      !t.helpReason &&
      t.evidence.trim().length < 10 &&
      checklistDone === 0 &&
      startedMs !== null &&
      nowMs - startedMs >= STALE_START_MS;

    return {
      ...t,
      checklistTotal,
      checklistDone,
      staleStart,
      estimateSummary: buildEstimateSummary(
        t.estimate,
        votesByTask.get(t.id) || [],
        userId,
      ),
    };
  });

  return {
    project,
    milestone,
    milestones,
    members: memberRows.rows.map((r) => {
      const m = camel<Member>(r);
      return { ...m, learningSkills: m.learningSkills || [] };
    }),
    tasks,
    role: project.role,
  };
}

export function signature(s: ProjectState) {
  return hashToken(
    JSON.stringify({
      milestone: s.milestone.id,
      revision: s.milestone.revision,
      tasks: s.tasks
        .map((t) => ({ id: t.id, version: t.version }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      members: s.members
        .map((m) => ({
          id: m.id,
          skills: [...m.skills].sort(),
          learningSkills: [...(m.learningSkills || [])].sort(),
          capacity: m.capacity,
          load: m.load,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }),
  );
}
