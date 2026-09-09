import { prisma } from "@/lib/server/prisma";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { parseBankStatement, fingerprintRow, type ParsedBankRow } from "@/lib/server/payments/bank-statement";
import { matchBankRow, type MatchableStudent, type MatchCandidate } from "@/lib/server/payments/bank-match";
import { getStudentDebts } from "@/lib/server/payments/student-debt";
import { collectPayment, OverCollectionError } from "@/lib/server/payments/collect-service";

// Banka ekstresi içe aktarma ve tahsilata dönüştürme.
//
// İki adımlıdır ve bu bilinçlidir: ÖNCE satırlar kaydedilir ve
// eşleştirme ÖNERİLİR, SONRA insan onaylayınca tahsilat yazılır.
// Para yazmak geri alınması en zor işlemlerden biri.

export type ImportSummary = {
  parsed: number;
  imported: number;
  duplicates: number;
  skipped: { lineNumber: number; reason: string }[];
  detectedColumns: Record<string, string>;
};

export async function importBankStatement(input: {
  institutionId: string;
  accountId: string;
  rawText: string;
  importedById: string;
}): Promise<ImportSummary> {
  const account = await prisma.paymentAccount.findUnique({
    where: { id: input.accountId },
    select: { institutionId: true, type: true },
  });
  if (!account || account.institutionId !== input.institutionId) {
    throw new AdminCreateError("Hesap bulunamadı.", 404);
  }

  const { rows, skipped, detectedColumns } = parseBankStatement(input.rawText);
  if (rows.length === 0) {
    return { parsed: 0, imported: 0, duplicates: 0, skipped, detectedColumns };
  }

  // ⚠️ Mükerrer satırlar SESSİZCE atlanır, hata verilmez.
  //
  // Sekreterin aynı ekstreyi iki kez yüklemesi çok olağan bir durum
  // (ay ortasında bir kez, ay sonunda tekrar). Hata vermek yüklemeyi
  // tamamen engellerdi; oysa doğru davranış yeni satırları alıp
  // eskileri atlamaktır. skipDuplicates bunu veritabanı düzeyinde
  // yapar — iki eşzamanlı yükleme bile aynı satırı iki kez yazamaz
  // (@@unique institutionId+fingerprint).
  const data = rows.map((row) => ({
    institutionId: input.institutionId,
    accountId: input.accountId,
    transactionDate: row.transactionDate,
    amount: row.amount,
    description: row.description,
    bankReference: row.bankReference,
    fingerprint: fingerprintRow(input.accountId, row),
    importedById: input.importedById,
  }));

  const created = await prisma.bankTransaction.createMany({ data, skipDuplicates: true });

  return {
    parsed: rows.length,
    imported: created.count,
    duplicates: rows.length - created.count,
    skipped,
    detectedColumns,
  };
}

export type UnmatchedRow = {
  id: string;
  transactionDate: string;
  amount: number;
  description: string;
  bankReference: string | null;
  suggestedStudentId: string | null;
  candidates: MatchCandidate[];
};

// Eşleşmemiş satırlar + her biri için aday öğrenciler.
export async function listUnmatched(institutionId: string, limit = 100): Promise<UnmatchedRow[]> {
  const transactions = await prisma.bankTransaction.findMany({
    where: { institutionId, status: "UNMATCHED" },
    orderBy: { transactionDate: "desc" },
    take: limit,
  });
  if (transactions.length === 0) return [];

  // Öğrenci listesi ve borçları TEK seferde çekilir; satır başına
  // sorgu atmak 100 satırlık bir ekstrede 100 gidiş dönüş olurdu.
  const students = await prisma.student.findMany({
    where: { institutionId, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      branch: { select: { name: true } },
      parents: { select: { parent: { select: { firstName: true, lastName: true } } } },
    },
  });
  const debts = await getStudentDebts(students.map((s) => s.id));

  const matchable: MatchableStudent[] = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    studentNumber: s.studentNumber,
    branchName: s.branch.name,
    openDebt: debts.get(s.id)?.openDebt ?? 0,
    parentNames: s.parents.map((p) => `${p.parent.firstName} ${p.parent.lastName}`),
  }));

  return transactions.map((t) => {
    const outcome = matchBankRow(matchable, t.description, Number(t.amount));
    return {
      id: t.id,
      transactionDate: t.transactionDate.toISOString(),
      amount: Number(t.amount),
      description: t.description,
      bankReference: t.bankReference,
      suggestedStudentId: outcome.suggestedStudentId,
      candidates: outcome.candidates,
    };
  });
}

export type ConfirmResult = { transactionId: string; ok: boolean; reason?: string; receiptNo?: number };

// Onaylanan eşleşmeleri TAHSİLATA dönüştürür.
//
// ⚠️ Tahsilat buradan doğrudan YAZILMAZ: her zaman collectPayment
// çağrılır. Böylece fazla tahsilat kilidi, makbuz numarası üretimi ve
// taksit durumu güncellemesi gibi korumaların hepsi aynen geçerli olur
// — ekstre yolu, veznedeki elle tahsilattan farklı bir kapı değildir.
export async function confirmMatches(input: {
  institutionId: string;
  actorId: string;
  matches: { transactionId: string; studentId: string; installmentId: string }[];
}): Promise<ConfirmResult[]> {
  const results: ConfirmResult[] = [];

  for (const match of input.matches) {
    const tx = await prisma.bankTransaction.findUnique({
      where: { id: match.transactionId },
      select: { id: true, institutionId: true, status: true, amount: true, accountId: true, transactionDate: true, description: true },
    });
    if (!tx || tx.institutionId !== input.institutionId) {
      results.push({ transactionId: match.transactionId, ok: false, reason: "Ekstre satırı bulunamadı." });
      continue;
    }
    // Aynı satır iki kez onaylanamaz — sekreter listeyi iki sekmede
    // açmış olabilir.
    if (tx.status !== "UNMATCHED") {
      results.push({ transactionId: match.transactionId, ok: false, reason: "Bu satır zaten işlenmiş." });
      continue;
    }

    const installment = await prisma.installment.findUnique({
      where: { id: match.installmentId },
      select: { id: true, institutionId: true, studentId: true, amount: true, status: true },
    });
    if (!installment || installment.institutionId !== input.institutionId) {
      results.push({ transactionId: tx.id, ok: false, reason: "Taksit bulunamadı." });
      continue;
    }
    if (installment.studentId !== match.studentId) {
      results.push({ transactionId: tx.id, ok: false, reason: "Taksit bu öğrenciye ait değil." });
      continue;
    }

    try {
      const { payment, receiptNo } = await collectPayment({
        institutionId: input.institutionId,
        installmentId: installment.id,
        installmentAmount: Number(installment.amount),
        studentId: match.studentId,
        accountId: tx.accountId,
        amount: Number(tx.amount),
        method: "BANK_TRANSFER",
        paidAt: tx.transactionDate,
        note: `Banka ekstresi: ${tx.description}`.slice(0, 500),
        recordedByAdminId: input.actorId,
      });

      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: { status: "MATCHED", matchedStudentId: match.studentId, paymentId: payment.id },
      });

      results.push({ transactionId: tx.id, ok: true, receiptNo });
    } catch (error) {
      // Fazla tahsilat en olası hata: veli borcundan fazlasını
      // göndermiş ya da yanlış taksit seçilmiş olabilir. Satır
      // EŞLEŞMEMİŞ kalır, sekreter başka taksit seçebilir.
      results.push({
        transactionId: tx.id,
        ok: false,
        reason:
          error instanceof OverCollectionError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Tahsilat oluşturulamadı.",
      });
    }
  }

  return results;
}

// Öğrenci ödemesi olmayan satırlar (banka masrafı, kurumun kendi
// transferi) listeyi kirletmesin diye işaretlenebilir.
export async function ignoreTransaction(institutionId: string, transactionId: string, reason: string) {
  const tx = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    select: { institutionId: true, status: true },
  });
  if (!tx || tx.institutionId !== institutionId) throw new AdminCreateError("Ekstre satırı bulunamadı.", 404);
  if (tx.status === "MATCHED") throw new AdminCreateError("Tahsilata dönüşmüş bir satır yok sayılamaz.", 409);

  return prisma.bankTransaction.update({
    where: { id: transactionId },
    data: { status: "IGNORED", ignoredReason: reason.trim() || null },
  });
}
