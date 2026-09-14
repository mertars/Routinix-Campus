// BİLDİRİM OLAY KATALOĞU — istemci ve sunucu BİRLİKTE kullanır.
//
// "Kaynak kaydı" deseni (bkz. CLAUDE.md > Mimari desenler): yeni bir olay
// eklemek = aşağıdaki NOTIFICATION_EVENTS nesnesine BİR satır eklemek.
// Kategori, ikon, renk ve varsayılan aciliyet tek yerde tanımlı; ne API
// rotasında ne de UI'da if/else dallanması gerekiyor.
//
// ⚠️ Bu dosya SUNUCUYA ÖZEL hiçbir şey (prisma, fs, env) import ETMEZ —
// "use client" bileşenleri de aynen import ediyor.

export const ACTIVITY_CATEGORIES = [
  "ATTENDANCE",
  "HOMEWORK",
  "EXAM",
  "PAYMENT",
  "STUDENT",
  "SCHEDULE",
  "GUIDANCE",
  "CONTENT",
  "ANNOUNCEMENT",
  "SYSTEM",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type ActivityAudience = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "GUIDANCE";

// Kategori etiketleri — bildirim kutusundaki sekme adları. Kullanıcı isteği:
// "yöneticiye çok bildirim geliyor bunları gruplarsan ödeme sınıf öğrenci
// tümü vs. güzel olur".
export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  ATTENDANCE: "Yoklama",
  HOMEWORK: "Ödev",
  EXAM: "Sınav",
  PAYMENT: "Ödeme",
  STUDENT: "Öğrenci",
  SCHEDULE: "Program",
  GUIDANCE: "Rehberlik",
  CONTENT: "İçerik",
  ANNOUNCEMENT: "Duyuru",
  SYSTEM: "Sistem",
};

// Her kategorinin kendi rengi var — bildirim satırındaki sol şerit ve ikon
// kutusu bunu kullanır, böylece kullanıcı listeyi OKUMADAN renkten tarayabilir.
// Tailwind sınıfları kasıtlı olarak TAM yazılmış (dinamik string birleştirme
// Tailwind'in JIT tarayıcısında çalışmaz).
export const CATEGORY_STYLE: Record<ActivityCategory, { chip: string; rail: string; dot: string }> = {
  ATTENDANCE: { chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300", rail: "bg-emerald-500", dot: "bg-emerald-500" },
  HOMEWORK: { chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300", rail: "bg-violet-500", dot: "bg-violet-500" },
  EXAM: { chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300", rail: "bg-sky-500", dot: "bg-sky-500" },
  PAYMENT: { chip: "bg-amber-500/14 text-amber-700 dark:text-amber-300", rail: "bg-amber-500", dot: "bg-amber-500" },
  STUDENT: { chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300", rail: "bg-rose-500", dot: "bg-rose-500" },
  SCHEDULE: { chip: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300", rail: "bg-cyan-500", dot: "bg-cyan-500" },
  GUIDANCE: { chip: "bg-teal-500/12 text-teal-700 dark:text-teal-300", rail: "bg-teal-500", dot: "bg-teal-500" },
  CONTENT: { chip: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300", rail: "bg-indigo-500", dot: "bg-indigo-500" },
  ANNOUNCEMENT: { chip: "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300", rail: "bg-fuchsia-500", dot: "bg-fuchsia-500" },
  SYSTEM: { chip: "bg-slate-500/12 text-slate-700 dark:text-slate-300", rail: "bg-slate-500", dot: "bg-slate-500" },
};

// İkon adı — components/ui/notification-icon.tsx bunu gerçek lucide
// bileşenine çevirir (bu dosya saf veri kalsın diye burada sadece ad var).
export type NotificationIconName =
  | "clipboard-check"
  | "book-open"
  | "file-bar-chart"
  | "wallet"
  | "user-plus"
  | "calendar-clock"
  | "life-buoy"
  | "image"
  | "megaphone"
  | "settings"
  | "alert-triangle"
  | "check-circle"
  | "help-circle"
  | "video"
  | "graduation-cap"
  | "clock-alert"
  | "file-signature"
  | "puzzle"
  | "rocket";

export type NotificationEvent = {
  category: ActivityCategory;
  icon: NotificationIconName;
  /** Varsayılan aciliyet — emit sırasında ezilebilir. */
  urgent?: boolean;
};

// OLAY KATALOĞU. Anahtarlar "alan.eylem" biçiminde.
export const NOTIFICATION_EVENTS = {
  // --- Yoklama ---
  "attendance.submitted": { category: "ATTENDANCE", icon: "clipboard-check" },
  "attendance.absent": { category: "ATTENDANCE", icon: "alert-triangle", urgent: true },
  "attendance.missing": { category: "ATTENDANCE", icon: "clock-alert", urgent: true },

  // --- Ödev ---
  "homework.assigned": { category: "HOMEWORK", icon: "book-open" },
  "homework.graded": { category: "HOMEWORK", icon: "check-circle" },
  "homework.submitted": { category: "HOMEWORK", icon: "book-open" },

  // --- Sınav ---
  "exam.scheduled": { category: "EXAM", icon: "file-bar-chart" },
  "exam.results_ready": { category: "EXAM", icon: "file-bar-chart" },
  "exam.seating_published": { category: "EXAM", icon: "file-bar-chart" },

  // --- Ödeme ---
  "payment.received": { category: "PAYMENT", icon: "wallet" },
  "payment.overdue": { category: "PAYMENT", icon: "wallet", urgent: true },
  "payment.plan_created": { category: "PAYMENT", icon: "wallet" },
  "payment.postponed": { category: "PAYMENT", icon: "calendar-clock" },
  "payment.voided": { category: "PAYMENT", icon: "alert-triangle", urgent: true },
  "payment.promise_broken": { category: "PAYMENT", icon: "alert-triangle", urgent: true },

  // --- Öğrenci / kayıt ---
  "student.enrolled": { category: "STUDENT", icon: "user-plus" },
  "student.enrollment_expiring": { category: "STUDENT", icon: "clock-alert", urgent: true },
  "student.cancelled": { category: "STUDENT", icon: "alert-triangle", urgent: true },
  "student.account_created": { category: "STUDENT", icon: "user-plus" },
  "contract.signed": { category: "STUDENT", icon: "file-signature" },

  // --- Program / etüt ---
  "schedule.changed": { category: "SCHEDULE", icon: "calendar-clock", urgent: true },
  "appointment.requested": { category: "SCHEDULE", icon: "calendar-clock" },
  "appointment.approved": { category: "SCHEDULE", icon: "check-circle" },
  "appointment.rejected": { category: "SCHEDULE", icon: "alert-triangle" },
  "appointment.assigned": { category: "SCHEDULE", icon: "calendar-clock" },

  // --- Rehberlik ---
  "guidance.referral_created": { category: "GUIDANCE", icon: "life-buoy", urgent: true },
  "guidance.referral_resolved": { category: "GUIDANCE", icon: "check-circle" },
  "guidance.program_assigned": { category: "GUIDANCE", icon: "life-buoy" },
  "guidance.mentor_requested": { category: "GUIDANCE", icon: "help-circle" },

  // --- İçerik ---
  "question.asked": { category: "CONTENT", icon: "help-circle" },
  "question.answered": { category: "CONTENT", icon: "check-circle" },
  "material.shared": { category: "CONTENT", icon: "image" },
  "video.assigned": { category: "CONTENT", icon: "video" },
  "quiz.started": { category: "CONTENT", icon: "rocket", urgent: true },
  "remediation.assigned": { category: "CONTENT", icon: "puzzle" },

  // --- Duyuru ---
  "announcement.published": { category: "ANNOUNCEMENT", icon: "megaphone" },

  // --- Sistem ---
  "system.notice": { category: "SYSTEM", icon: "settings" },
} as const satisfies Record<string, NotificationEvent>;

export type NotificationEventType = keyof typeof NOTIFICATION_EVENTS;

export function eventMeta(eventType: string): NotificationEvent {
  return (NOTIFICATION_EVENTS as Record<string, NotificationEvent>)[eventType] ?? NOTIFICATION_EVENTS["system.notice"];
}

// Hangi rol hangi kategori sekmelerini görür. Bir öğrenciye "Ödeme" sekmesi
// göstermenin anlamı yok (finans bilgisi zaten ona hiç dönmüyor, bkz.
// Öğrenci 360'taki gizlilik kuralı); yöneticide ise hepsi var.
export const CATEGORIES_BY_AUDIENCE: Record<ActivityAudience, ActivityCategory[]> = {
  ADMIN: ["ATTENDANCE", "PAYMENT", "STUDENT", "EXAM", "SCHEDULE", "GUIDANCE", "HOMEWORK", "CONTENT", "SYSTEM"],
  TEACHER: ["ATTENDANCE", "HOMEWORK", "SCHEDULE", "CONTENT", "GUIDANCE", "EXAM", "ANNOUNCEMENT"],
  STUDENT: ["HOMEWORK", "EXAM", "SCHEDULE", "CONTENT", "GUIDANCE", "ANNOUNCEMENT"],
  PARENT: ["ATTENDANCE", "PAYMENT", "EXAM", "HOMEWORK", "SCHEDULE", "GUIDANCE", "ANNOUNCEMENT"],
  GUIDANCE: ["GUIDANCE", "STUDENT", "EXAM", "ATTENDANCE", "ANNOUNCEMENT"],
};

export type NotificationDto = {
  id: string;
  category: ActivityCategory;
  eventType: string;
  title: string;
  body: string | null;
  href: string | null;
  actorName: string | null;
  urgent: boolean;
  isRead: boolean;
  createdAt: string;
};

export type NotificationFeed = {
  items: NotificationDto[];
  /** Kategori → okunmamış sayısı. Sekme rozetleri bunu okur. */
  unreadByCategory: Record<string, number>;
  unreadTotal: number;
  /** Daha eski kayıt var mı (sayfalama). */
  nextCursor: string | null;
};
