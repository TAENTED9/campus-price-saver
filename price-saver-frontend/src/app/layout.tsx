import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { SettingsSyncProvider } from "@/components/providers/SettingsSyncProvider";
import { NotificationProvider } from "@/context/NotificationContext";
import { SupportSection } from "@/components/support/SupportSection";

export const metadata: Metadata = {
  title: "Campify — Campus Marketplace",
  description: "Find the best prices across campus. Compare products, discover deals, and shop smart.",
};

// Block 2 — Theme bootstrap reads the `campify_theme` cookie (not
// localStorage). The cookie is written by settingsStore.applyTheme()
// whenever the user toggles theme. Falls back to "system" if absent.
const THEME_BOOTSTRAP = `(function(){try{var c=document.cookie.split('; ').find(function(r){return r.indexOf('campify_theme=')===0;});var t=c?decodeURIComponent(c.split('=')[1]):null;var isDark=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(isDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="font-outfit dark:bg-gray-900">
        <ThemeProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <SidebarProvider>
                <NotificationProvider>
                  <SettingsSyncProvider>
                    {children}
                    {/* Floating support button — visible on every page */}
                    <SupportSection variant="floating" />
                  </SettingsSyncProvider>
                </NotificationProvider>
              </SidebarProvider>
            </AdminAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
