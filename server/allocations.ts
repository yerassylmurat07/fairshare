import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "./db.js";
import type { Allocation } from "../shared/types.js";
import { authGuard } from "./auth.js";
import { uid, param, event } from "./projects.js";
import { state, signature, lockTeam } from "./workspace.js";
import { propose } from "./allocation.js";
import { HttpError } from "./security.js";
export async function allocationRoutes(app: FastifyInstance, db: Database) {
  const guard = authGuard(db);
  app.post(
    "/api/projects/:id/allocations",
    { preHandler: guard },
    async (req) => {
      const projectId = param(req);
      const { milestoneId } = z
        .object({ milestoneId: z.string().uuid() })
        .parse(req.body);
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), projectId, true);
        const s = await state(tx, uid(req), projectId, milestoneId);
        if (!s.tasks.some((t) => t.status === "planned"))
          throw new HttpError(
            400,
            "Добавьте хотя бы одну запланированную задачу.",
          );
        const payload: Allocation = {
          id: randomUUID(),
          milestoneId,
          revision: s.milestone.revision,
          status: "pending",
          ...propose(s.tasks, s.members),
        };
        await tx.query(
          "INSERT INTO allocations(id,milestone_id,created_by,snapshot,payload) VALUES($1,$2,$3,$4,$5)",
          [
            payload.id,
            milestoneId,
            uid(req),
            JSON.stringify({ signature: signature(s) }),
            JSON.stringify(payload),
          ],
        );
        return payload;
      });
    },
  );
  app.post(
    "/api/projects/:id/allocations/:allocationId/approve",
    { preHandler: guard },
    async (req) => {
      const projectId = param(req),
        id = param(req, "allocationId");
      return db.transaction(async (tx) => {
        await lockTeam(tx, uid(req), projectId, true);
        const { rows } = await tx.query(
          "SELECT a.* FROM allocations a JOIN milestones m ON m.id=a.milestone_id WHERE a.id=$1 AND m.project_id=$2 FOR UPDATE OF a",
          [id, projectId],
        );
        const row = rows[0];
        if (!row) throw new HttpError(404, "Предложение не найдено.");
        const payload = row.payload as unknown as Allocation;
        if (row.status === "approved")
          return { ...payload, status: "approved" };
        const s = await state(
          tx,
          uid(req),
          projectId,
          String(row.milestone_id),
        );
        if ((row.snapshot as { signature: string }).signature !== signature(s))
          throw new HttpError(
            409,
            "Нагрузка, состав команды или задачи изменились. Пересчитайте распределение.",
          );
        if (!payload.assignments.some((a) => a.memberId))
          throw new HttpError(
            400,
            "Нет подходящих назначений. Уточните навыки или доступность.",
          );
        for (const assignment of payload.assignments)
          await tx.query(
            "UPDATE tasks SET assignee_id=$2,version=version+1 WHERE id=$1 AND milestone_id=$3 AND status=$4",
            [assignment.taskId, assignment.memberId, s.milestone.id, "planned"],
          );
        await tx.query(
          "UPDATE milestones SET revision=revision+1 WHERE id=$1",
          [s.milestone.id],
        );
        await tx.query(
          "UPDATE allocations SET status='approved',approved_at=now() WHERE id=$1",
          [id],
        );
        await event(tx, projectId, uid(req), "allocation.approved", {
          id,
          assigned: payload.assignments.filter((a) => a.memberId).length,
        });
        return { ...payload, status: "approved" };
      });
    },
  );
}
