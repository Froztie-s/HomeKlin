import {
  BookOpen,
  CalendarDays,
  CirclePlay,
  ClipboardList,
  LayoutDashboard,
  MessagesSquare,
  MonitorPlay,
  Tags,
  UsersRound,
} from "lucide-react";
import type { BackOfficeNavKey, Navigation } from "./navigation";

// Agency and admin menus. Partner agencies run cleaners, availability and assignment;
// HomeKlin admin owns the services and the one price list.
export const backOfficeNavigation: Record<BackOfficeNavKey, Navigation> = {
  agency: {
    label: "Navigasi agensi",
    items: [
      { href: "/agency", exact: true, label: "Dasbor", icon: LayoutDashboard },
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
      { href: "/admin/services", label: "Layanan & Harga", icon: Tags },
      { href: "/admin/faq", label: "FAQ", icon: BookOpen },
    ],
  },
};
