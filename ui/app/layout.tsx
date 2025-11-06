import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navigation } from "./components/Navigation";
import { DebugProvider } from "./components/DebugProvider";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AIMED",
  description: "AIMED AI Monitoring & Execution Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Suppress Next.js [Fast Refresh] logs unless Workspace Info toggle is ON */}
        <Script id="suppress-hmr-logs" strategy="beforeInteractive">
          {`
            (function() {
              const isDebugEnabled = () => {
                return typeof window !== 'undefined' &&
                       window.localStorage?.getItem('conport_debug') === 'true';
              };
              
              // Intercept Next.js Fast Refresh logger (only if debug is OFF)
              if (typeof window !== 'undefined' && !isDebugEnabled()) {
                const originalLog = console.log;
                console.log = function(...args) {
                  // Filter out Fast Refresh logs
                  if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('[Fast Refresh]')) {
                    return; // Suppress
                  }
                  originalLog.apply(console, args);
                };
                
                // Update when debug toggle changes
                window.addEventListener('debugInfoToggle', function(event) {
                  if (event.detail === true) {
                    // Debug enabled - restore original console.log
                    console.log = originalLog;
                  } else {
                    // Debug disabled - re-apply filter
                    console.log = function(...args) {
                      if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('[Fast Refresh]')) {
                        return;
                      }
                      originalLog.apply(console, args);
                    };
                  }
                });
              }
            })();
          `}
        </Script>
        <Providers>
          <DebugProvider />
          <Navigation />
          <main>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
