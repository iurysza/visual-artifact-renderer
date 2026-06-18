import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Visualizer",
    template: "%s | Visualizer",
  },
  description: "Data-driven visual artifacts",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="visualizer-theme"
          enableColorScheme
        >
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
