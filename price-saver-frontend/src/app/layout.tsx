import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { SidebarProvider } from "@/context/SidebarContext";

export const metadata: Metadata = {
  title: "Campify — Campus Marketplace",
  description: "Find the best prices across campus. Compare products, discover deals, and shop smart.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-outfit dark:bg-gray-900">
        <ThemeProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <SidebarProvider>
                {children}
              </SidebarProvider>
            </AdminAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
