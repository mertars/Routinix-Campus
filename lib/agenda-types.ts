// GÜNDEM SÖZLEŞMESİ — sunucu ile istemcinin ORTAK dili.
//
// Burada Prisma ya da sunucuya özel hiçbir şey yok; hem uç nokta hem
// panel hem yan menü rozetleri bu tipleri okur. Kaynakların kendisi
// (sorgular) lib/server/agenda/ altında ve istemciye HİÇ girmez.

/**
 * Panelin birinci ve TEK kırılımı. İç içe ikinci bir grup kafa karıştırır.
 *
 * İlk üçü ZAMAN ufku; "gaps" ise bilerek farklı cinsten: süreklilik arz
 * eden veri/kurulum boşlukları. Ölçüldü — bunlar yapılacaklar listesinin
 * içine karıştırıldığında her kurumda kalıcı olarak yanıyor ("108
 * öğrencinin danışmanı yok" gibi) ve listeyi duvar kâğıdına çeviriyor.
 * Kendi başlığında, varsayılan olarak KAPALI dururlar: bilgi kaybolmaz,
 * günlük iş listesi kirlenmez.
 */
export type AgendaHorizon = "today" | "week" | "month" | "gaps";

/** Renk değil ACİLİYET: sıralama, nokta rengi ve menü rozeti bundan çıkar. */
export type AgendaUrgency = "critical" | "attention" | "info";

/** İşin geldiği alan. Ufkun İÇİNDE ikinci eksen — satırdaki küçük etiket. */
export type AgendaArea = "attendance" | "finance" | "exam" | "guidance" | "people" | "comms" | "schedule";

export type AgendaItem = {
  key: string;
  horizon: AgendaHorizon;
  area: AgendaArea;
  urgency: AgendaUrgency;
  /** Sayılabilir olmak şart: "bir şeyler eksik" değil, "5 derste yoklama yok". */
  count: number;
  title: string;
  detail: string;
  /** ERP sekmesi — aynı sayfada geçiş. */
  tab?: string;
  /** Başka modül — ?tab= ile doğrudan ilgili sekmeye iner. */
  href?: string;
};

export type AgendaCounts = Record<AgendaHorizon, number> & { critical: number };

export type Agenda = {
  /** Düz liste: panel ufka göre gruplar, yan menü sekmeye göre toplar. */
  items: AgendaItem[];
  counts: AgendaCounts;
  allClear: boolean;
};

export const HORIZON_ORDER: AgendaHorizon[] = ["today", "week", "month", "gaps"];

/** Varsayılan olarak kapalı açılan gruplar. */
export const DEFAULT_COLLAPSED: AgendaHorizon[] = ["gaps"];

export const HORIZON_LABEL: Record<AgendaHorizon, string> = {
  today: "Bugün",
  week: "Bu hafta",
  month: "Bu ay",
  gaps: "Eksikler",
};

/** Grup başlığının altındaki bir satırlık açıklama — "neden şimdi" sorusunun cevabı. */
export const HORIZON_HINT: Record<AgendaHorizon, string> = {
  today: "Bugün yapılmazsa telafisi yok",
  week: "Biri bekliyor — birkaç gün içinde",
  month: "Ay kapanmadan · her ay tekrar eder",
  gaps: "Acil değil ama sistem yarım çalışıyor",
};

export const AREA_LABEL: Record<AgendaArea, string> = {
  attendance: "Yoklama",
  finance: "Finans",
  exam: "Sınav",
  guidance: "Rehberlik",
  people: "Öğrenci",
  comms: "İletişim",
  schedule: "Program",
};

// Ödeme sekmesine adres — tanım modül kaydında (lib/modules.ts), burada
// yalnızca gündem kaynaklarının kolay erişimi için yeniden dışa verilir.
export { paymentsHref } from "@/lib/modules";
