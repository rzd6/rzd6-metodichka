import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const SQL_TO_RUN = `CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;`

export async function GET() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  // Try Supabase Management SQL API (requires service_role key)
  if (supabaseUrl && serviceRoleKey) {
    // Extract project ref from URL: https://<ref>.supabase.co
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
    const projectRef = match?.[1]

    if (projectRef) {
      try {
        const mgmtRes = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ query: SQL_TO_RUN }),
          },
        )

        if (mgmtRes.ok) {
          console.log("[v0] Migration 009: app_settings created via Management API")
          return NextResponse.json({ success: true, message: "Таблица app_settings создана." })
        }

        const mgmtErr = await mgmtRes.text()
        console.log("[v0] Management API attempt:", mgmtRes.status, mgmtErr)
      } catch (e) {
        console.log("[v0] Management API not available:", e)
      }
    }
  }

  // Check if table already exists
  try {
    const supabase = getSupabaseAdmin()
    const { error: checkError } = await supabase.from("app_settings").select("key").limit(1)

    if (!checkError) {
      return NextResponse.json({ success: true, message: "Таблица app_settings уже существует." })
    }

    console.log("[v0] app_settings missing:", checkError.code, checkError.message)
  } catch (e) {
    console.log("[v0] Table check error:", e)
  }

  return NextResponse.json({
    success: false,
    needsManualMigration: true,
    message: "Таблица app_settings не найдена. Выполните SQL ниже в Supabase Dashboard → SQL Editor.",
    sqlToRun: SQL_TO_RUN,
  })
}



