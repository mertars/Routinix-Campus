import { Building2, Scan, FileBarChart, Clapperboard, Wallet, type LucideIcon } from "lucide-react";

// MODÜL KAYDI — beş panelin TEK tanımı.
//
// Daha önce bu bilgi beş yerde ayrı ayrı duruyordu: hub kartlarında, ve
// her modülün kendi üst çubuğunda (adres, ikon, renk, etiket). Sonuç:
// Ölçme ile Ödeme aynı yeşili kullanıyordu ve kimse fark etmemişti.
//
// ⚠️ Kurulan kurgu bilerek değişti. Eski yorumlar "hub'ın '3 ayrı modül'
// kurgusuna sadık kalmak için bu modül KENDİ görsel kimliğine sahip"
// diyordu; yani ayrılık kasıtlıydı. Artık istenen bunun tersi: kullanıcı
// modül değiştirdiğinde BAŞKA bir sisteme geçtiğini değil, aynı sistemin
// başka bir odasına geçtiğini hissetmeli. Renk artık kimlik değil, sadece
// ayırt edici bir vurgu; kimliği ikon ve ad taşıyor.

export type ModuleId = "erp" | "xray" | "olcme" | "video" | "payments";

export type ModuleDef = {
  id: ModuleId;
  /** Tam ad — hub kartında ve modül değiştiricide. */
  label: string;
  /** Dar yerlerde (üst çubuk rozeti). */
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind sınıf parçası. ERP marka rengini kullanır (kullanıcı seçebiliyor). */
  accent: { text: string; bg: string; border: string; dot: string };
  principalHref: string;
  /** null = bu modülün öğretmen görünümü yok. */
  teacherHref: string | null;
};

export const MODULES: ModuleDef[] = [
  {
    id: "erp",
    label: "Kampüs ERP & Finans",
    shortLabel: "Kampüs ERP",
    description: "Kadro, şube, yoklama, ödev ve tüm mevcut yönetim araçları.",
    icon: Building2,
    accent: {
      text: "text-brand-700 dark:text-brand-300",
      bg: "bg-brand-500/10",
      border: "border-brand-500/30",
      dot: "bg-brand-500",
    },
    principalHref: "/principal",
    teacherHref: "/teacher",
  },
  {
    id: "xray",
    label: "Akademik Röntgen",
    shortLabel: "Röntgen",
    description: "Öğrenci bazlı derin performans ve konu analizi.",
    icon: Scan,
    accent: {
      text: "text-sky-700 dark:text-sky-300",
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
      dot: "bg-sky-500",
    },
    principalHref: "/xray/principal",
    teacherHref: "/xray/teacher",
  },
  {
    id: "olcme",
    label: "Ölçme Değerlendirme",
    shortLabel: "Ölçme",
    description: "Deneme sonuçlarını kazanım bazlı analiz et, Akademik Röntgen'i otomatik besle.",
    icon: FileBarChart,
    // ⚠️ BİLİNEN ÇAKIŞMA: Ödeme Takip'le aynı zümrüt yeşili. Modül
    // değiştiricide ikisi yan yana görünüyor ve renkten ayırt edilemiyor;
    // ayrımı ikon ve ad taşıyor. Toptan renk değişimi YAPILMADI çünkü
    // Ölçme modülünde 231 zümrüt kullanımı var ve orada yeşil çoğu yerde
    // "doğru cevap" anlamına geliyor — kör bir değiştirme anlamı bozardı.
    // Modül kimlik rengi bir tasarım kararı; Mert'e bırakıldı.
    accent: {
      text: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    principalHref: "/olcme/principal",
    teacherHref: "/olcme/teacher",
  },
  {
    id: "video",
    label: "Video Ders Merkezi",
    shortLabel: "Video",
    description: "Konu anlatım videolarını yükle, sınıf/ders/konuya göre grupla, öğrenciye tek tuşla ata.",
    icon: Clapperboard,
    accent: {
      text: "text-violet-700 dark:text-violet-300",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      dot: "bg-violet-500",
    },
    principalHref: "/videos/principal",
    teacherHref: "/videos/teacher",
  },
  {
    id: "payments",
    label: "Ödeme Takip",
    shortLabel: "Ödeme",
    description: "Öğrenci taksit planı, tahsilat kaydı ve kasa/banka bakiyesi tek ekranda.",
    icon: Wallet,
    accent: {
      text: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    principalHref: "/payments/principal",
    // Faz 1'de öğretmen görünümü YOK: finansal veri sadece yönetim + veli.
    teacherHref: null,
  },
];

export const MODULE_BY_ID: Record<ModuleId, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.id, m])
) as Record<ModuleId, ModuleDef>;

/**
 * Bir adresin hangi modüle ait olduğunu söyler.
 *
 * Gündem maddelerinin modülü BURADAN türetilir, kaynak nesnelerine ayrıca
 * yazılmaz: işin gideceği yer zaten modülünü belirtir, iki yerde tutulursa
 * er ya da geç ayrışır.
 */
export function moduleFromHref(href: string | undefined): ModuleId {
  if (!href) return "erp";
  const path = href.split("?")[0];
  // En uzun eşleşme kazanır: "/principal" her adresin başına uymasın.
  const match = MODULES.filter((m) => m.id !== "erp").find(
    (m) => path === m.principalHref || path.startsWith(`${m.principalHref}/`) || path === m.teacherHref
  );
  return match?.id ?? "erp";
}

/** Verilen yol hangi modülün içindeyse o — üst çubuk "neredeyim"i bundan bilir. */
export function moduleFromPathname(pathname: string): ModuleId {
  const match = MODULES.filter((m) => m.id !== "erp").find(
    (m) =>
      pathname === m.principalHref ||
      pathname.startsWith(`${m.principalHref}/`) ||
      (m.teacherHref !== null && (pathname === m.teacherHref || pathname.startsWith(`${m.teacherHref}/`)))
  );
  return match?.id ?? "erp";
}

/** Rolüne göre o modülün adresi. Öğretmen görünümü yoksa null. */
export function moduleHref(mod: ModuleDef, isTeacher: boolean): string | null {
  return isTeacher ? mod.teacherHref : mod.principalHref;
}
