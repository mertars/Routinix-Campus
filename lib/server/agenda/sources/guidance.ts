import { prisma } from "@/lib/server/prisma";
import type { AgendaSource } from "../agenda-types";

const QUESTION_STALE_DAYS = 3;

// Bu alanın ortak özelliği: KARŞIDA BEKLEYEN BİRİ var. Öğrenci etüt
// talebi göndermiş, öğretmen öğrenciyi rehberliğe yönlendirmiş, mezun
// mentorluk isteği almış. Cevapsız kalması kurumun yüzüne yazılır.
export const GUIDANCE_SOURCES: AgendaSource[] = [
  {
    key: "appointments-pending",
    horizon: "week",
    area: "guidance",
    urgency: "attention",
    tab: "etut-management",
    async load(ctx) {
      const count = await prisma.appointmentRequest.count({
        where: { status: "PENDING", teacher: { institutionId: ctx.institutionId } },
      });
      if (count === 0) return null;
      return { count, title: `${count} etüt talebi onay bekliyor`, detail: "Öğrenciler yanıt bekliyor" };
    },
  },
  {
    key: "referral-pending",
    horizon: "week",
    area: "guidance",
    urgency: "attention",
    tab: "guidance-program",
    async load(ctx) {
      const count = await prisma.guidanceReferral.count({
        where: { status: "PENDING", student: { institutionId: ctx.institutionId } },
      });
      if (count === 0) return null;
      return {
        count,
        title: `${count} rehberlik yönlendirmesi incelenmedi`,
        detail: "Öğretmen bir öğrenci için rehberliğe not düştü",
      };
    },
  },
  {
    key: "question-stale",
    horizon: "week",
    area: "guidance",
    urgency: "attention",
    tab: "teachers",
    async load(ctx) {
      // Öğrencinin sorduğu ve GÜNLERDİR yanıtsız kalan sorular. Dünkü
      // soru "gecikmiş" değildir; eşik olmadan bu madde her gün yanardı.
      const staleBefore = new Date(ctx.todayStart.getTime() - QUESTION_STALE_DAYS * 86_400_000);
      const count = await prisma.question.count({
        where: { status: "PENDING", createdAt: { lt: staleBefore }, student: { institutionId: ctx.institutionId } },
      });
      if (count === 0) return null;
      return {
        count,
        title: `${count} öğrenci sorusu ${QUESTION_STALE_DAYS}+ gündür yanıtsız`,
        detail: "Soruyu soran öğretmeni hatırlatın",
      };
    },
  },
  {
    key: "mentor-pending",
    horizon: "month",
    area: "guidance",
    urgency: "info",
    tab: "alumni",
    async load(ctx) {
      const count = await prisma.mentorRequest.count({
        where: { status: "PENDING", requesterStudent: { institutionId: ctx.institutionId } },
      });
      if (count === 0) return null;
      return { count, title: `${count} mentorluk talebi bekliyor`, detail: "Öğrenci bir mezunla eşleşmek istiyor" };
    },
  },
];
