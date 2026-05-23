import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { code, device_id, state, code_verifier } = await request.json()

    if (!code || !device_id) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 })
    }

    const clientId = process.env.VK_APP_ID || "54572284"
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/login`

    const params: Record<string, string> = {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      device_id,
      redirect_uri: redirectUri,
    }

    if (state) params.state = state
    if (code_verifier) params.code_verifier = code_verifier

    const tokenRes = await fetch("https://id.vk.com/oauth2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error) {
      console.error("[v0] VK token exchange error:", tokenData)
      return NextResponse.json(
        { error: tokenData.error || "exchange_failed", description: tokenData.error_description },
        { status: 400 },
      )
    }

    // tokenData.user_id contains the VK user id
    return NextResponse.json(tokenData)
  } catch (err) {
    console.error("[v0] VK exchange route error:", err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
