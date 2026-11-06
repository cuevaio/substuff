import { randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const privatePath = `${process.env.HOME}/.config/substuff`;
const owner = readFileSync(`${privatePath}/database-admin-url`, "utf8").trim();
const sql = neon(owner);
const roles =
  await sql`SELECT rolname FROM pg_roles WHERE rolname = 'substuff_app'`;
if (roles.length)
  throw new Error(
    "Application role exists; reuse its saved connection rather than rotate it.",
  );
const password = randomBytes(32).toString("hex");
await sql.query(`CREATE ROLE substuff_app LOGIN PASSWORD '${password}'`);
await sql`GRANT USAGE ON SCHEMA public TO substuff_app`;
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces, generation_limits TO substuff_app`;
const runtime = new URL(owner);
runtime.username = "substuff_app";
runtime.password = password;
writeFileSync(`${privatePath}/database-app-url`, runtime.toString(), {
  mode: 0o600,
});
const key = readFileSync(`${privatePath}/gateway-create.json`, "utf8").trim();
if (/\s/.test(key) || key.length < 20)
  throw new Error("Unexpected Gateway key format");
const env = readFileSync(".env.local", "utf8");
writeFileSync(
  ".env.local",
  `${env}\nDATABASE_URL=${runtime}\nAI_GATEWAY_API_KEY=${key}\nAI_MODEL=google/gemini-2.5-flash-lite\nRATE_LIMIT_SALT=${randomBytes(32).toString("hex")}\n`,
  { mode: 0o600 },
);
chmodSync(".env.local", 0o600);
const check = neon(runtime.toString());
const [permissions] =
  await check`SELECT has_table_privilege(current_user, 'workspaces', 'SELECT,INSERT,UPDATE,DELETE') AS workspace_access, has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create`;
if (!permissions.workspace_access || permissions.schema_create)
  throw new Error("Application privilege verification failed");
console.log(
  "Dedicated application role created and verified. Gateway and database credentials saved privately.",
);
