import {
  CirclePlay,
  CircleQuestionMark,
  ClipboardCheck,
  ClipboardList,
  BookOpen,
  CalendarDays,
  House,
  LayoutDashboard,
  MessagesSquare,
  MonitorPlay,
  Store,
  Tags,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { NavMatch } from "./is-active-path";

export type NavItem = NavMatch & { label: string; icon: LucideIcon };
export type Navigation = { label: string; items: readonly NavItem[] };
export type NavKey = "customer" | "cleaner" | "agency" | "admin";

// Every shell's navigation in one place. The labels move to next-intl messages in T4.
export const navigation: Record<NavKey, Navigation> = {
  customer: {
    label: "Navigasi utama",
    items: [
      { href: "/", exact: true, label: "Beranda", icon: House },
      { href: "/agencies", label: "Agensi", icon: Store },
      { href: "/orders", label: "Pesanan", icon: ClipboardList },
      { href: "/support", label: "Bantuan", icon: CircleQuestionMark },
      { href: "/account", label: "Akun", icon: UserRound },
    ],
  },
  cleaner: {
    label: "Navigasi petugas",
    items: [
      { href: "/cleaner", exact: true, label: "Pekerjaan", icon: ClipboardCheck },
      { href: "/cleaner/account", label: "Akun", icon: UserRound },
    ],
  },
  agency: {
    label: "Navigasi agensi",
    items: [
      { href: "/agency", exact: true, label: "Dasbor", icon: LayoutDashboard },
      { href: "/agency/services", label: "Layanan", icon: Tags },
      { href: "/agency/schedule", label: "Jadwal", icon: CalendarDays },
      { href: "/agency/cleaners", label: "Petugas", icon: UsersRound },
      { href: "/agency/orders", label: "Pesanan", icon: ClipboardList },
      { href: "/agency/recordings", label: "Rekaman", icon: CirclePlay },
    ],
  },
  admin: {
    label: "Navigasi admin",
    items: [
      { href: "/admin", exact: true, label: "Dasbor", icon: LayoutDashboard },
      { href: "/admin/monitor", label: "Monitor Langsung", icon: MonitorPlay },
      { href: "/admin/tickets", label: "Tiket", icon: MessagesSquare },
      { href: "/admin/recordings", label: "Rekaman", icon: CirclePlay },
      { href: "/admin/faq", label: "FAQ", icon: BookOpen },
    ],
  },
};
