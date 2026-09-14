"use client";

import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileBarChart,
  FileSignature,
  GraduationCap,
  HelpCircle,
  Image as ImageIcon,
  LifeBuoy,
  Megaphone,
  Puzzle,
  Rocket,
  Settings,
  UserPlus,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NotificationIconName } from "@/lib/notifications/events";

// Olay kataloğundaki ikon ADI → gerçek lucide bileşeni.
// Katalog (lib/notifications/events.ts) saf veri kalsın diye ayrı dosyada:
// o dosyayı sunucu tarafı da import ediyor, lucide'ı oraya sokmak
// sunucu paketine gereksiz bir istemci bağımlılığı taşırdı.
const ICONS: Record<NotificationIconName, LucideIcon> = {
  "clipboard-check": ClipboardCheck,
  "book-open": BookOpen,
  "file-bar-chart": FileBarChart,
  wallet: Wallet,
  "user-plus": UserPlus,
  "calendar-clock": CalendarClock,
  "life-buoy": LifeBuoy,
  image: ImageIcon,
  megaphone: Megaphone,
  settings: Settings,
  "alert-triangle": AlertTriangle,
  "check-circle": CheckCircle2,
  "help-circle": HelpCircle,
  video: Video,
  "graduation-cap": GraduationCap,
  "clock-alert": Clock,
  "file-signature": FileSignature,
  puzzle: Puzzle,
  rocket: Rocket,
};

export function NotificationIcon({ name, className }: { name: NotificationIconName; className?: string }) {
  const Icon = ICONS[name] ?? Settings;
  return <Icon className={className} />;
}
