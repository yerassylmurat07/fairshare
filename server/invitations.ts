import type { Sql } from "./db.js";
import { hashToken, HttpError } from "./security.js";

// The caller owns the transaction, so joining and account creation are atomic.
export async function acceptInvitation(tx: Sql, raw: string, userId: string) {
  const hash = hashToken(raw);
  const initial = await tx.query(
    "SELECT team_id FROM invitations WHERE token_hash=$1",
    [hash],
  );
  if (!initial.rows[0])
    throw new HttpError(
      410,
      "The invitation has expired or was already used. Ask the coordinator for a new link.",
    );
  await tx.query("SELECT id FROM teams WHERE id=$1 FOR UPDATE", [
    initial.rows[0].team_id,
  ]);
  await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
  const { rows } = await tx.query(
    "SELECT * FROM invitations WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
    [hash],
  );
  if (!rows[0] || rows[0].used_by)
    throw new HttpError(
      410,
      "The invitation has expired or was already used. Ask the coordinator for a new link.",
    );
  await tx.query(
    "INSERT INTO memberships(team_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING",
    [rows[0].team_id, userId],
  );
  await tx.query("UPDATE invitations SET used_by=$2 WHERE token_hash=$1", [
    hash,
    userId,
  ]);
}
