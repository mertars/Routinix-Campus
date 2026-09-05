import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type FieldInput = { start: number; length: number } | null;

function parseField(raw: unknown): FieldInput {
  const start = Number(raw && typeof raw === "object" ? (raw as Record<string, unknown>).start : undefined);
  const length = Number(raw && typeof raw === "object" ? (raw as Record<string, unknown>).length : undefined);
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 1 || length < 1) return null;
  return { start, length };
}

// PUT /api/optical-formats/[id] — POST ile aynı gövde şekli, tüm alanları
// ve ders bloklarını (sil+yeniden oluştur) DEĞİŞTİRİR.
async function handlePut(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const existing = await prisma.opticalFormat.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Format bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Format adı zorunludur." }, { status: 400 });

    const tcNo = parseField(body?.tcNo);
    const nameField = parseField(body?.nameField);
    if (!tcNo && !nameField) {
      return NextResponse.json({ error: "T.C. No veya Ad Soyad alanlarından en az biri tanımlanmalı." }, { status: 400 });
    }

    const subjectBlocksRaw = Array.isArray(body?.subjectBlocks) ? body.subjectBlocks : [];
    const subjectBlocks = subjectBlocksRaw
      .map((b: unknown) => {
        const subject = typeof (b as Record<string, unknown>)?.subject === "string" ? ((b as Record<string, unknown>).subject as string).trim() : "";
        const field = parseField(b);
        if (!subject || !field) return null;
        return { subject, start: field.start, length: field.length };
      })
      .filter((b: unknown): b is { subject: string; start: number; length: number } => b !== null);

    const studentNo = parseField(body?.studentNo);
    const booklet = parseField(body?.booklet);
    const grade = parseField(body?.grade);
    const branch = parseField(body?.branch);

    const format = await prisma.$transaction(async (tx) => {
      await tx.opticalSubjectBlock.deleteMany({ where: { formatId: params.id } });
      return tx.opticalFormat.update({
        where: { id: params.id },
        data: {
          name,
          tcNoStart: tcNo?.start ?? null,
          tcNoLength: tcNo?.length ?? null,
          studentNoStart: studentNo?.start ?? null,
          studentNoLength: studentNo?.length ?? null,
          bookletStart: booklet?.start ?? null,
          bookletLength: booklet?.length ?? null,
          gradeStart: grade?.start ?? null,
          gradeLength: grade?.length ?? null,
          branchStart: branch?.start ?? null,
          branchLength: branch?.length ?? null,
          nameStart: nameField?.start ?? null,
          nameLength: nameField?.length ?? null,
          subjectBlocks: { createMany: { data: subjectBlocks } },
        },
        include: { subjectBlocks: true },
      });
    });

    return NextResponse.json({ format });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Bu isimde bir optik format zaten var." }, { status: 409 });
    }
    logger.error("optical_formats_update_failed", { formatId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handleDelete(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const existing = await prisma.opticalFormat.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Format bulunamadı." }, { status: 404 });

    await prisma.opticalFormat.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("optical_formats_delete_failed", { formatId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PUT = withApiLogging("PUT /api/optical-formats/[id]", handlePut);
export const DELETE = withApiLogging("DELETE /api/optical-formats/[id]", handleDelete);
