import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const sql = readFileSync(join(__dirname, "009_create_app_settings_table.sql"), "utf8")

console.log("Running migration 009...")
console.log("SQL:", sql)

// Use Supabase REST to execute raw SQL via the Postgres REST API
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_SERVICE_ROLE_KEY,
  },
  body: JSON.stringify({ query: sql }),
})

if (!res.ok) {
  const txt = await res.text()
  console.error("exec_sql RPC not available (expected). Trying pg direct...", txt)
}

// Fallback: use pg driver with POSTGRES_URL
const POSTGRES_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!POSTGRES_URL) {
  console.error("No POSTGRES_URL available for direct connection")
  process.exit(1)
}

const { default: pg } = await import("pg")
const client = new pg.Client({ connectionString: POSTGRES_URL, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  console.log("Connected to Postgres directly")
  await client.query(sql)
  console.log("Migration 009 completed successfully!")
} catch (err) {
  console.error("Migration failed:", err.message)
  process.exit(1)
} finally {
  await client.end()
}
