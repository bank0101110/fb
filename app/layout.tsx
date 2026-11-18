import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { logout } from "./login/actions";

export const metadata: Metadata = {
  title: "IDScout — ตลาดไอดีเกม",
  description: "หาสินค้าและติดตามความนิยมจากกลุ่มซื้อขายบน Facebook",
  appleWebApp: { capable: true, title: "IDScout", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b1120", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col items-stretch gap-3 p-3 md:flex-row md:items-start md:gap-4 md:p-4">
          <aside className="card flex w-full flex-col gap-3 px-3 py-3 md:sticky md:top-4 md:w-64 md:shrink-0 md:gap-6 md:px-3.5 md:py-5">
            <div className="flex items-center gap-2.5 px-1 md:px-2">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-[10px] bg-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="6" />
                  <path d="M20 20l-4.2-4.2" />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight">IDScout</span>
                <span className="text-[11px] text-muted">ตลาดไอดีเกม</span>
              </div>
              <form action={logout} className="ml-auto">
                <button type="submit" className="min-h-10 rounded-lg px-2 text-xs text-muted hover:bg-elevated hover:text-soft">ออกจากระบบ</button>
              </form>
            </div>
            <Nav />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col gap-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
