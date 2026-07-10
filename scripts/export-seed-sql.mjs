// Generates supabase/seed.sql from the dev JSON database so production
// starts with the same admin-managed content (exercises, defaults,
// techniques). Usage: npm run export-seed
import { readFileSync } from "node:fs";
import path from "node:path";

const db = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8"),
);

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;

const lines = [
  "-- Generated from data/db.json by scripts/export-seed-sql.mjs",
  "-- Content seed: run after 0001_init.sql, then manage via the admin UI.",
  "",
];

lines.push("insert into public.exercises (id, title, category, attribute, measurement, rep_style, progressions) values");
lines.push(
  db.exercises
    .map(
      (e) =>
        `  (${q(e.id)}, ${q(e.title)}, ${q(e.category)}, ${q(e.attribute)}, ${q(e.measurement ?? "reps")}, ${q(e.repStyle ?? "standard")}, ${j(e.progressions)})`,
    )
    .join(",\n") + "\non conflict (id) do nothing;\n",
);

lines.push("insert into public.techniques (id, name, description) values");
lines.push(
  db.techniques
    .map((t) => `  (${q(t.id)}, ${q(t.name)}, ${q(t.description)})`)
    .join(",\n") + "\non conflict (id) do nothing;\n",
);

lines.push(
  `insert into public.default_template (id, entries) values ('default', ${j(db.defaultTemplate.entries)})`,
);
lines.push("on conflict (id) do update set entries = excluded.entries;");

console.log(lines.join("\n"));
