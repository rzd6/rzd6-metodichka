import { type NextRequest, NextResponse } from "next/server"

// This route handles the VK OAuth redirect from the popup window.
// It sends the authorization code back to the opener via postMessage and closes itself.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code") ?? ""
  const state = searchParams.get("state") ?? ""
  const device_id = searchParams.get("device_id") ?? ""
  const error = searchParams.get("error") ?? ""

  const html = `<!DOCTYPE html>
<html>
<head><title>VK Auth</title></head>
<body>
<script>
  try {
    window.opener.postMessage({
      type: 'vk_auth_callback',
      code: ${JSON.stringify(code)},
      state: ${JSON.stringify(state)},
      device_id: ${JSON.stringify(device_id)},
      error: ${JSON.stringify(error || null)},
    }, window.location.origin);
  } catch(e) {}
  window.close();
</script>
<p>Авторизация завершена. Это окно закроется автоматически.</p>
</body>
</html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
