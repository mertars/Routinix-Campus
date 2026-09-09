import { prisma } from "@/lib/server/prisma";
import { OPEN_INSTALLMENT_STATUSES } from "@/lib/server/payments/student-debt";
import { RENEWAL_WINDOW_DAYS } from "@/lib/server/enrollment/enrollment-service";
import { trDayOfMonth } from "../tr-time";
import { paymentsHref, type AgendaSource } from "../agenda-types";

const CASH_COUNT_STALE_DAYS = 30;

// Paranın gündemi. Hepsi ödeme modülüne gider ve ?tab= ile doğrudan
// ilgili sekmeye iner — müdür 11 sekme arasında aramasın.
export const FINANCE_SOURCES: AgendaSource[] = [
  {
    key: "installment-overdue",
    horizon: "today",
    area: "finance",
    urgency: "critical",
    href: paymentsHref("students"),
    async load(ctx) {
      const count = await prisma.installment.count({
        where: {
          institutionId: ctx.institutionId,
          status: { in: [...OPEN_INSTALLMENT_STATUSES] },
          dueDate: { lt: ctx.todayStart },
          // Ayrılan öğrencinin borcu ayrı bir konu; gündemde aktifler var.
          student: { isActive: true },
        },
      });
      if (count === 0) return null;
      return { count, title: `${count} taksitin vadesi geçti`, detail: "Hatırlatma gönderin ya da yapılandırın" };
    },
  },
  {
    key: "promise-broken",
    horizon: "today",
    area: "finance",
    urgency: "critical",
    href: paymentsHref("students"),
    async load(ctx) {
      // Veli "şu gün ödeyeceğim" dedi, gün geçti, söz hâlâ açık.
      // Vadesi geçmiş taksitten AYRI bir iş: burada bir söz verilmiş ve
      // tutulmamış, yani aranacak belirli bir kişi var.
      const count = await prisma.paymentPromise.count({
        where: { institutionId: ctx.institutionId, closedAt: null, promisedDate: { lt: ctx.todayStart } },
      });
      if (count === 0) return null;
      return { count, title: `${count} ödeme sözü tutulmadı`, detail: "Söz verilen gün geçti · veliyi arayın" };
    },
  },
  {
    key: "promise-today",
    horizon: "today",
    area: "finance",
    urgency: "attention",
    href: paymentsHref("students"),
    async load(ctx) {
      const count = await prisma.paymentPromise.count({
        where: {
          institutionId: ctx.institutionId,
          closedAt: null,
          promisedDate: { gte: ctx.todayStart, lt: ctx.todayEnd },
        },
      });
      if (count === 0) return null;
      return { count, title: `Bugün ${count} ödeme sözü var`, detail: "Tahsil edilince sözü kapatın" };
    },
  },
  {
    key: "expense-due",
    horizon: "today",
    area: "finance",
    urgency: "critical",
    href: paymentsHref("expenses"),
    async load(ctx) {
      // Vadesi bugün ya da geçmiş, hâlâ ödenmemiş giderler. Kaçırılan
      // fatura gecikme faizi demek — taksit alacağıyla aynı ağırlıkta.
      const count = await prisma.expense.count({
        where: { institutionId: ctx.institutionId, status: "PENDING", dueDate: { lt: ctx.todayEnd } },
      });
      if (count === 0) return null;
      return { count, title: `${count} giderin ödeme günü geldi`, detail: "Vadesi bugün ya da geçmiş" };
    },
  },
  {
    key: "bank-unmatched",
    horizon: "week",
    area: "finance",
    urgency: "attention",
    href: paymentsHref("bank-import"),
    async load(ctx) {
      const count = await prisma.bankTransaction.count({
        where: { institutionId: ctx.institutionId, status: "UNMATCHED" },
      });
      if (count === 0) return null;
      return { count, title: `${count} banka hareketi eşleştirilmedi`, detail: "Gelen havaleler henüz tahsilata dönüşmedi" };
    },
  },
  {
    key: "enrollment-renewal",
    horizon: "week",
    area: "finance",
    urgency: "attention",
    href: paymentsHref("renewals"),
    async load(ctx) {
      const count = await prisma.studentEnrollment.count({
        where: {
          institutionId: ctx.institutionId,
          status: "ACTIVE",
          student: { isActive: true },
          endDate: { lte: new Date(ctx.now.getTime() + RENEWAL_WINDOW_DAYS * 86_400_000) },
        },
      });
      if (count === 0) return null;
      return {
        count,
        title: `${count} öğrencinin kaydı ${RENEWAL_WINDOW_DAYS} gün içinde bitiyor`,
        detail: "Veliyle görüşüp yenileyin — yenilenmezse gelir düşer",
      };
    },
  },
  {
    key: "contract-unsigned",
    horizon: "week",
    area: "finance",
    urgency: "attention",
    href: paymentsHref("contracts"),
    async load(ctx) {
      // Gönderilmiş ama imzalanmamış sözleşmeler. Süresi dolarsa bağ
      // kopar ve baştan gönderilmesi gerekir.
      const [pending, expiringSoon] = await Promise.all([
        prisma.studentContract.count({
          where: { institutionId: ctx.institutionId, status: "SENT", expiresAt: { gt: ctx.now } },
        }),
        prisma.studentContract.count({
          where: { institutionId: ctx.institutionId, status: "SENT", expiresAt: { gt: ctx.now, lte: ctx.weekEnd } },
        }),
      ]);
      if (pending === 0) return null;
      return {
        count: pending,
        title: `${pending} sözleşme imza bekliyor`,
        detail: expiringSoon > 0 ? `${expiringSoon} tanesinin süresi 7 gün içinde doluyor` : "Veliye gönderildi, henüz imzalanmadı",
        urgency: expiringSoon > 0 ? "critical" : undefined,
      };
    },
  },
  {
    key: "payroll-pending",
    horizon: "month",
    area: "finance",
    urgency: "attention",
    href: paymentsHref("payroll"),
    async load(ctx) {
      const [year, month] = ctx.monthKey.split("-").map(Number);
      // İkisi birbirinden bağımsız — ardışık atmak boşuna ikinci bir
      // ağ turu demekti (ölçüldü: 134 ms, tek tur 70 ms).
      const [period, staff] = await Promise.all([
        prisma.payrollPeriod.findUnique({
          where: { institutionId_year_month: { institutionId: ctx.institutionId, year, month } },
          select: { status: true },
        }),
        prisma.teacher.count({ where: { institutionId: ctx.institutionId } }),
      ]);
      if (period?.status === "PAID") return null;
      // Kadro yoksa bordro da yoktur — boş kurumda uyarı gürültüdür.
      if (staff === 0) return null;
      return {
        count: staff,
        title: period ? "Bu ayın bordrosu taslakta" : "Bu ayın bordrosu hazırlanmadı",
        detail: `${staff} personel · ay kapanmadan ödeyin`,
      };
    },
  },
  {
    key: "recurring-expense",
    horizon: "month",
    area: "finance",
    urgency: "attention",
    href: paymentsHref("expenses"),
    async load(ctx) {
      // Kira/fatura gibi her ay tekrar eden giderlerden bu ay henüz
      // gider kaydına dönüşmemiş olanlar. Yalnızca AYIN GÜNÜ GELMİŞ
      // olanlar sayılır: ayın 25'inde ödenen kira, ayın 3'ünde
      // "eksik" değildir.
      const dayOfMonth = trDayOfMonth(ctx.now);
      const count = await prisma.recurringExpense.count({
        where: {
          institutionId: ctx.institutionId,
          isActive: true,
          dayOfMonth: { lte: dayOfMonth },
          OR: [{ lastGeneratedMonth: null }, { lastGeneratedMonth: { not: ctx.monthKey } }],
        },
      });
      if (count === 0) return null;
      return { count, title: `${count} düzenli gider bu ay işlenmedi`, detail: "Kira, fatura vb. · gider kaydına dönmedi" };
    },
  },
  {
    key: "cash-count-stale",
    horizon: "month",
    area: "finance",
    urgency: "info",
    href: paymentsHref("accounts"),
    async load(ctx) {
      const [accounts, last] = await Promise.all([
        prisma.paymentAccount.count({
          where: { institutionId: ctx.institutionId, isActive: true, type: "CASH" },
        }),
        // Tek satır, (institutionId, countedAt) dizini üstünden.
        prisma.cashCount.findFirst({
          where: { institutionId: ctx.institutionId },
          orderBy: { countedAt: "desc" },
          select: { countedAt: true },
        }),
      ]);
      if (accounts === 0) return null;
      const days = last ? Math.floor((ctx.now.getTime() - last.countedAt.getTime()) / 86_400_000) : null;
      if (days !== null && days < CASH_COUNT_STALE_DAYS) return null;
      return {
        count: accounts,
        title: days === null ? "Kasa hiç sayılmadı" : `Kasa ${days} gündür sayılmadı`,
        detail: "Sistem bakiyesiyle fiili nakit karşılaştırılmalı",
        urgency: days !== null && days >= CASH_COUNT_STALE_DAYS * 2 ? "attention" : undefined,
      };
    },
  },
];
