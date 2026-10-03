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
  const eligible = (t: Task) =>
    members.filter(
      (m) =>
        m.capacity > 0 &&
        (t.skill === "Любой навык" || m.skills.includes(t.skill)),
    );
  const sorted = [...candidates].sort(
    (a, b) =>
      eligible(a).length - eligible(b).length ||
      b.estimate - a.estimate ||
      a.id.localeCompare(b.id),
  );
  const assignments: Assignment[] = [];
  const warnings: string[] = [];
  for (const task of sorted) {
    const skilled = eligible(task);
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
        reason: `Навык «${task.skill}», после назначения ${after} из ${chosen.capacity} ч (${Math.round((after / chosen.capacity) * 100)}%).`,
      });
    } else {
      const reason = skilled.length
        ? "У подходящих участников недостаточно свободных часов."
        : "Нет доступного участника с обязательным навыком.";
      assignments.push({
        taskId: task.id,
        memberId: null,
        estimate: task.estimate,
        reason,
      });
      warnings.push(`«${task.title}»: ${reason}`);
    }
  }
  const stableMembers = [...members].sort((a, b) => a.id.localeCompare(b.id));
  for (const m of stableMembers)
    if ((start.get(m.id) || 0) > m.capacity)
      warnings.push(`${m.name}: уже принятая нагрузка превышает доступность.`);
  for (const a of assignments) {
    const member = members.find((m) => m.id === a.memberId);
    const task = tasks.find((t) => t.id === a.taskId);
    if (member && task) {
      const final = loads.get(member.id) || 0;
      a.reason = `Навык «${task.skill}», итоговый план ${final} из ${member.capacity} ч (${Math.round((final / member.capacity) * 100)}%).`;
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
