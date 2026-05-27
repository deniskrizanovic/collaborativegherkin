import type { Metadata } from "next";
import Script from "next/script";
import { IBM_Plex_Mono } from "next/font/google";
import "@fontsource/public-sans";
import "nsw-design-system/dist/css/main.css";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Collaborative Gherkin",
  description: "Write Gherkin acceptance criteria together, in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={ibmPlexMono.variable}>
      <head />
      <body>
        {children}
        <Script id="nsw-init" strategy="afterInteractive">
          {`if (window.NSW) window.NSW.initSite();`}
        </Script>
      </body>
    </html>
  );
}
