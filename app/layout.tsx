import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Roboto, Montserrat, Nunito, Oswald, Merriweather, Playfair_Display } from "next/font/google"
import { Suspense } from "react"
import { ThemeProvider } from "@/contexts/theme-context"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  display: "swap",
})

const roboto = Roboto({
  subsets: ["latin", "cyrillic"],
  variable: "--font-roboto",
  display: "swap",
  weight: ["400", "500", "700"],
})

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
  display: "swap",
})

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nunito",
  display: "swap",
})

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-oswald",
  display: "swap",
})

const merriweather = Merriweather({
  subsets: ["latin", "cyrillic"],
  variable: "--font-merriweather",
  display: "swap",
  weight: ["400", "700"],
})

const playfairDisplay = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-playfair",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Методичка РЖД",
  description: "Система управления персоналом и документацией РЖД",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" style={{ backgroundColor: "#0a0a0a" }}>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${roboto.variable} ${montserrat.variable} ${nunito.variable} ${oswald.variable} ${merriweather.variable} ${playfairDisplay.variable} antialiased`}>
        <ThemeProvider>
          <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}
