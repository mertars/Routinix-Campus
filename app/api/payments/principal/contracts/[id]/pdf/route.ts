import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { PdfStudentContract } from "@/components/pdf/pdf-student-contract";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/contracts/[id]/pdf — sözleşmenin PDF çıktısı.
// İmzalanmışsa velinin imza görseli ve künyesi belgeye basılır.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const contract = await prisma.studentContract.findUnique({
      where: { id: params.id },
      include: {
        student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } },
        institution: { select: { name: true, logoUrl: true } },
      },
    });
    if (!contract) return NextResponse.json({ error: "Sözleşme bulunamadı." }, { status: 404 });
    requireInstitution(session, contract.institutionId);

    const buffer = await renderToBuffer(
      PdfStudentContract({
        institutionName: contract.institution.name,
        logoUrl: contract.institution.logoUrl,
        title: contract.title,
        content: contract.content,
        studentName: `${contract.student.firstName} ${contract.student.lastName}`,
        branchName: contract.student.branch.name,
        totalAmount: contract.totalAmount ? Number(contract.totalAmount).toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }) : null,
        installmentCount: contract.installmentCount,
        createdAt: contract.createdAt.toLocaleDateString("tr-TR"),
        signerName: contract.signerName,
        signerRelation: contract.signerRelation,
        signatureData: contract.signatureData,
        signedAt: contract.signedAt ? contract.signedAt.toLocaleDateString("tr-TR") : null,
      })
    );

    const safeName = `${contract.student.firstName}-${contract.student.lastName}-sozlesme`.replace(/[^\w\sğüşöçıİĞÜŞÖÇ-]/gi, "");
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(safeName)}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("contract_pdf_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/contracts/[id]/pdf", handleGet);
