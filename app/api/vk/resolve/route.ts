import { type NextRequest, NextResponse } from "next/server"

// Resolves a VK short name / profile link to a numeric user ID.
// Strategy 1: utils.resolveScreenName — works without token for most cases.
// Strategy 2: Parse og:url from the public VK profile page (no token needed).
export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json()

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Не указан ввод" }, { status: 400 })
    }

    const raw = input.trim()

    // 1. Already a numeric ID
    if (/^\d+$/.test(raw)) {
      return NextResponse.json({ user_id: raw })
    }

    // 2. Extract screen_name from various forms:
    //    https://vk.com/durov  →  durov
    //    vk.com/durov          →  durov
    //    @durov                →  durov
    //    id123456              →  handled below
    let screenName = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^(?:m\.)?vk\.(?:com|ru)\//i, "")
      .replace(/^@/, "")
      .split(/[/?#]/)[0]
      .trim()

    // 3. id<number> pattern → return number directly
    const idMatch = screenName.match(/^id(\d+)$/i)
    if (idMatch) {
      return NextResponse.json({ user_id: idMatch[1] })
    }

    if (!screenName) {
      return NextResponse.json({ error: "Пустое имя пользователя" }, { status: 400 })
    }

    // 4. Strategy 1: utils.resolveScreenName — no token required
    try {
      const resolveUrl = new URL("https://api.vk.com/method/utils.resolveScreenName")
      resolveUrl.searchParams.set("screen_name", screenName)
      resolveUrl.searchParams.set("v", "5.199")

      const resolveRes = await fetch(resolveUrl.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RZD-App/1.0)" },
      })

      if (resolveRes.ok) {
        const resolveData = await resolveRes.json()
        console.log("[v0] resolveScreenName response:", JSON.stringify(resolveData))

        if (resolveData.response && resolveData.response.object_id) {
          return NextResponse.json({ user_id: String(resolveData.response.object_id) })
        }

        // Empty response means user not found (not an error)
        if (resolveData.response !== undefined && !resolveData.error) {
          return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
        }

        // If VK returned an error other than token-related, propagate it
        if (resolveData.error && resolveData.error.error_code !== 5 && resolveData.error.error_code !== 15) {
          return NextResponse.json({ error: resolveData.error.error_msg || "Ошибка VK API" }, { status: 400 })
        }
        // error_code 5 = token required, 15 = access denied → fall through to strategy 2
      }
    } catch (e) {
      console.log("[v0] resolveScreenName failed, trying HTML fallback:", e)
    }

    // 5. Strategy 2: fetch VK profile page and extract numeric ID from embedded JSON.
    //    VK embeds JSON data in the page HTML including "owner_id":<number> for the profile owner.
    const profileUrl = `https://vk.com/${encodeURIComponent(screenName)}`
    const htmlRes = await fetch(profileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    })

    if (!htmlRes.ok) {
      return NextResponse.json({ error: "Не удалось загрузить страницу VK" }, { status: 502 })
    }

    const html = await htmlRes.text()

    // Primary: "user_id":<number> — appears consistently as the page owner's ID
    const userIdMatch = html.match(/"user_id":([1-9]\d*)/)
    if (userIdMatch) {
      return NextResponse.json({ user_id: userIdMatch[1] })
    }

    // Fallback: "owner_id":<non-zero number>
    const ownerMatch = html.match(/"owner_id":([1-9]\d*)/)
    if (ownerMatch) {
      return NextResponse.json({ user_id: ownerMatch[1] })
    }

    // Fallback: og:url meta tag with /id<number>
    const ogMatch =
      html.match(/property=["']og:url["'][^>]*content=["'][^"']*\/id(\d+)["']/i) ||
      html.match(/content=["'][^"']*\/id(\d+)["'][^>]*property=["']og:url["']/i)
    if (ogMatch) {
      return NextResponse.json({ user_id: ogMatch[1] })
    }

    // Fallback: canonical link
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'][^"']*\/id(\d+)["']/i)
    if (canonicalMatch) {
      return NextResponse.json({ user_id: canonicalMatch[1] })
    }

    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
  } catch (err) {
    console.error("[v0] VK resolve error:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
