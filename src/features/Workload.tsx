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
      <h2>Нагрузка команды</h2>
      <p className="muted">План на эту неделю</p>
      <div className="workload-members">
        {members.map((m) => (
          <div key={m.id} className="load-member">
            <Avatar user={m} />
            <div>
              <div className="load-name">
                <strong>{m.name.split(" ")[0]}</strong>
                <span>
                  {hours(m.load)} / {hours(m.capacity)} ч
                </span>
              </div>
              <Progress value={m.load} capacity={m.capacity} />
              {m.load > m.capacity && (
                <small className="warning-text">
                  Нагрузка выше доступности
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
            <strong>Помощь нужна вовремя</strong>
            <p>
              {members.find((m) => m.id === t.assigneeId)?.name.split(" ")[0] ||
                "Команда"}
              : {t.helpReason}
            </p>
          </div>
        </button>
      ))}
      <p className="rail-footnote">
        Считаем запланированные часы, а не вклад или оценки.
      </p>
    </aside>
  );
}
export function WorkloadTable({ members }: { members: Member[] }) {
  return (
    <section className="workspace-section">
      <h2>Общий план на неделю</h2>
      <p className="muted">
        Нагрузка учитывает незавершённые задачи во всех проектах участника за
        выбранную неделю.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Участник</th>
              <th>Доступность</th>
              <th>Запланировано</th>
              <th>Осталось</th>
              <th>Загрузка</th>
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
                <td>{hours(m.capacity)} ч</td>
                <td>{hours(m.load)} ч</td>
                <td className={m.load > m.capacity ? "warning-text" : ""}>
                  {hours(m.capacity - m.load)} ч
                </td>
                <td>
                  <div className="table-progress">
                    <Progress value={m.load} capacity={m.capacity} />
                    <span>
                      {m.capacity
                        ? Math.round((m.load / m.capacity) * 100) + "%"
                        : m.load
                          ? "Нет доступности"
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
          Если часов не хватает, уменьшите объём, перенесите задачи или
          договоритесь о ручном исключении. Алгоритм не назначает скрытую
          перегрузку.
        </p>
      </div>
    </section>
  );
}
