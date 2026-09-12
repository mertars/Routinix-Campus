import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertTeacherTeachesBranch } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const branchId = request.nextUrl.searchParams.get("branchId");
    if (!branchId) return NextResponse.json({ error: "branchId parametresi zorunludur." }, { status: 400 });
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }
    const notes = await prisma.classbookNote.findMany({ where: { branchId } });
    // "Zaman ekle" ile geçmişe dönük eklenmiş bir not, GERÇEK tarihine göre
    // sıralanabilsin diye — noteDate varsa o, yoksa createdAt (eski
    // davranış) — sıralama Prisma'da hesaplanmış bir alan üzerinden
    // yapılamadığından burada elle yapılır.
    notes.sort((a, b) => new Date(b.noteDate ?? b.createdAt).getTime() - new Date(a.noteDate ?? a.createdAt).getTime());
    return NextResponse.json({ notes });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("classbook_notes_list_failed", error);
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const body = await request.json();
    const { branchId, note, noteDate } = body as { branchId?: string; note?: string; noteDate?: string };
    if (!branchId || !note?.trim()) {
      return NextResponse.json({ error: "branchId ve note zorunludur." }, { status: 400 });
    }
    // "Zaman ekle" — öğretmen bu notu GEÇMİŞ bir tarih/saate ait olarak
    // girebilir (kullanıcı talebi). Boş/geçersizse eski davranış AYNEN
    // korunur: sunucu saati (createdAt varsayılanı) kullanılır.
    const parsedNoteDate = noteDate ? new Date(noteDate) : null;
    if (noteDate && (!parsedNoteDate || Number.isNaN(parsedNoteDate.getTime()))) {
      return NextResponse.json({ error: "noteDate geçersiz bir tarih." }, { status: 400 });
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }
    await assertTeacherTeachesBranch(teacherId, branchId);

    const created = await prisma.classbookNote.create({
      data: { teacherId, branchId, note: note.trim(), noteDate: parsedNoteDate },
    });
    return NextResponse.json({ note: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("classbook_note_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/classbook-notes", handleGet);
export const POST = withApiLogging("POST /api/classbook-notes", handlePost);
