import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// SQL to add missing columns to articles table
const SQL_010 = `
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT '';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id TEXT DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE articles ADD COLUMN image_url TEXT[] DEFAULT ARRAY[]::TEXT[];
  ELSIF (
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'image_url'
  ) <> 'ARRAY' THEN
    ALTER TABLE articles ALTER COLUMN image_url TYPE TEXT[] USING ARRAY[image_url]::TEXT[];
  END IF;
END;
$$;
`.trim()

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && serviceRoleKey) {
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
    const projectRef = match?.[1]

    if (projectRef) {
      try {
        const res = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ query: SQL_010 }),
          },
        )

        if (res.ok) {
          return NextResponse.json({
            success: true,
            message: "Колонки author_name, author_id, image_url добавлены в таблицу articles.",
          })
        }

        const errText = await res.text()
        console.log("[v0] Migration 010 Supabase API error:", res.status, errText)
      } catch (e) {
        console.log("[v0] Migration 010 error:", e)
      }
    }
  }

  // Fallback: return SQL for manual execution
  return NextResponse.json({
    success: false,
    needsManualMigration: true,
    message:
      "Не удалось выполнить автоматически. Выполните SQL ниже в Supabase Dashboard → SQL Editor.",
    sqlToRun: SQL_010,
  })
}
