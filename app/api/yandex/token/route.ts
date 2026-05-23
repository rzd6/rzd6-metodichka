import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["yandex_access_token", "yandex_token_expires_at"])

    if (error) {
      console.error("[v0] Failed to fetch Yandex token from Supabase:", error)
      return NextResponse.json({ connected: false, error: "db_error" })
    }

    const settings = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    const token = settings["yandex_access_token"]
    const expiresAt = settings["yandex_token_expires_at"]

    if (!token) {
      return NextResponse.json({ connected: false })
    }

    const isExpired = expiresAt ? Date.now() > Number(expiresAt) : false
    const expiresAtDate = expiresAt ? new Date(Number(expiresAt)).toISOString() : null

    return NextResponse.json({
      connected: true,
      isExpired,
      expiresAt: expiresAtDate,
    })
  } catch (err) {
    console.error("[v0] Yandex token status check error:", err)
    return NextResponse.json({ connected: false, error: "unexpected_error" })
  }
}

// DELETE — revoke and remove the stored token
export async function DELETE() {
  try {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from("app_settings")
      .delete()
      .in("key", ["yandex_access_token", "yandex_refresh_token", "yandex_token_expires_at"])

    if (error) {
      console.error("[v0] Failed to delete Yandex token:", error)
      return NextResponse.json({ success: false, error: "db_error" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Yandex token revoke error:", err)
    return NextResponse.json({ success: false, error: "unexpected_error" }, { status: 500 })
  }
}
