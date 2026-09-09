import { prisma } from "@/lib/server/prisma";
import type { AgendaSource } from "../agenda-types";

// Kadro ve kurulum boşlukları — hepsi "gaps" ufkunda.
//
// Bunlar "bugün yetişmezse olmaz" işleri DEĞİL; SESSİZ arızalar. Kimse
// şikâyet etmez ama sistem yarım çalışır: SMS gider görünür kimseye
// ulaşmaz, şubenin programı yoksa yoklama eksiği hiç fark edilmez.
//
// ⚠️ Ayrı ufukta durmalarının sebebi ölçüldü: bu maddeler yapılacaklar
// listesine karışınca her kurumda kalıcı olarak yanıyor ve listeyi
// okunmaz hale getiriyordu. Kendi başlıklarında, varsayılan kapalı.
export const ROSTER_SOURCES: AgendaSource[] = [
  {
    key: "branch-no-schedule",
    horizon: "gaps",
    area: "schedule",
    urgency: "attention",
    tab: "schedule-matrix",
    async load(ctx) {
      const count = await prisma.branch.count({
        where: { institutionId: ctx.institutionId, lessonSlots: { none: {} } },
      });
      if (count === 0) return null;
      return {
        count,
        title: `${count} şubenin ders programı yok`,
        detail: "Programsız şubede yoklama eksiği de fark edilmez",
      };
    },
  },
  {
    key: "student-no-parent",
    horizon: "gaps",
    area: "people",
    urgency: "attention",
    tab: "students",
    async load(ctx) {
      // Velisi tanımsız öğrenciye ulaşmanın hiçbir yolu yok: ne SMS, ne
      // veli paneli, ne borç bildirimi.
      const count = await prisma.student.count({
        where: { institutionId: ctx.institutionId, isActive: true, parents: { none: {} } },
      });
      if (count === 0) return null;
      return { count, title: `${count} öğrencinin velisi tanımlı değil`, detail: "Bu ailelere hiçbir bildirim ulaşmaz" };
    },
  },
  {
    key: "sms-consent",
    horizon: "gaps",
    area: "comms",
    urgency: "info",
    tab: "bulk-sms",
    async load(ctx) {
      const count = await prisma.parent.count({ where: { institutionId: ctx.institutionId, smsConsent: false } });
      if (count === 0) return null;
      return { count, title: `${count} velinin SMS izni kapalı`, detail: "Bu velilere hatırlatma ve duyuru ULAŞMAZ" };
    },
  },
  {
    key: "student-no-advisor",
    horizon: "gaps",
    area: "people",
    urgency: "info",
    tab: "students",
    async load(ctx) {
      const count = await prisma.student.count({
        where: { institutionId: ctx.institutionId, isActive: true, advisorTeacherId: null },
      });
      if (count === 0) return null;
      return { count, title: `${count} öğrencinin danışman öğretmeni yok`, detail: "Rehberlik takibi sahipsiz kalıyor" };
    },
  },
  {
    key: "preference-missing",
    horizon: "gaps",
    area: "people",
    urgency: "info",
    tab: "preference-robot",
    async load(ctx) {
      // Son sınıf öğrencisinin tercih listesi boşsa tercih robotu o
      // öğrenci için hiçbir şey üretemez.
      const count = await prisma.student.count({
        where: {
          institutionId: ctx.institutionId,
          isActive: true,
          branch: { grade: 12 },
          preferences: { none: {} },
        },
      });
      if (count === 0) return null;
      return { count, title: `${count} son sınıf öğrencisinin tercih listesi boş`, detail: "YKS tercih robotu veri bekliyor" };
    },
  },
];
