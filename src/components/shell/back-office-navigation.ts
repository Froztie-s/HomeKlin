import {
  BookOpen,
  Building2,
  CalendarDays,
  ChartColumn,
  CirclePlay,
  ClipboardList,
  LayoutDashboard,
  MessagesSquare,
  MonitorPlay,
  ShieldCheck,
  Tags,
  UsersRound,
} from "lucide-react";
import type { BackOfficeNavKey, MessageKeyIn, Navigation } from "./navigation";

// Agency, admin and owner menus. Partner agencies run cleaners, availability and assignment;
// HomeKlin admin owns the services and the one price list; the owner sees the business numbers and
// decides which partner agencies and admins HomeKlin has.
// Labels: the BackOfficeNavigation namespace of src/messages/*.json, sent to the browser by the
// back-office shell only.
export const backOfficeNavigation = {
  agency: {
    labelKey: "agency.label",
    items: [
      { href: "/agency", exact: true, labelKey: "agency.dashboard", icon: LayoutDashboard },
      { href: "/agency/schedule", labelKey: "agency.schedule", icon: CalendarDays },
      { href: "/agency/cleaners", labelKey: "agency.cleaners", icon: UsersRound },
      { href: "/agency/orders", labelKey: "agency.orders", icon: ClipboardList },
      { href: "/agency/recordings", labelKey: "agency.recordings", icon: CirclePlay },
    ],
  },
  admin: {
    labelKey: "admin.label",
    items: [
      { href: "/admin", exact: true, labelKey: "admin.dashboard", icon: LayoutDashboard },
      { href: "/admin/monitor", labelKey: "admin.monitor", icon: MonitorPlay },
      { href: "/admin/tickets", labelKey: "admin.tickets", icon: MessagesSquare },
      { href: "/admin/recordings", labelKey: "admin.recordings", icon: CirclePlay },
      { href: "/admin/services", labelKey: "admin.services", icon: Tags },
      { href: "/admin/faq", labelKey: "admin.faq", icon: BookOpen },
    ],
  },
  owner: {
    labelKey: "owner.label",
    items: [
      { href: "/owner", exact: true, labelKey: "owner.numbers", icon: ChartColumn },
      { href: "/owner/agencies", labelKey: "owner.agencies", icon: Building2 },
      { href: "/owner/admins", labelKey: "owner.admins", icon: ShieldCheck },
    ],
  },
} satisfies Record<BackOfficeNavKey, Navigation<MessageKeyIn<"BackOfficeNavigation">>>;
