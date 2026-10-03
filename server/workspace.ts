import type { Sql } from "./db.js";
import type {
  User,
  Member,
  Project,
  Milestone,
  Task,
  ProjectState,
} from "../shared/types.js";
import { camel, HttpError, hashToken } from "./security.js";
export async function userById(tx: Sql, id: string) {
  const { rows } = await tx.query(
    "SELECT id,name,email,initials,color,skills FROM users WHERE id=$1",
    [id],
  );
  return rows[0] ? camel<User>(rows[0]) : null;
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
  if (!rows[0]) throw new HttpError(404, "Проект недоступен.");
  if (leader && rows[0].role !== "leader")
    throw new HttpError(403, "Это действие доступно координатору команды.");
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
  if (!milestone) throw new HttpError(404, "Этап не найден.");
  milestone.weekStart = milestone.weekStart.slice(0, 10);
  milestone.dueDate = milestone.dueDate.slice(0, 10);
  const memberRows = await tx.query(
    `SELECT u.id,u.name,u.email,u.initials,u.color,u.skills,m.role,COALESCE(a.hours,0) AS capacity,
 COALESCE((SELECT SUM(task.estimate) FROM tasks task JOIN milestones ms ON ms.id=task.milestone_id WHERE task.assignee_id=u.id AND ms.week_start=$2 AND task.status<>'done'),0) AS load
 FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN availability a ON a.user_id=u.id AND a.week_start=$2 WHERE m.team_id=$1 ORDER BY CASE WHEN m.role='leader' THEN 0 ELSE 1 END,u.created_at,u.id`,
    [project.teamId, milestone.weekStart],
  );
  const taskRows = await tx.query(
    "SELECT * FROM tasks WHERE milestone_id=$1 ORDER BY created_at,id",
    [milestone.id],
  );
  return {
    project,
    milestone,
    milestones,
    members: memberRows.rows.map((r) => camel<Member>(r)),
    tasks: taskRows.rows.map((r) => camel<Task>(r)),
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
          capacity: m.capacity,
          load: m.load,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }),
  );
}
