import type { Metadata, Viewport } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import { ThemeScript } from "@/components/theme/theme-script";

const sans = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cali Pro",
  description: "Build calisthenics programs, design mesocycles, track workouts.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cali Pro",
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
      className={`${sans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
