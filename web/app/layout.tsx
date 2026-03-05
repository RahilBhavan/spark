import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ScrollProvider } from "./components/scroll-provider";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SPARK BTC — Channel Liquidity & Intelligence",
  description:
    "Lightning liquidity ops for Bitcoin. Score channels, rebalance automatically, and keep your node healthy. SPARK BTC: operational intelligence for every channel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${jetbrainsMono.variable} ${spaceGrotesk.variable} font-mono antialiased`}
      >
        <NuqsAdapter>
          <ScrollProvider>{children}</ScrollProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
