import type { ImportRole, RawRow, ValidatedRow } from "./types";

function pick(row: RawRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    // Excel, "T.C. No"/"Sınıf Seviyesi" gibi rakamsal hücreleri elle Metin'e
    // çevrilmemişse JS number olarak döner — String() olmadan .trim() çöker.
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return "";
}

// Sunucudaki (app/api/admin/import/bulk) doğrulamanın istemci tarafı aynası
// — kullanıcıya yazmadan ÖNCE anında geri bildirim verir. Nihai/yetkili
// doğrulama her zaman sunucudadır (T.C./öğrenci no çakışması gibi DB'ye
// bakması gereken kontroller burada yapılamaz, sadece biçim kontrolü yapılır).
const VALID_SEGMENTS = new Set(["LGS", "YKS", "MEZUN"]);

export function validateRows(role: ImportRole, rawRows: RawRow[], branchNames: string[]): ValidatedRow[] {
  const branchNameSet = new Set(branchNames.map((n) => n.toLocaleLowerCase("tr")));
  const seenNationalIds = new Set<string>();
  const seenBranchNames = new Set<string>();

  if (role === "BRANCH") {
    return rawRows.map((raw, rowIndex) => {
      const errors: string[] = [];
      const branchName = pick(raw, "name", "Şube Adı");
      const gradeRaw = pick(raw, "grade", "Sınıf Seviyesi");
      const segmentRaw = pick(raw, "segment", "Segment").toUpperCase();
      const grade = Number(gradeRaw);

      if (!branchName) errors.push("Şube Adı zorunludur.");
      else {
        const key = branchName.toLocaleLowerCase("tr");
        if (branchNameSet.has(key)) errors.push(`Bu isimde bir şube zaten var: "${branchName}".`);
        else if (seenBranchNames.has(key)) errors.push("Bu dosya içinde tekrar eden Şube Adı.");
        else seenBranchNames.add(key);
      }
      if (!gradeRaw || !Number.isInteger(grade) || grade < 5 || grade > 12) errors.push("Sınıf Seviyesi 5-12 arasında bir tam sayı olmalı.");
      if (!VALID_SEGMENTS.has(segmentRaw)) errors.push('Segment "LGS", "YKS" veya "MEZUN" olmalı.');

      return { rowIndex, raw, fullName: branchName, nationalId: "", isValid: errors.length === 0, errors };
    });
  }

  return rawRows.map((raw, rowIndex) => {
    const errors: string[] = [];
    const fullName = pick(raw, "fullName", "Ad Soyad");
    const nationalId = pick(raw, "nationalId", "T.C. No");

    if (!fullName) errors.push("Ad Soyad zorunludur.");
    else if (fullName.trim().split(/\s+/).length < 2) errors.push("Ad ve soyadı birlikte girin.");

    if (!/^\d{11}$/.test(nationalId)) errors.push("T.C. No 11 haneli olmalı.");
    else if (seenNationalIds.has(nationalId)) errors.push("Bu dosya içinde tekrar eden T.C. No.");
    else seenNationalIds.add(nationalId);

    if (role === "STUDENT") {
      const branchName = pick(raw, "branchName", "Şube");
      const phone = pick(raw, "phone", "Öğrenci GSM");
      const parentName = pick(raw, "parentName", "Veli Ad Soyad");
      const parentPhone = pick(raw, "parentPhone", "Veli GSM");
      if (!branchName) errors.push("Şube zorunludur.");
      else if (!branchNameSet.has(branchName.toLocaleLowerCase("tr"))) errors.push(`Şube bulunamadı: "${branchName}".`);
      if (!phone) errors.push("Öğrenci GSM zorunludur (veli numarası da girilebilir).");
      if (!parentName) errors.push("Veli Ad Soyad zorunludur.");
      if (!parentPhone) errors.push("Veli GSM zorunludur.");
    } else {
      const subject = pick(raw, "subject", "Branş");
      const mobilePhone = pick(raw, "mobilePhone", "GSM");
      const advisorBranchName = pick(raw, "advisorBranchName", "Danışman Şube");
      if (!subject) errors.push("Branş zorunludur.");
      if (!mobilePhone) errors.push("GSM zorunludur.");
      if (advisorBranchName && !branchNameSet.has(advisorBranchName.toLocaleLowerCase("tr"))) {
        errors.push(`Şube bulunamadı: "${advisorBranchName}".`);
      }
    }

    return { rowIndex, raw, fullName, nationalId, isValid: errors.length === 0, errors };
  });
}
