import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { toCsv, csvNumber, csvDate } from "@/lib/server/payments/csv";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };
const TYPES = ["income", "expense", "receivables"] as const;
type ExportType = (typeof TYPES)[number];

// GET /api/payments/principal/export?type=income|expense|receivables&from=&to=
//
// Mali müşavire gönderilecek DETAY dökümü. Raporlar sekmesindeki CSV
// yalnızca ekranda yüklü özeti dışa aktarıyordu; muhasebecinin ihtiyacı
// olan satır satır kayıt sunucudan üretilir (dönem ekranda yüklü olandan
// çok daha uzun olabilir).
//
// İPTAL EDİLEN tahsilatlar (VOIDED) gelir dökümüne GİRMEZ: muhasebeye
// gerçekleşmemiş bir gelir bildirmek yanlış olurdu. İzleri denetim
// ekranında durur.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const params = request.nextUrl.searchParams;
    const type = (params.get("type") ?? "income") as ExportType;
    if (!TYPES.includes(type)) return NextResponse.json({ error: "Geçersiz dışa aktarım türü." }, { status: 400 });

    const fromRaw = params.get("from");
    const toRaw = params.get("to");
    const from = fromRaw ? new Date(fromRaw) : null;
    // Bitiş tarihi DAHİL olmalı: kullanıcı "31 Aralık"a kadar dediğinde
    // 31 Aralık'taki kayıtlar da girmeli, bu yüzden ertesi günün başına
    // kadar (exclusive) bakılır.
    const to = toRaw ? new Date(new Date(toRaw).getFullYear(), new Date(toRaw).getMonth(), new Date(toRaw).getDate() + 1) : null;
    if ((fromRaw && Number.isNaN(from?.getTime())) || (toRaw && Number.isNaN(to?.getTime()))) {
      return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
    }
    const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;

    let csv: string;
    let filename: string;

    if (type === "income") {
      const payments = await prisma.payment.findMany({
        where: { institutionId: session.institutionId, status: "COMPLETED", ...(range ? { paidAt: range } : {}) },
        orderBy: { paidAt: "asc" },
        include: {
          student: { select: { firstName: true, lastName: true, studentNumber: true, branch: { select: { name: true } } } },
          installment: { select: { title: true } },
          account: { select: { name: true } },
          recordedByAdmin: { select: { firstName: true, lastName: true } },
        },
      });
      csv = toCsv(
        ["Tarih", "Makbuz No", "Öğrenci No", "Öğrenci", "Şube", "Açıklama", "Ödeme Şekli", "Hesap", "Tutar", "Tahsil Eden"],
        payments.map((p) => [
          csvDate(p.paidAt),
          p.receiptNo ? `${p.paidAt.getFullYear()}-${String(p.receiptNo).padStart(6, "0")}` : "",
          p.student.studentNumber,
          `${p.student.firstName} ${p.student.lastName}`,
          p.student.branch.name,
          p.installment?.title ?? "Serbest tahsilat",
          METHOD_LABEL[p.method] ?? p.method,
          p.account.name,
          csvNumber(Number(p.amount)),
          `${p.recordedByAdmin.firstName} ${p.recordedByAdmin.lastName}`,
        ])
      );
      filename = "gelir-dokumu";
    } else if (type === "expense") {
      const expenses = await prisma.expense.findMany({
        where: { institutionId: session.institutionId, status: "PAID", ...(range ? { paidAt: range } : {}) },
        orderBy: { paidAt: "asc" },
        include: {
          category: { select: { name: true } },
          account: { select: { name: true } },
          recordedByAdmin: { select: { firstName: true, lastName: true } },
        },
      });
      // "Fiş" sütunu mali müşavirin İLK soracağı şeydir: belgesi olmayan
      // gideri ayıklamak için listeyi tek tek açmak zorunda kalmasın.
      csv = toCsv(
        ["Ödeme Tarihi", "Kategori", "Açıklama", "Tedarikçi", "Hesap", "Tutar", "Fiş", "Kaydeden", "Not"],
        expenses.map((e) => [
          csvDate(e.paidAt),
          e.category.name,
          e.title,
          e.vendorName ?? "",
          e.account?.name ?? "",
          csvNumber(Number(e.amount)),
          e.attachmentName ?? "YOK",
          `${e.recordedByAdmin.firstName} ${e.recordedByAdmin.lastName}`,
          e.note ?? "",
        ])
      );
      filename = "gider-dokumu";
    } else {
      // Alacak dökümü: AÇIK taksitler. Tarih aralığı burada VADEYE
      // uygulanır — "şu dönemde vadesi gelen alacaklarım" sorusu için.
      const installments = await prisma.installment.findMany({
        where: {
          institutionId: session.institutionId,
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          ...(range ? { dueDate: range } : {}),
        },
        orderBy: { dueDate: "asc" },
        include: {
          student: { select: { firstName: true, lastName: true, studentNumber: true, branch: { select: { name: true } } } },
          payments: { where: { status: "COMPLETED" }, select: { amount: true } },
        },
      });
      const today = new Date();
      csv = toCsv(
        ["Vade", "Öğrenci No", "Öğrenci", "Şube", "Açıklama", "Tutar", "Ödenen", "Kalan", "Gecikme (gün)"],
        installments.map((i) => {
          const paid = i.payments.reduce((sum, p) => sum + Number(p.amount), 0);
          const overdueDays = i.dueDate < today ? Math.floor((today.getTime() - i.dueDate.getTime()) / 86_400_000) : 0;
          return [
            csvDate(i.dueDate),
            i.student.studentNumber,
            `${i.student.firstName} ${i.student.lastName}`,
            i.student.branch.name,
            i.title,
            csvNumber(Number(i.amount)),
            csvNumber(paid),
            csvNumber(Number(i.amount) - paid),
            String(overdueDays),
          ];
        })
      );
      filename = "alacak-dokumu";
    }

    const stamp = `${fromRaw ?? "baslangic"}_${toRaw ?? "bugun"}`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_export_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/export", handleGet);
