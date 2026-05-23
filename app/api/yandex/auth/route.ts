import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const clientId = process.env.YANDEX_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({ error: "YANDEX_CLIENT_ID не задан" }, { status: 500 })
  }

  // Build absolute redirect_uri using the request origin so it works on any host
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const redirectUri = `${origin}/api/yandex/callback`

  // Build the Yandex OAuth 2.0 authorization URL
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    force_confirm: "yes",
  })

  const authUrl = `https://oauth.yandex.ru/authorize?${params.toString()}`

  return NextResponse.json({ url: authUrl })
}
