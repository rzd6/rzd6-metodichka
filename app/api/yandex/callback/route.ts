import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/?yandex_auth=error&reason=${encodeURIComponent(error)}`, request.url),
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?yandex_auth=error&reason=no_code", request.url),
    )
  }

  const clientId = process.env.YANDEX_CLIENT_ID
  const clientSecret = process.env.YANDEX_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/?yandex_auth=error&reason=missing_credentials", request.url),
    )
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error("[v0] Yandex token exchange failed:", errorData)
      return NextResponse.redirect(
        new URL(`/?yandex_auth=error&reason=token_exchange_failed`, request.url),
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    if (!access_token) {
      return NextResponse.redirect(
        new URL("/?yandex_auth=error&reason=no_access_token", request.url),
      )
    }

    const expiresAt = Date.now() + expires_in * 1000

    // Save tokens to Supabase app_settings table
    const supabase = getSupabaseAdmin()

    const upserts = [
      { key: "yandex_access_token", value: access_token, updated_at: new Date().toISOString() },
      { key: "yandex_token_expires_at", value: String(expiresAt), updated_at: new Date().toISOString() },
    ]

    if (refresh_token) {
      upserts.push({ key: "yandex_refresh_token", value: refresh_token, updated_at: new Date().toISOString() })
    }

    const { error: dbError } = await supabase
      .from("app_settings")
      .upsert(upserts, { onConflict: "key" })

    if (dbError) {
      console.error("[v0] Failed to save Yandex token to Supabase:", dbError)
      return NextResponse.redirect(
        new URL("/?yandex_auth=error&reason=db_save_failed", request.url),
      )
    }

    console.log("[v0] Yandex OAuth token saved successfully, expires in:", expires_in, "seconds")

    return NextResponse.redirect(new URL("/?yandex_auth=success", request.url))
  } catch (err) {
    console.error("[v0] Yandex OAuth callback error:", err)
    return NextResponse.redirect(
      new URL("/?yandex_auth=error&reason=unexpected_error", request.url),
    )
  }
}
