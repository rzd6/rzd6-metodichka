/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    // Allow Supabase connections everywhere (needed for notifications/articles)
    let supabaseConnectSrc = "https://*.supabase.co wss://*.supabase.co"
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        supabaseConnectSrc = `https://${host} wss://${host}`
      }
    } catch {
      // keep wildcard fallback
    }

    return [
      {
        // Apply a relaxed but safe CSP to all routes
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://id.vk.com https://id.vk.ru https://vk.com`,
              "style-src 'self' 'unsafe-inline' https://id.vk.com https://id.vk.ru",
              "img-src 'self' data: blob: https: http:",
              `connect-src 'self' https://id.vk.com https://id.vk.ru https://api.vk.com https://api.vk.ru https://vk.com wss://id.vk.com wss://id.vk.ru ${supabaseConnectSrc}`,
              "frame-src https://id.vk.com https://id.vk.ru https://vk.com",
              "child-src https://id.vk.com https://id.vk.ru https://vk.com blob:",
              "worker-src blob: 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
