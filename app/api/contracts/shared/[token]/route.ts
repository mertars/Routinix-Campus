import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/logger";
import { resolveContractToken } from "@/lib/server/contracts/contract-service";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/contracts/shared/[token] — VELİ tarafı, oturum GEREKTİRMEZ.
// Tek kimlik doğrulaması token'dır (bkz. contract-service > resolveContractToken).
async function handleGet(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const resolution = await resolveContractToken(params.token);
    if (!resolution.ok) {
      const message =
        resolution.reason === "EXPIRED"
          ? "Bu sözleşme bağlantısının süresi dolmuş. Lütfen kurumunuzla iletişime geçin."
          : resolution.reason === "CANCELLED"
            ? "Bu sözleşme iptal edilmiş."
            : "Sözleşme bulunamadı.";
      return NextResponse.json({ error: message, reason: resolution.reason }, { status: 404 });
    }

    const c = resolution.contract;
    return NextResponse.json({
      title: c.title,
      content: c.content,
      status: c.status,
      institutionName: c.institution.name,
      studentName: `${c.student.firstName} ${c.student.lastName}`,
      totalAmount: c.totalAmount ? Number(c.totalAmount) : null,
      installmentCount: c.installmentCount,
      signerName: c.signerName,
      signerRelation: c.signerRelation,
      signatureData: c.signatureData,
      signedAt: c.signedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return apiFailure("shared_contract_get_failed", error);
  }
}

export const GET = withApiLogging("GET /api/contracts/shared/[token]", handleGet);
