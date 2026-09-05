import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/optical-formats — kurumun tanımladığı optik formatlarının
// listesi (bkz. components/olcme/optical-format-manager.tsx). Bir sınava
// değil KURUMA bağlıdır — aynı tarayıcı/format birden çok denemede
// tekrar kullanılır.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const formats = await prisma.opticalFormat.findMany({
      where: { institutionId: session.institutionId },
      include: { subjectBlocks: { orderBy: { subject: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ formats });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("optical_formats_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

type FieldInput = { start: number; length: number } | null;

function parseField(raw: unknown): FieldInput {
  const start = Number(raw && typeof raw === "object" ? (raw as Record<string, unknown>).start : undefined);
  const length = Number(raw && typeof raw === "object" ? (raw as Record<string, unknown>).length : undefined);
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 1 || length < 1) return null;
  return { start, length };
}

// POST /api/optical-formats — { name, tcNo?, studentNo?, booklet?, grade?,
// branch?, name (alan tanımı, isim çakışmasın diye body'de `nameField`),
// subjectBlocks: [{subject, start, length}] }. En az T.C. No YA DA
// ad-soyad alanlarından biri tanımlı olmalı (yoksa hiçbir satır
// öğrenciyle eşleşemez).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Format adı zorunludur." }, { status: 400 });

    const tcNo = parseField(body?.tcNo);
    const nameField = parseField(body?.nameField);
    if (!tcNo && !nameField) {
      return NextResponse.json({ error: "T.C. No veya Ad Soyad alanlarından en az biri tanımlanmalı (öğrenci eşleştirmesi için)." }, { status: 400 });
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

    const format = await prisma.opticalFormat.create({
      data: {
        institutionId: session.institutionId,
        name,
        tcNoStart: tcNo?.start ?? null,
        tcNoLength: tcNo?.length ?? null,
        studentNoStart: parseField(body?.studentNo)?.start ?? null,
        studentNoLength: parseField(body?.studentNo)?.length ?? null,
        bookletStart: parseField(body?.booklet)?.start ?? null,
        bookletLength: parseField(body?.booklet)?.length ?? null,
        gradeStart: parseField(body?.grade)?.start ?? null,
        gradeLength: parseField(body?.grade)?.length ?? null,
        branchStart: parseField(body?.branch)?.start ?? null,
        branchLength: parseField(body?.branch)?.length ?? null,
        nameStart: nameField?.start ?? null,
        nameLength: nameField?.length ?? null,
        subjectBlocks: { createMany: { data: subjectBlocks } },
      },
      include: { subjectBlocks: true },
    });

    return NextResponse.json({ format });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Bu isimde bir optik format zaten var." }, { status: 409 });
    }
    logger.error("optical_formats_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/optical-formats", handleGet);
export const POST = withApiLogging("POST /api/optical-formats", handlePost);
