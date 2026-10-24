import { randomUUID } from "node:crypto";
import type { Database } from "./db.js";
import { currentWeek, weekEnd, passwordHash, initials } from "./security.js";
export const DEMO_EMAIL = "yerassyl@fairshare.demo";
export async function seed(db: Database) {
  const password = await passwordHash("FairShare-demo-2026!");
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(4133002)");
    const existing = await tx.query("SELECT id FROM users WHERE email=$1", [
      DEMO_EMAIL,
    ]);
    if (existing.rows.length) return;
    const team = randomUUID(),
      project = randomUUID(),
      milestone = randomUUID(),
      second = randomUUID();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const profiles = [
      [
        "Yerassyl Murat",
        DEMO_EMAIL,
        "#7056e8",
        ["Architecture", "Backend"],
        ["Testing"],
        12,
      ],
      [
        "Suusar Tursunbekova",
        "suusar@fairshare.demo",
        "#7f71d6",
        ["Frontend", "Testing"],
        ["Backend"],
        8,
      ],
      [
        "Sezim Kamchieva",
        "sezim@fairshare.demo",
        "#afa0df",
        ["Documentation", "Databases"],
        ["Frontend"],
        6,
      ],
    ] as const;
    await tx.query("INSERT INTO teams(id,name) VALUES($1,$2)", [
      team,
      "Team FairShare",
    ]);
    for (let i = 0; i < profiles.length; i++) {
      const [name, email, color, skills, learningSkills, hours] = profiles[i];
      await tx.query(
        "INSERT INTO users(id,name,email,password_hash,initials,color,skills,learning_skills) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          ids[i],
          name,
          email,
          password,
          initials(name),
          color,
          [...skills],
          [...learningSkills],
        ],
      );
      await tx.query(
        "INSERT INTO memberships(team_id,user_id,role) VALUES($1,$2,$3)",
        [team, ids[i], i === 0 ? "leader" : "member"],
      );
      await tx.query(
        "INSERT INTO availability(user_id,week_start,hours) VALUES($1,$2,$3)",
        [ids[i], currentWeek(), hours],
      );
    }
    await tx.query(
      "INSERT INTO projects(id,team_id,name,course) VALUES($1,$2,$3,$4)",
      [project, team, "Software Engineering", "ISE4133"],
    );
    await tx.query(
      "INSERT INTO milestones(id,project_id,title,due_date,week_start) VALUES($1,$2,$3,$4,$5)",
      [
        milestone,
        project,
        "First working prototype",
        weekEnd(currentWeek()),
        currentWeek(),
      ],
    );
    await tx.query(
      "INSERT INTO projects(id,team_id,name,course) VALUES($1,$2,$3,$4)",
      [second, team, "Databases", "CS Database"],
    );
    await tx.query(
      "INSERT INTO milestones(id,project_id,title,due_date,week_start) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        second,
        "Course project schema",
        weekEnd(currentWeek()),
        currentWeek(),
      ],
    );
    const tasks = [
      [
        "Plan the architecture",
        "Modules, links and system boundaries",
        "Open the project README and sketch the three main modules.",
        "Architecture diagram with the reasons for each decision.",
        4,
        "Architecture",
        0,
        "planned",
        null,
      ],
      [
        "Implement the API",
        "Routes for projects and tasks",
        "Create GET /projects and check the response in the browser.",
        "Working routes and sample requests.",
        6,
        "Backend",
        0,
        "planned",
        null,
      ],
      [
        "Write tests",
        "Cover the main flow",
        "Write the scenario: create a task → allocate → complete.",
        "Tests for the main flow and errors.",
        3,
        "Testing",
        1,
        "planned",
        null,
      ],
      [
        "Build the interface",
        "Task board and workload screen",
        "Create the TaskCard component and connect it to the API.",
        "A working board with three statuses.",
        5,
        "Frontend",
        1,
        "in_progress",
        null,
      ],
      [
        "Prepare the presentation",
        "Show the team scenario",
        "Make the first slide: user, problem, solution.",
        "A presentation with a product demo.",
        2,
        "Documentation",
        2,
        "in_progress",
        "I need an example of the presentation structure.",
      ],
      [
        "Design the database",
        "Entities and data constraints",
        "List the User, Team, Project and Task entities.",
        "ER diagram and SQL schema.",
        2,
        "Databases",
        2,
        "done",
        null,
      ],
    ];
    for (const t of tasks)
      await tx.query(
        "INSERT INTO tasks(id,project_id,milestone_id,title,goal,first_step,deliverable,estimate,skill,assignee_id,status,help_reason,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [
          randomUUID(),
          project,
          milestone,
          t[0],
          t[1],
          t[2],
          t[3],
          t[4],
          t[5],
          ids[Number(t[6])],
          t[7],
          t[8],
          t[7] === "done"
            ? "Sample result: the ER diagram and data schema are ready."
            : "",
        ],
      );
  });
}
