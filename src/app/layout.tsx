import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { InstallPromptScript } from "@/components/shell/install-prompt-script";
import { OrientationLock } from "@/components/shell/orientation-lock";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import { ThemeScript } from "@/components/theme/theme-script";
import { QueryProvider } from "@/lib/query/provider";

// The UI font is SF Pro. It's Apple's system typeface (not on Google Fonts),
// so we use the native system-font stack — it resolves to SF Pro on Apple
// devices (this is an iOS-first PWA) and to the platform equivalent elsewhere.
// The stack itself lives in globals.css as `--font-sans`.

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Strong Journal",
  description:
    "Build calisthenics programs, design mesocycles, track workouts.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Strong Journal",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f29e23",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The theme script toggles the `dark` class before hydration.
      suppressHydrationWarning
      className={`${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
        <InstallPromptScript />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        <ServiceWorkerRegister />
        <OrientationLock />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
