import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { SettingsSyncProvider } from "@/components/providers/SettingsSyncProvider";
import { NotificationProvider } from "@/context/NotificationContext";

export const metadata: Metadata = {
  title: "Campify — Campus Marketplace",
  description: "Find the best prices across campus. Compare products, discover deals, and shop smart.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Block 6C — apply theme BEFORE first paint to prevent light→dark flicker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('campify_settings');if(s){var t=JSON.parse(s)?.state?.settings?.theme;var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-outfit dark:bg-gray-900">
        <ThemeProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <SidebarProvider>
                <NotificationProvider>
                  <SettingsSyncProvider>
                    {children}
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
