"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "ภาพรวมตลาด", icon: "home" },
  { href: "/results", label: "ผลค้นหาสินค้า", icon: "search" },
  { href: "/wanted", label: "สินค้าที่ต้องการ", icon: "tag" },
  { href: "/groups", label: "กลุ่ม Facebook", icon: "users" },
  { href: "/market", label: "รายการติดตาม", icon: "chart" },
  { href: "/settings", label: "ตั้งค่า", icon: "gear" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm md:gap-3 " +
              (active ? "bg-primary font-semibold text-white" : "text-soft hover:bg-elevated")
            }
          >
            <Icon name={l.icon} size={18} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
