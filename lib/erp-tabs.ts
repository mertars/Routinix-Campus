import {
  LayoutDashboard,
  GraduationCap,
  ScanLine,
  Megaphone,
  Radar,
  Settings2,
  UserCog,
  CalendarDays,
  Radio,
  NotebookPen,
  ClipboardCheck,
  Shuffle,
  Table2,
  Wand2,
  Trophy,
  Scan,
  CalendarCheck,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";

// ERP SEKME KAYDI — ad, ikon ve hangi adada durduğu.
//
// Bu liste eskiden app/principal/page.tsx'in içindeydi ve bileşen
// referanslarıyla iç içeydi; dışarıdan okunamıyordu. Komut paleti
// (⌘K) sekmeleri de aratabilsin diye ayrıldı: paletin ERP sayfasını
// import etmesi gerekmiyor, sayfa da kendi bileşen eşlemesini kendi
// tutuyor.

export type ErpTabId =
  | "overview"
  | "students"
  | "academic-xray"
  | "upload"
  | "exam-seating"
  | "live-tutoring"
  | "guidance-program"
  | "attendance"
  | "teachers"
  | "preference-robot"
  | "schedule-matrix"
  | "etut-management"
  | "campus"
  | "bulk-sms"
  | "alumni"
  | "risk"
  | "calendar"
  | "settings";

export type ErpTab = {
  id: ErpTabId;
  label: string;
  icon: LucideIcon;
  /** Sol ada: akademik & akış · Sağ ada: idari & yönetim. */
  side: "left" | "right";
  /**
   * Aramada eşleşmeyi artıran ek sözcükler.
   *
   * Etiketler resmi adlar; müdür "devamsızlık" yazıp "Yoklama Takibi"ni
   * bulamazsa arama işe yaramaz. Yalnızca etikette GEÇMEYEN sözcükler
   * yazılır.
   */
  keywords?: string[];
};

export const ERP_TABS: ErpTab[] = [
  { id: "overview", label: "Genel Bakış", icon: LayoutDashboard, side: "left", keywords: ["gündem", "özet", "ana sayfa"] },
  { id: "students", label: "Kullanıcı Yönetimi & Performans", icon: GraduationCap, side: "left", keywords: ["öğrenci", "öğretmen", "kadro", "şube", "ekle", "kayıt", "veli"] },
  { id: "academic-xray", label: "Akademik Röntgen Karnesi", icon: Scan, side: "left", keywords: ["kazanım", "konu analizi"] },
  { id: "upload", label: "Sınav & Optik Yükleme", icon: ScanLine, side: "left", keywords: ["deneme", "sonuç", "net", "form"] },
  { id: "exam-seating", label: "Kelebek Sınav Oturma Planı", icon: Shuffle, side: "left", keywords: ["salon", "sıra", "masa", "yerleşim"] },
  { id: "live-tutoring", label: "Canlı Birebir Etüt & Randevu", icon: Radio, side: "left", keywords: ["görüşme", "talep"] },
  { id: "guidance-program", label: "Rehberlik & A4 Program Yapıcı", icon: NotebookPen, side: "left", keywords: ["psikolojik", "danışman", "çalışma programı"] },
  { id: "attendance", label: "Yoklama Takibi & Devamsızlık", icon: ClipboardCheck, side: "left", keywords: ["gelmedi", "yok", "geç kaldı", "izinli"] },
  { id: "teachers", label: "Öğretmen Performansı", icon: UserCog, side: "left", keywords: ["kadro", "ders yükü", "soru"] },
  { id: "preference-robot", label: "YKS / LGS Tercih Robotu", icon: Wand2, side: "right", keywords: ["üniversite", "bölüm", "puan", "sıralama"] },
  { id: "schedule-matrix", label: "Çakışmasız Ders Programı", icon: Table2, side: "right", keywords: ["ders saati", "haftalık", "çizelge"] },
  { id: "etut-management", label: "Etüt Yönetimi Merkezi", icon: CalendarCheck, side: "right", keywords: ["randevu", "onay", "talep"] },
  { id: "campus", label: "Kampüs Pano & Toplu Duyuru", icon: Megaphone, side: "right", keywords: ["ilan", "haber", "bildirim"] },
  { id: "bulk-sms", label: "Toplu SMS", icon: MessageSquareText, side: "right", keywords: ["mesaj", "izin", "veli bilgilendirme"] },
  { id: "alumni", label: "Mezun Takip (Alumnus)", icon: Trophy, side: "right", keywords: ["mezun", "mentor", "eski öğrenci"] },
  { id: "risk", label: "Risk Radarı", icon: Radar, side: "right", keywords: ["riskli", "düşen", "uyarı"] },
  { id: "calendar", label: "Etkinlik Takvimi", icon: CalendarDays, side: "right", keywords: ["etkinlik", "tarih", "ajanda"] },
  { id: "settings", label: "Nudge & Sistem Ayarları", icon: Settings2, side: "right", keywords: ["ayar", "yapılandırma", "tercih"] },
];

export const ERP_LEFT_TABS = ERP_TABS.filter((tab) => tab.side === "left");
export const ERP_RIGHT_TABS = ERP_TABS.filter((tab) => tab.side === "right");
