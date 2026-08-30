import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { PdfCredentialsList, type PdfCredentialRow } from "@/components/pdf/pdf-credentials-list";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/admin/users/credentials-pdf — { role, credentials } — Toplu
// İçe Aktarma Sihirbazı'nın (bkz. bulk-import-wizard.tsx) yeni oluşturulan
// hesapların GEÇİCİ şifrelerini içeren, bir kez indirilen listesi. Bu
// şifreler zaten çağıran tarafın kendi state'inde açık metin bulunuyor
// (hesaplar az önce sunucuda oluşturuldu) — burada kalıcı bir yere
// yazılmaz, sadece PDF'e basılıp döndürülür.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { role, credentials } = body as { role?: "STUDENT" | "TEACHER"; credentials?: PdfCredentialRow[] };
    if (role !== "STUDENT" && role !== "TEACHER") {
      return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }
    if (!Array.isArray(credentials) || credentials.length === 0) {
      return NextResponse.json({ error: "credentials en az bir kayıt içermeli." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfCredentialsList
        institutionName={institution?.name ?? ""}
        role={role}
        credentials={credentials}
        generatedAtLabel={new Date().toLocaleDateString("tr-TR")}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="giris-bilgileri.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("credentials_pdf_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/users/credentials-pdf", handlePost);
