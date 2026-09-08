import type { Payment, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

// Makbuz numarası çakışmasında kaç kez yeniden denensin.
//
// Çakışma ancak İKİ tahsilat aynı milisaniyede aynı numarayı okuduğunda
// olur; her denemede kazanan taraf sayacı ilerlettiği için üst üste beş
// kez çakışması pratikte imkânsız.
const MAX_RECEIPT_RETRIES = 5;

// Prisma'nın benzersizlik ihlali kodu.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export class OverCollectionError extends Error {
  constructor(public remaining: number) {
    super(`Tutar kalan bakiyeyi (${remaining.toFixed(2)}) aşamaz.`);
    this.name = "OverCollectionError";
  }
}

export type CollectInput = {
  institutionId: string;
  installmentId: string;
  installmentAmount: number;
  studentId: string;
  accountId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  note: string | null;
  recordedByAdminId: string;
};

export type CollectResult = { payment: Payment; receiptNo: number; remainingAfter: number };

// Tahsilat kaydı — EŞZAMANLILIĞA KARŞI KORUMALI.
//
// İki gerçek yarış durumu vardı ve ikisi de testte üretildi:
//
// 1) MÜKERRER TAHSİLAT: "kalan tutar" işlem DIŞINDA okunuyordu. Vezneci
//    çift tıklarsa iki istek de aynı kalanı görüp ikisi de geçerli
//    sayılıyordu. Çözüm: taksit satırı işlem içinde FOR UPDATE ile
//    kilitlenir; ikinci istek birincinin commit'ini bekler ve güncel
//    kalanı görür. (Read Committed'de yalnızca yeniden okumak yetmez —
//    commit edilmemiş satır görünmez.)
//
// 2) MAKBUZ NUMARASI ÇAKIŞMASI: numara "en büyük + 1" ile üretiliyordu.
//    İKİ FARKLI öğrenciden aynı anda tahsilat alındığında (vezne başında
//    iki kişi — tamamen olağan) ikisi de aynı numarayı alıyor, benzersiz
//    kısıt birini reddediyor ve müdür "Beklenmeyen hata" görüyordu.
//    Çözüm: çakışmada işlemin tamamı yeniden denenir.
//
// İki koruma BİRLİKTE olmak zorunda: yalnızca (2) düzeltilseydi,
// numara çakışmasının tesadüfen engellediği mükerrer tahsilat serbest
// kalırdı.
export async function collectPayment(input: CollectInput): Promise<CollectResult> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RECEIPT_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Taksit satırını kilitle. Aynı taksite gelen ikinci istek bu
        // satırda bekler; kilit işlem bitince bırakılır.
        await tx.$queryRaw`SELECT id FROM "Installment" WHERE id = ${input.installmentId} FOR UPDATE`;

        const paidRows = await tx.payment.findMany({
          where: { installmentId: input.installmentId, status: "COMPLETED" },
          select: { amount: true },
        });
        const alreadyPaid = paidRows.reduce((sum, p) => sum + Number(p.amount), 0);
        const remaining = Math.round((input.installmentAmount - alreadyPaid) * 100) / 100;
        // Kuruş toleransı: 0.009 — ondalık yuvarlamadan doğan sapmayı
        // "fazla tahsilat" saymamak için (bkz. installment-math).
        if (input.amount > remaining + 0.009) throw new OverCollectionError(remaining);

        const last = await tx.payment.findFirst({
          where: { institutionId: input.institutionId, receiptNo: { not: null } },
          orderBy: { receiptNo: "desc" },
          select: { receiptNo: true },
        });
        const receiptNo = (last?.receiptNo ?? 0) + 1;

        const payment = await tx.payment.create({
          data: {
            institutionId: input.institutionId,
            receiptNo,
            studentId: input.studentId,
            installmentId: input.installmentId,
            accountId: input.accountId,
            amount: input.amount,
            method: input.method,
            paidAt: input.paidAt,
            note: input.note,
            recordedByAdminId: input.recordedByAdminId,
          },
        });

        const remainingAfter = Math.round((remaining - input.amount) * 100) / 100;
        await tx.installment.update({
          where: { id: input.installmentId },
          data: { status: remainingAfter <= 0.009 ? "PAID" : "PARTIALLY_PAID" },
        });

        return { payment, receiptNo, remainingAfter: Math.max(0, remainingAfter) };
      });
    } catch (error) {
      // Fazla tahsilat bir YARIŞ değil, kullanıcı hatasıdır — tekrar
      // denemek aynı sonucu verir, hemen yukarı taşınır.
      if (error instanceof OverCollectionError) throw error;
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }

  throw (lastError as Error) ?? new Error("Tahsilat kaydedilemedi.");
}

export type { Prisma };
