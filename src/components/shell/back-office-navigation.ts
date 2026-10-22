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
import type { BackOfficeNavKey, MessageKeyIn, Navigation } from "./navigation";

// Agency and admin menus. Partner agencies run cleaners, availability and assignment;
// HomeKlin admin owns the services and the one price list.
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
} satisfies Record<BackOfficeNavKey, Navigation<MessageKeyIn<"BackOfficeNavigation">>>;
