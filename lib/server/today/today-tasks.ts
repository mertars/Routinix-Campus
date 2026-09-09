import { prisma } from "@/lib/server/prisma";
import { findMissingAttendance } from "@/lib/server/attendance/missing-attendance";
import { OPEN_INSTALLMENT_STATUSES } from "@/lib/server/payments/student-debt";
import { RENEWAL_WINDOW_DAYS } from "@/lib/server/enrollment/enrollment-service";

// "BUGÜN NE YAPMAM LAZIM?"
//
// Müdür panelinde 18, ödeme panelinde 11 sekme var. Ölçüldü: bunların
// çoğu yılda bir (sınıf atlatma) ya da ayda bir (bordro) açılıyor;
// günlük iş küçük bir alt küme. Ekran ÖZELLİK LİSTESİ gibi kurulmuş,
// oysa müdürün sorusu "hangi özellikler var" değil, "bugün ne
// bekliyor".
//
// Bu modül o soruyu yanıtlar: her madde SAYILABİLİR bir iştir ve
// doğrudan yapılacağı sekmeye götürür. Sekmeler kalır ama artık
// başlangıç noktası değil, VARIŞ noktasıdır.
//
// ⚠️ Hepsi SAYIM sorgusudur (satır çekmez) ve tek Promise.all'da
// koşar: bu panel her açılışta yükleniyor, pahalı olamaz.

export type TaskUrgency = "critical" | "attention" | "info";

export type TodayTask = {
  key: string;
  title: string;
  detail: string;
  count: number;
  urgency: TaskUrgency;
  /** ERP sekmesi ya da modül adresi. */
  tab?: string;
  href?: string;
};

export type TodayDigest = {
  tasks: TodayTask[];
  /** Hiç iş yoksa panel "her şey yolunda" der — boş liste göstermez. */
  allClear: boolean;
};

export async function getTodayTasks(institutionId: string): Promise<TodayDigest> {
  const now = new Date();

  const [missingAttendance, overdueInstallments, renewalSoon, pendingAppointments, unmatchedBank, consentGap] =
    await Promise.all([
      findMissingAttendance(institutionId, now),

      // Vadesi geçmiş ve hâlâ açık taksitler.
      prisma.installment.count({
        where: {
          institutionId,
          status: { in: [...OPEN_INSTALLMENT_STATUSES] },
          dueDate: { lt: now },
          // Ayrılan öğrencinin borcu ayrı bir konu (bkz. madde 3);
          // günlük iş listesinde aktif öğrenciler yer alır.
          student: { isActive: true },
        },
      }),

      prisma.studentEnrollment.count({
        where: {
          institutionId,
          status: "ACTIVE",
          student: { isActive: true },
          endDate: { lte: new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 86_400_000) },
        },
      }),

      prisma.appointmentRequest.count({
        where: { status: "PENDING", teacher: { institutionId } },
      }),

      prisma.bankTransaction.count({ where: { institutionId, status: "UNMATCHED" } }),

      prisma.parent.count({ where: { institutionId, smsConsent: false } }),
    ]);

  const tasks: TodayTask[] = [];

  // Yoklama: gün içinde en zamana duyarlı iş. Ders geçtikten sonra
  // girilen yoklama güvenilirliğini kaybeder.
  if (missingAttendance.missing.length > 0) {
    tasks.push({
      key: "attendance",
      title: `${missingAttendance.missing.length} derste yoklama girilmedi`,
      detail: `${missingAttendance.dayName} · programda ${missingAttendance.scheduledLessons} ders var`,
      count: missingAttendance.missing.length,
      urgency: "critical",
      tab: "attendance",
    });
  }

  if (overdueInstallments > 0) {
    tasks.push({
      key: "overdue",
      title: `${overdueInstallments} taksitin vadesi geçti`,
      detail: "Hatırlatma gönderin ya da yapılandırın",
      count: overdueInstallments,
      urgency: "critical",
      href: "/payments/principal",
    });
  }

  if (pendingAppointments > 0) {
    tasks.push({
      key: "appointments",
      title: `${pendingAppointments} etüt talebi onay bekliyor`,
      detail: "Öğrenciler yanıt bekliyor",
      count: pendingAppointments,
      urgency: "attention",
      tab: "etut-management",
    });
  }

  if (unmatchedBank > 0) {
    tasks.push({
      key: "bank",
      title: `${unmatchedBank} banka hareketi eşleştirilmedi`,
      detail: "Gelen havaleler henüz tahsilata dönüşmedi",
      count: unmatchedBank,
      urgency: "attention",
      href: "/payments/principal",
    });
  }

  if (renewalSoon > 0) {
    tasks.push({
      key: "renewal",
      title: `${renewalSoon} öğrencinin kaydı ${RENEWAL_WINDOW_DAYS} gün içinde bitiyor`,
      detail: "Veliyle görüşüp yenileyin",
      count: renewalSoon,
      urgency: "attention",
      href: "/payments/principal",
    });
  }

  // İzin eksiği acil değil ama SESSİZ bir arıza: müdür SMS gönderdiğini
  // sanıp kimseye ulaşmıyor olabilir (bkz. smsConsent bulgusu).
  if (consentGap > 0) {
    tasks.push({
      key: "consent",
      title: `${consentGap} velinin SMS izni kapalı`,
      detail: "Bu velilere hatırlatma ve duyuru ULAŞMAZ",
      count: consentGap,
      urgency: "info",
      tab: "bulk-sms",
    });
  }

  // Aciliyet sırası: müdür listeyi taramak zorunda kalmasın.
  const order: Record<TaskUrgency, number> = { critical: 0, attention: 1, info: 2 };
  tasks.sort((a, b) => order[a.urgency] - order[b.urgency] || b.count - a.count);

  return { tasks, allClear: tasks.length === 0 };
}
