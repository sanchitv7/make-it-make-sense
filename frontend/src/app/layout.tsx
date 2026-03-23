import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Make It Make Sense",
  description: "Real-time fact-checking for live audio",
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
  themeColor: "#0a0b0e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col grain">
        {children}
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
