import { useState } from "react";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";
import type { Allocation, ProjectState } from "../../shared/types";
import { api, message } from "../lib/api";
import { Modal, Button, ErrorBox, Progress, hours } from "../components/ui";
export function AllocationDialog({
  allocation: initial,
  state,
  onClose,
  onApproved,
}: {
  allocation: Allocation;
  state: ProjectState;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [allocation, setAllocation] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  async function recalculate() {
    setBusy(true);
    setError("");
    try {
      setAllocation(
        await api<Allocation>(`/projects/${state.project.id}/allocations`, {
          method: "POST",
          body: { milestoneId: state.milestone.id },
        }),
      );
      setStale(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    setBusy(true);
    setError("");
    try {
      await api(
        `/projects/${state.project.id}/allocations/${allocation.id}/approve`,
        { method: "POST" },
      );
      onApproved();
    } catch (e) {
      setError(message(e));
      setStale(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Task allocation" onClose={onClose} wide>
      <p className="modal-description">
        A suggestion based on skills and free hours. The team makes the
        decision.
      </p>
      <div className="table-scroll">
        <table className="data-table allocation-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Member</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {allocation.assignments.map((a) => (
              <tr key={a.taskId}>
                <td>
                  <strong>
                    {state.tasks.find((t) => t.id === a.taskId)?.title}
                  </strong>
                  <small>{hours(a.estimate)} h</small>
                </td>
                <td>
                  {state.members
                    .find((m) => m.id === a.memberId)
                    ?.name.split(" ")[0] || "Unassigned"}
                </td>
                <td>{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="section-heading">Workload after allocation</h3>
      <div className="allocation-loads">
        {allocation.loads.map((m) => (
          <div key={m.memberId}>
            <div className="load-name">
              <strong>{m.name.split(" ")[0]}</strong>
              <span>
                {hours(m.after)} / {hours(m.capacity)} h
              </span>
            </div>
            <Progress value={m.after} capacity={m.capacity} />
          </div>
        ))}
      </div>
      {allocation.warnings.length > 0 && (
        <div className="warning-note">
          <AlertTriangle size={19} />
          <div>
            {allocation.warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </div>
      )}
      <p className="muted small-copy">
        Tasks in progress keep their assignees. Completed tasks do not use
        available hours.
        {allocation.assignments.some((a) => !a.memberId) &&
          " Tasks that do not fit will stay unassigned."}
      </p>
      <ErrorBox error={error} />
      <div className="modal-actions">
        <Button variant="secondary" onClick={recalculate} busy={busy}>
          <RefreshCw size={16} />
          Recalculate
        </Button>
        <div>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={approve}
            busy={busy}
            disabled={stale || !allocation.assignments.some((a) => a.memberId)}
          >
            <Check size={17} />
            Approve allocation
          </Button>
        </div>
      </div>
    </Modal>
  );
}
