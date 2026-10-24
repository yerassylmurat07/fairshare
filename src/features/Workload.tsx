import { CircleAlert, ArrowUpRight } from "lucide-react";
import type { Member, Task } from "../../shared/types";
import { Avatar, hours, Progress } from "../components/ui";
export function WorkloadRail({
  members,
  tasks,
  onTask,
}: {
  members: Member[];
  tasks: Task[];
  onTask: (t: Task) => void;
}) {
  const needingHelp = tasks.filter((t) => t.helpReason);
  return (
    <aside className="workload-rail">
      <h2>Team workload</h2>
      <p className="muted">Plan for this week</p>
      <div className="workload-members">
        {members.map((m) => (
          <div key={m.id} className="load-member">
            <Avatar user={m} />
            <div>
              <div className="load-name">
                <strong>{m.name.split(" ")[0]}</strong>
                <span>
                  {hours(m.load)} / {hours(m.capacity)} h
                </span>
              </div>
              <Progress value={m.load} capacity={m.capacity} />
              {m.load > m.capacity && (
                <small className="warning-text">
                  Workload above availability
                </small>
              )}
            </div>
          </div>
        ))}
      </div>
      {needingHelp.map((t) => (
        <button key={t.id} className="help-notice" onClick={() => onTask(t)}>
          <CircleAlert size={22} />
          <div>
            <strong>Help needed now</strong>
            <p>
              {members.find((m) => m.id === t.assigneeId)?.name.split(" ")[0] ||
                "Team"}
              : {t.helpReason}
            </p>
          </div>
        </button>
      ))}
      <p className="rail-footnote">
        We count planned hours, not contribution or grades.
      </p>
    </aside>
  );
}
export function WorkloadTable({ members }: { members: Member[] }) {
  return (
    <section className="workspace-section">
      <h2>Weekly plan</h2>
      <p className="muted">
        Workload includes unfinished tasks in all of a member's projects for the
        selected week.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Availability</th>
              <th>Planned</th>
              <th>Remaining</th>
              <th>Load</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="person-cell">
                    <Avatar user={m} small />
                    <strong>{m.name}</strong>
                  </div>
                </td>
                <td>{hours(m.capacity)} h</td>
                <td>{hours(m.load)} h</td>
                <td className={m.load > m.capacity ? "warning-text" : ""}>
                  {hours(m.capacity - m.load)} h
                </td>
                <td>
                  <div className="table-progress">
                    <Progress value={m.load} capacity={m.capacity} />
                    <span>
                      {m.capacity
                        ? Math.round((m.load / m.capacity) * 100) + "%"
                        : m.load
                          ? "No availability"
                          : "—"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="plain-note">
        <ArrowUpRight size={20} />
        <p>
          If hours run short, reduce the scope, move tasks or agree on a manual
          exception. The algorithm never assigns hidden overload.
        </p>
      </div>
    </section>
  );
}
