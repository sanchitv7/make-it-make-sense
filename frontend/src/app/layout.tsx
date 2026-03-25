import type { Metadata, Viewport } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Make It Make Sense",
  description: "Live AI fact-checking as you listen",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MIMS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F0E8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${jetBrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col grain antialiased">
        {children}
        <ThemeToggle />
        <Script id="sw-register" strategy="afterInteractive" src="/register-sw.js" />
        <Script id="react-grab" strategy="afterInteractive">{`
          if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            var s = document.createElement("script");
            s.src = "/react-grab.js";
            document.body.appendChild(s);
          }
        `}</Script>
      </body>
    </html>
  );
}
