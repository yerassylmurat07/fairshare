CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 name text NOT NULL, initials text NOT NULL, color text NOT NULL,
 skills text[] NOT NULL DEFAULT '{}', learning_skills text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_skills text[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS teams (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (
 team_id uuid NOT NULL REFERENCES teams(id), user_id uuid NOT NULL REFERENCES users(id),
 role text NOT NULL CHECK(role IN ('leader','member')), PRIMARY KEY(team_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS team_one_leader ON memberships(team_id) WHERE role='leader';
CREATE TABLE IF NOT EXISTS availability (
 user_id uuid NOT NULL REFERENCES users(id), week_start date NOT NULL,
 hours numeric(5,2) NOT NULL CHECK(hours BETWEEN 0 AND 100), PRIMARY KEY(user_id,week_start)
);
CREATE TABLE IF NOT EXISTS projects (
 id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES teams(id), name text NOT NULL, course text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS project_team ON projects(team_id);
CREATE TABLE IF NOT EXISTS milestones (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id), title text NOT NULL,
 due_date date NOT NULL, week_start date NOT NULL, revision integer NOT NULL DEFAULT 1,
 UNIQUE(id,project_id)
);
CREATE TABLE IF NOT EXISTS tasks (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id), milestone_id uuid NOT NULL,
 title text NOT NULL, goal text NOT NULL, first_step text NOT NULL, deliverable text NOT NULL,
 estimate numeric(5,2) NOT NULL CHECK(estimate>0 AND estimate<=100), skill text NOT NULL,
 assignee_id uuid REFERENCES users(id), status text NOT NULL DEFAULT 'planned' CHECK(status IN('planned','in_progress','done')),
 help_reason text, evidence text NOT NULL DEFAULT '', dependency_id uuid,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 started_at timestamptz, first_evidence_at timestamptz, done_at timestamptz,
 UNIQUE(id,project_id), FOREIGN KEY(milestone_id,project_id) REFERENCES milestones(id,project_id),
 FOREIGN KEY(dependency_id,project_id) REFERENCES tasks(id,project_id), CHECK(dependency_id IS NULL OR dependency_id<>id)
);
CREATE INDEX IF NOT EXISTS task_milestone ON tasks(milestone_id,status);
CREATE INDEX IF NOT EXISTS task_assignee ON tasks(assignee_id) WHERE status<>'done';
CREATE TABLE IF NOT EXISTS allocations (
 id uuid PRIMARY KEY, milestone_id uuid NOT NULL REFERENCES milestones(id), created_by uuid NOT NULL REFERENCES users(id),
 snapshot jsonb NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved')),
 created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz
);
CREATE TABLE IF NOT EXISTS invitations (
 token_hash text PRIMARY KEY, team_id uuid NOT NULL REFERENCES teams(id), created_by uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, used_by uuid REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS events (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id), actor_id uuid NOT NULL REFERENCES users(id),
 kind text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_project ON events(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS comments (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES users(id), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comment_task ON comments(task_id,created_at);
CREATE TABLE IF NOT EXISTS checklist (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 title text NOT NULL, done boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS resources (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id), author_id uuid NOT NULL REFERENCES users(id),
 title text NOT NULL, url text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS decisions (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id), author_id uuid NOT NULL REFERENCES users(id),
 title text NOT NULL, context text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN('open','accepted','declined')),
 created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS votes (
 decision_id uuid NOT NULL REFERENCES decisions(id), user_id uuid NOT NULL REFERENCES users(id),
 choice text NOT NULL CHECK(choice IN('yes','no')), PRIMARY KEY(decision_id,user_id)
);
CREATE TABLE IF NOT EXISTS task_estimates (
 task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 hours numeric(5,2) NOT NULL CHECK(hours>0 AND hours<=100),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(task_id,user_id)
);
