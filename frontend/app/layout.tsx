import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const khInterference = localFont({
  variable: "--font-kh-interference",
  src: [
    { path: "./fonts/KHInterferenceTRIAL-Light.otf", weight: "300", style: "normal" },
    { path: "./fonts/KHInterferenceTRIAL-Regular.otf", weight: "500", style: "normal" },
    { path: "./fonts/KHInterferenceTRIAL-Bold.otf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "IETE SF DigiHunt // The Missing Code",
  description: "IETE Students' Forum presents DigiHunt, a story-driven technical challenge where teams decode, investigate, and build.",
  icons: {
    icon: "/ietelogo.png",
    shortcut: "/ietelogo.png",
    apple: "/ietelogo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${khInterference.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
