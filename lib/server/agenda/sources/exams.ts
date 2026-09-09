import { prisma } from "@/lib/server/prisma";
import type { AgendaSource } from "../agenda-types";

// Sınav işlerinin ortak özelliği: hepsinin bir TARİHİ var, yani
// gecikince telafisi yok. Oturma planı sınav sabahı kurulamaz, sonucu
// girilmemiş sınav ise öğrenciye hiç dönmemiş demektir.
export const EXAM_SOURCES: AgendaSource[] = [
  {
    key: "exam-today",
    horizon: "today",
    area: "exam",
    urgency: "info",
    tab: "upload",
    async load(ctx) {
      const count = await prisma.exam.count({
        where: { institutionId: ctx.institutionId, examDate: { gte: ctx.todayStart, lt: ctx.todayEnd } },
      });
      if (count === 0) return null;
      return {
        count,
        title: count === 1 ? "Bugün sınav var" : `Bugün ${count} sınav var`,
        detail: "Oturma planı ve optik formu hazır olmalı",
      };
    },
  },
  {
    key: "exam-no-seating",
    horizon: "week",
    area: "exam",
    urgency: "attention",
    tab: "exam-seating",
    async load(ctx) {
      // Önümüzdeki 7 gün içinde yapılacak ama tek bir oturma kaydı bile
      // olmayan sınavlar. Kısmen dağıtılmış plan "eksik" sayılmaz —
      // orada müdür zaten ekranda çalışıyordur.
      const count = await prisma.exam.count({
        where: {
          institutionId: ctx.institutionId,
          examDate: { gte: ctx.todayStart, lte: ctx.weekEnd },
          seatAssignments: { none: {} },
        },
      });
      if (count === 0) return null;
      return {
        count,
        title: `${count} sınavın oturma planı yok`,
        detail: "7 gün içinde yapılacak · Kelebek planı kurun",
      };
    },
  },
  {
    key: "exam-no-results",
    horizon: "week",
    area: "exam",
    urgency: "attention",
    tab: "upload",
    async load(ctx) {
      // Yapılmış ama tek net kaydı bile girilmemiş sınavlar. 45 günle
      // sınırlı: çok eski bir sınav artık "yapılacak iş" değil, arşiv.
      const since = new Date(ctx.todayStart.getTime() - 45 * 86_400_000);
      const count = await prisma.exam.count({
        where: {
          institutionId: ctx.institutionId,
          examDate: { gte: since, lt: ctx.todayStart },
          results: { none: {} },
        },
      });
      if (count === 0) return null;
      return {
        count,
        title: `${count} sınavın sonucu girilmedi`,
        detail: "Optik yükleyin — öğrenci ve veli sonucu göremiyor",
      };
    },
  },
];
