import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDScout — ตลาดไอดีเกม",
  description: "หาสินค้าและติดตามความนิยมจากกลุ่มซื้อขายบน Facebook",
};

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
        <div className="flex min-h-screen flex-wrap items-start gap-4 p-4">
          <aside className="card flex w-full flex-col gap-6 px-3.5 py-5 md:sticky md:top-4 md:w-64">
            <div className="flex items-center gap-2.5 px-2">
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
            </div>
            <Nav />
          </aside>
          <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
