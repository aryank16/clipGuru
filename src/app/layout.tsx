import type { Metadata } from "next";
import { Anybody, JetBrains_Mono, Public_Sans } from "next/font/google";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const anybody = Anybody({
  variable: "--font-anybody",
  subsets: ["latin"],
  weight: ["800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ClipGuru", template: "%s · ClipGuru" },
  description: "Explain anything in 90 seconds. Idea to AI explainer video to Instagram.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${anybody.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // The boot script sets data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
