import test from "node:test";
import assert from "node:assert/strict";
import { propose } from "./allocation.js";
import type { Member, Task } from "../shared/types.js";
const member = (id: string, capacity: number, load = 0, skills = ["Backend"]) =>
  ({ id, name: id, capacity, load, skills }) as Member;
const task = (
  id: string,
  estimate: number,
  skill = "Backend",
  status: Task["status"] = "planned",
  assigneeId: string | null = null,
) => ({ id, title: id, estimate, skill, status, assigneeId }) as Task;
test("zero availability and missing skills leave the task unassigned, with explanation", () => {
  const p = propose([task("a", 2), task("b", 1, "Frontend")], [member("m", 0)]);
  assert.ok(p.assignments.every((a) => a.memberId === null));
  assert.equal(p.warnings.length, 2);
});
test("counts existing other-project load and freezes work in progress", () => {
  const p = propose(
    [task("a", 3), task("working", 5, "Backend", "in_progress", "m1")],
    [member("m1", 8, 7), member("m2", 8, 0)],
  );
  assert.equal(p.assignments.length, 1);
  assert.equal(p.assignments[0].memberId, "m2");
  assert.equal(p.loads.find((m) => m.memberId === "m1")?.after, 7);
});
test("replaces the selected planned allocation instead of double counting it", () => {
  const p = propose(
    [task("a", 6, "Backend", "planned", "m")],
    [member("m", 8, 6)],
  );
  assert.equal(p.loads[0].before, 0);
  assert.equal(p.loads[0].after, 6);
  assert.equal(p.assignments[0].memberId, "m");
});
test("assigns the scarcest skill first and never exceeds available hours", () => {
  const tasks = [task("b", 4, "Любой навык"), task("a", 4, "Backend")];
  const members = [
    member("m1", 4, 0, ["Backend"]),
    member("m2", 4, 0, ["Frontend"]),
  ];
  const p = propose(tasks, members);
  assert.equal(p.assignments.find((a) => a.taskId === "a")?.memberId, "m1");
  assert.equal(p.assignments.find((a) => a.taskId === "b")?.memberId, "m2");
  assert.ok(p.loads.every((m) => m.after <= m.capacity));
});
test("balances effort-to-availability ratios rather than equal task counts", () => {
  const p = propose(
    [task("a", 4), task("b", 4), task("c", 4)],
    [member("m1", 8), member("m2", 4)],
  );
  assert.equal(p.loads.find((m) => m.memberId === "m1")?.after, 8);
  assert.equal(p.loads.find((m) => m.memberId === "m2")?.after, 4);
});
test("no partial assignment for an oversized indivisible task; deterministic result", () => {
  const input = [task("b", 5), task("a", 2)];
  const members = [member("m2", 3), member("m1", 3)];
  const p = propose(input, members);
  assert.equal(p.assignments.find((a) => a.taskId === "b")?.memberId, null);
  assert.deepEqual(p, propose([...input].reverse(), [...members].reverse()));
});
