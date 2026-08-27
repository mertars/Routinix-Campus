import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { AdminCreateError, createStudentAccount, createTeacherAccount } from "@/lib/server/admin/create-user";
import { createBranch } from "@/lib/server/admin/branches";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type RawRow = Record<string, string | undefined>;
type RowResult = {
  rowIndex: number;
  fullName: string;
  status: "success" | "failed";
  username?: string;
  password?: string;
  institutionalCode?: string;
  error?: string;
};

// POST /api/admin/import/bulk — { role: "STUDENT"|"TEACHER", rows: [...] }
// İstemci dry-run önizlemesi sadece kullanıcıya erken geri bildirim içindir;
// güvenlik/doğruluk için TÜM satırlar burada YENİDEN doğrulanır (istemci
// doğrulamasına asla güvenilmez). Her satır BAĞIMSIZ işlenir ("parçalı
// kayıt") — bir satırın başarısız olması diğerlerinin yazılmasını engellemez.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { role, rows } = body as { role?: "STUDENT" | "TEACHER" | "BRANCH"; rows?: RawRow[] };

    if (role !== "STUDENT" && role !== "TEACHER" && role !== "BRANCH") {
      return NextResponse.json({ error: "role 'STUDENT', 'TEACHER' veya 'BRANCH' olmalı." }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows (dizi) zorunludur ve boş olamaz." }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: "Tek seferde en fazla 500 satır işlenebilir." }, { status: 400 });
    }

    if (role === "BRANCH") {
      const seenBranchNames = new Set<string>();
      const results: RowResult[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = (row.name ?? row["Şube Adı"] ?? "").toString().trim();
        try {
          if (!name) throw new AdminCreateError("Şube Adı zorunludur.");
          const key = name.toLocaleLowerCase("tr");
          if (seenBranchNames.has(key)) throw new AdminCreateError("Bu dosya içinde tekrar eden Şube Adı.");
          seenBranchNames.add(key);

          const grade = Number((row.grade ?? row["Sınıf Seviyesi"] ?? "").toString().trim());
          const segment = (row.segment ?? row["Segment"] ?? "").toString().trim().toUpperCase() as "LGS" | "YKS" | "MEZUN";
          const track = (row.track ?? row["Alan/Dal"])?.toString().trim();

          const branch = await createBranch({ institutionId: session.institutionId, actorId: session.sub, name, grade, segment, track });
          results.push({ rowIndex: i, fullName: branch.name, status: "success" });
        } catch (error) {
          seenBranchNames.delete(name.toLocaleLowerCase("tr"));
          const message = error instanceof AdminCreateError ? error.message : "Beklenmeyen hata";
          results.push({ rowIndex: i, fullName: name || `Satır ${i + 1}`, status: "failed", error: message });
        }
      }
      const successCount = results.filter((r) => r.status === "success").length;
      logger.info("admin_bulk_import_completed", { role, total: rows.length, successCount, failedCount: rows.length - successCount });
      return NextResponse.json({ results, successCount, failedCount: rows.length - successCount });
    }

    const branches = await prisma.branch.findMany({ where: { institutionId: session.institutionId }, select: { id: true, name: true } });
    const branchByName = new Map(branches.map((b) => [b.name.trim().toLocaleLowerCase("tr"), b.id]));

    const seenNationalIds = new Set<string>();
    const results: RowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fullName = (row.fullName ?? row["Ad Soyad"] ?? "").toString().trim();
      const nationalId = (row.nationalId ?? row["T.C. No"] ?? "").toString().trim();

      try {
        if (!fullName) throw new AdminCreateError("Ad Soyad zorunludur.");
        if (!/^\d{11}$/.test(nationalId)) throw new AdminCreateError("T.C. No 11 haneli olmalı.");
        if (seenNationalIds.has(nationalId)) throw new AdminCreateError("Bu dosya içinde tekrar eden T.C. No.");
        seenNationalIds.add(nationalId);

        if (role === "STUDENT") {
          const branchName = (row.branchName ?? row["Şube"] ?? "").toString().trim();
          const branchId = branchByName.get(branchName.toLocaleLowerCase("tr"));
          if (!branchId) throw new AdminCreateError(`Şube bulunamadı: "${branchName}".`);
          const phone = (row.phone ?? row["Öğrenci GSM"] ?? "").toString().trim();
          if (!phone) throw new AdminCreateError("Öğrenci GSM zorunludur (kişisel telefonu yoksa veli telefonu girilebilir).");
          const parentName = (row.parentName ?? row["Veli Ad Soyad"] ?? "").toString().trim();
          const parentPhone = (row.parentPhone ?? row["Veli GSM"] ?? "").toString().trim();
          if (!parentName || !parentPhone) throw new AdminCreateError("Veli Ad Soyad ve Veli GSM zorunludur.");

          const account = await createStudentAccount({
            institutionId: session.institutionId,
            actorId: session.sub,
            fullName,
            nationalId,
            branchId,
            phone,
            parentName,
            parentPhone,
            healthNote: (row.healthNote ?? row["Özel Not"])?.toString().trim(),
          });
          results.push({ rowIndex: i, fullName, status: "success", username: account.username, password: account.password });
        } else {
          const subject = (row.subject ?? row["Branş"] ?? "").toString().trim();
          const mobilePhone = (row.mobilePhone ?? row["GSM"] ?? "").toString().trim();
          const advisorBranchName = (row.advisorBranchName ?? row["Danışman Şube"] ?? "").toString().trim();
          const advisorBranchId = advisorBranchName ? branchByName.get(advisorBranchName.toLocaleLowerCase("tr")) : undefined;
          if (!subject) throw new AdminCreateError("Branş zorunludur.");
          if (!mobilePhone) throw new AdminCreateError("GSM zorunludur.");
          if (advisorBranchName && !advisorBranchId) throw new AdminCreateError(`Şube bulunamadı: "${advisorBranchName}".`);

          const account = await createTeacherAccount({
            institutionId: session.institutionId,
            actorId: session.sub,
            fullName,
            nationalId,
            subject,
            mobilePhone,
            email: (row.email ?? row["E-posta"])?.toString().trim(),
            advisorBranchId,
          });
          results.push({ rowIndex: i, fullName, status: "success", username: account.username, password: account.password, institutionalCode: account.institutionalCode });
        }
      } catch (error) {
        seenNationalIds.delete(nationalId);
        const message = error instanceof AdminCreateError ? error.message : "Beklenmeyen hata";
        results.push({ rowIndex: i, fullName: fullName || `Satır ${i + 1}`, status: "failed", error: message });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    logger.info("admin_bulk_import_completed", { role, total: rows.length, successCount, failedCount: rows.length - successCount });

    return NextResponse.json({ results, successCount, failedCount: rows.length - successCount });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_bulk_import_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/import/bulk", handlePost);
