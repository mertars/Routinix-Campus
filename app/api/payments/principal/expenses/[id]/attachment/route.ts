import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { apiFailure } from "@/lib/server/api-failure";
import {
  saveExpenseAttachment,
  deleteExpenseAttachment,
  isAllowedAttachment,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
} from "@/lib/server/uploads/save-expense-attachment";

export const dynamic = "force-dynamic";

// POST — multipart/form-data: file
// Gider kaydına fiş/fatura ekler. Var olan ek DEĞİŞTİRİLİR (eskisi
// diskten silinir) — bir giderin tek bir belgesi olur.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      select: { institutionId: true, attachmentUrl: true },
    });
    if (!expense) return NextResponse.json({ error: "Gider bulunamadı." }, { status: 404 });
    requireInstitution(session, expense.institutionId);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Dosya gönderilmedi." }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "Dosya boş." }, { status: 400 });
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `Dosya çok büyük (en fazla ${formatFileSize(MAX_ATTACHMENT_BYTES)}).` },
        { status: 400 }
      );
    }
    if (!isAllowedAttachment(file.name)) {
      return NextResponse.json({ error: "Yalnızca fotoğraf (JPG/PNG/WEBP/HEIC) veya PDF yükleyebilirsiniz." }, { status: 400 });
    }

    const saved = await saveExpenseAttachment(file);
    await prisma.expense.update({
      where: { id: params.id },
      data: { attachmentUrl: saved.url, attachmentName: saved.name },
    });
    // Yeni ek KAYDEDİLDİKTEN sonra eskisi silinir; ters sırada bir hata
    // giderin belgesiz kalmasına yol açardı.
    await deleteExpenseAttachment(expense.attachmentUrl);

    return NextResponse.json({ url: saved.url, name: saved.name, sizeLabel: saved.sizeLabel }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("expense_attachment_upload_failed", error);
  }
}

// DELETE — eki kaldırır.
async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      select: { institutionId: true, attachmentUrl: true },
    });
    if (!expense) return NextResponse.json({ error: "Gider bulunamadı." }, { status: 404 });
    requireInstitution(session, expense.institutionId);

    await prisma.expense.update({ where: { id: params.id }, data: { attachmentUrl: null, attachmentName: null } });
    await deleteExpenseAttachment(expense.attachmentUrl);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("expense_attachment_delete_failed", error);
  }
}

export const POST = withApiLogging("POST /api/payments/principal/expenses/[id]/attachment", handlePost);
export const DELETE = withApiLogging("DELETE /api/payments/principal/expenses/[id]/attachment", handleDelete);
