import type { Assignment, Member, Task } from "../shared/types.js";
/** Greedy, deterministic, capacity-limited baseline. All assignments remain proposals. */
export function propose(tasks: Task[], members: Member[]) {
  const candidates = tasks.filter((t) => t.status === "planned");
  const loads = new Map(
    members.map((m) => [
      m.id,
      m.load -
        candidates
          .filter((t) => t.assigneeId === m.id)
          .reduce((s, t) => s + t.estimate, 0),
    ]),
  );
  const start = new Map(loads);
  const confident = (t: Task) =>
    members.filter(
      (m) =>
        m.capacity > 0 &&
        (t.skill === "Any skill" || m.skills.includes(t.skill)),
    );
  const learners = (t: Task) =>
    members.filter(
      (m) =>
        m.capacity > 0 &&
        t.skill !== "Any skill" &&
        !m.skills.includes(t.skill) &&
        (m.learningSkills || []).includes(t.skill),
    );
  const sorted = [...candidates].sort(
    (a, b) =>
      confident(a).length +
        learners(a).length -
        (confident(b).length + learners(b).length) ||
      confident(a).length - confident(b).length ||
      b.estimate - a.estimate ||
      a.id.localeCompare(b.id),
  );
  const assignments: Assignment[] = [];
  const warnings: string[] = [];
  for (const task of sorted) {
    const skilled = confident(task);
    const fitting = skilled.filter(
      (m) => (loads.get(m.id) || 0) + task.estimate <= m.capacity,
    );
    fitting.sort(
      (a, b) =>
        ((loads.get(a.id) || 0) + task.estimate) / a.capacity -
          ((loads.get(b.id) || 0) + task.estimate) / b.capacity ||
        a.id.localeCompare(b.id),
    );
    const chosen = fitting[0];
    if (chosen) {
      const after = (loads.get(chosen.id) || 0) + task.estimate;
      loads.set(chosen.id, after);
      assignments.push({
        taskId: task.id,
        memberId: chosen.id,
        estimate: task.estimate,
        isStretch: false,
        reason: `Skill “${task.skill}”, after assignment ${after} of ${chosen.capacity} h (${Math.round((after / chosen.capacity) * 100)}%).`,
      });
    } else {
      const stretchPool = learners(task).filter(
        (m) => (loads.get(m.id) || 0) + task.estimate <= m.capacity,
      );
      stretchPool.sort(
        (a, b) =>
          ((loads.get(a.id) || 0) + task.estimate) / a.capacity -
            ((loads.get(b.id) || 0) + task.estimate) / b.capacity ||
          a.id.localeCompare(b.id),
      );
      const stretchChosen = stretchPool[0];
      if (stretchChosen) {
        const after = (loads.get(stretchChosen.id) || 0) + task.estimate;
        loads.set(stretchChosen.id, after);
        assignments.push({
          taskId: task.id,
          memberId: stretchChosen.id,
          estimate: task.estimate,
          isStretch: true,
          reason: `Learning skill “${task.skill}” (wants to learn), after assignment ${after} of ${stretchChosen.capacity} h (${Math.round((after / stretchChosen.capacity) * 100)}%).`,
        });
      } else {
        const reason =
          skilled.length || learners(task).length
            ? "Matching members do not have enough free hours."
            : "No available member has the required skill.";
        assignments.push({
          taskId: task.id,
          memberId: null,
          estimate: task.estimate,
          reason,
        });
        warnings.push(`«${task.title}»: ${reason}`);
      }
    }
  }
  const stableMembers = [...members].sort((a, b) => a.id.localeCompare(b.id));
  for (const m of stableMembers)
    if ((start.get(m.id) || 0) > m.capacity)
      warnings.push(
        `${m.name}: already approved workload exceeds availability.`,
      );
  for (const a of assignments) {
    const member = members.find((m) => m.id === a.memberId);
    const task = tasks.find((t) => t.id === a.taskId);
    if (member && task) {
      const final = loads.get(member.id) || 0;
      const pct = Math.round((final / member.capacity) * 100);
      a.reason = a.isStretch
        ? `Learning skill “${task.skill}” (wants to learn), total plan ${final} of ${member.capacity} h (${pct}%).`
        : `Skill “${task.skill}”, total plan ${final} of ${member.capacity} h (${pct}%).`;
    }
  }
  return {
    assignments,
    loads: stableMembers.map((m) => ({
      memberId: m.id,
      name: m.name,
      capacity: m.capacity,
      before: start.get(m.id) || 0,
      after: loads.get(m.id) || 0,
    })),
    warnings,
  };
}
