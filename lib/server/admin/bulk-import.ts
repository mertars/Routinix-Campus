import { prisma } from "@/lib/server/prisma";
import { AdminCreateError, createStudentAccount, createTeacherAccount } from "@/lib/server/admin/create-user";
import { createBranch } from "@/lib/server/admin/branches";

// app/api/admin/import/bulk (kurum yöneticisi, kendi kurumu) VE
// app/api/platform/institutions/[id]/import/bulk (platform sahibi, SEÇTİĞİ
// herhangi bir kurum — bkz. o route'taki yetki notu) AYNI mantığı paylaşır.
// institutionId/actorId çağırana göre değişir (biri session'dan, diğeri
// platform oturumu + URL parametresinden gelir) — mantığın kendisi
// institution-agnostic'tir, bu yüzden buraya çıkarıldı.
export type RawRow = Record<string, string | undefined>;
export type BulkImportRole = "STUDENT" | "TEACHER" | "BRANCH";
type RowResult = {
  rowIndex: number;
  fullName: string;
  status: "success" | "failed";
  username?: string;
  password?: string;
  institutionalCode?: string;
  error?: string;
};

export async function runBulkImport(
  role: BulkImportRole,
  rows: RawRow[],
  institutionId: string,
  actorId: string
): Promise<{ results: RowResult[]; successCount: number; failedCount: number }> {
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

        const branch = await createBranch({ institutionId, actorId, name, grade, segment, track });
        results.push({ rowIndex: i, fullName: branch.name, status: "success" });
      } catch (error) {
        seenBranchNames.delete(name.toLocaleLowerCase("tr"));
        const message = error instanceof AdminCreateError ? error.message : "Beklenmeyen hata";
        results.push({ rowIndex: i, fullName: name || `Satır ${i + 1}`, status: "failed", error: message });
      }
    }
    const successCount = results.filter((r) => r.status === "success").length;
    return { results, successCount, failedCount: rows.length - successCount };
  }

  const branches = await prisma.branch.findMany({ where: { institutionId }, select: { id: true, name: true } });
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
          institutionId,
          actorId,
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
          institutionId,
          actorId,
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
  return { results, successCount, failedCount: rows.length - successCount };
}
