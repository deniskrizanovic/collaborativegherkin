import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource/public-sans";
import "nsw-design-system/dist/css/main.css";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        {children}
        <Script id="nsw-init" strategy="afterInteractive">
          {`if (window.NSW) window.NSW.initSite();`}
        </Script>
      </body>
    </html>
  );
}
