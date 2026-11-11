import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Marcellus } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });
const marcellus = Marcellus({ variable: "--font-marcellus", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "Vo Creative Co. Studio", template: "%s · Vo Creative Co." },
  description: "Done-with-you content: scripts, shooting briefs, footage and finished videos.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${marcellus.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
