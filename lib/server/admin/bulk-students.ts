import { prisma } from "@/lib/server/prisma";
import { generateTemporaryPassword, hashPassword } from "@/lib/server/auth/generate-credentials";
import { generatePrefixedId } from "@/lib/server/ids";
import { splitFullName } from "@/lib/server/admin/create-user";
import { normalizePhone } from "@/lib/server/auth/otp";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { currentAcademicYear } from "@/lib/payments/academic-year";
import { defaultEndDate } from "@/lib/server/enrollment/enrollment-service";

export type StudentImportRow = {
  fullName: string;
  nationalId: string;
  branchName: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  healthNote?: string;
  /** Dosyadaki "SMS İzni" sütunu — yoksa kapalı sayılır. */
  parentSmsConsent?: boolean;
};

export type StudentImportResult = {
  rowIndex: number;
  fullName: string;
  status: "success" | "failed";
  username?: string;
  password?: string;
  phone?: string;
  error?: string;
};

// Telefon benzersizliği tek seferde kaç numara sorulsun. Postgres uzun
// OR listelerini kaldırır ama sorguyu sonsuza kadar büyütmek de doğru
// değil; 100 makul bir orta yol.
const PHONE_CHUNK = 100;

// Toplu öğrenci içe aktarımının HIZLI yolu.
//
// Tekil createStudentAccount() öğrenci BAŞINA ~7 veritabanı gidiş
// dönüşü yapıyordu (şube, TC kontrolü, öğrenci no üretimi, öğrenci
// yaratma, veli arama, veli telefonu benzersizliği için 4 tablo taraması,
// bağ kaydı). 100 öğrenci ≈ 700 tur ≈ 100 saniye — üstelik öğrenci no
// üretimi her seferinde o kurumun TÜM öğrencilerini çekiyordu (O(n²)).
//
// Bu yol aynı kuralları uygular ama SORGULARI TOPLULAŞTIRIR: veri bir
// kez okunur, doğrulama bellekte yapılır, yazma toplu komutlarla
// yapılır. Sonuç ~700 tur yerine ~10 tur.
//
// ⚠️ Tekil yol SİLİNMEDİ: "Kullanıcı Ekle" modalı hâlâ onu kullanıyor.
// Kurallar iki yerde de aynı olmalı; buradaki her doğrulama
// create-user.ts'teki karşılığıyla eşleşir.
export async function bulkCreateStudents(
  rows: StudentImportRow[],
  institutionId: string,
  actorId: string
): Promise<{ results: StudentImportResult[]; successCount: number; failedCount: number }> {
  const results: StudentImportResult[] = new Array(rows.length);

  // --- 1) Ortak veriyi TEK SEFERDE oku ---
  const nationalIds = rows.map((r) => r.nationalId?.trim()).filter(Boolean) as string[];
  const parentPhones = [...new Set(rows.map((r) => r.parentPhone?.trim()).filter(Boolean) as string[])];
  const parentDigits = [...new Set(parentPhones.map(normalizePhone).filter((d) => d.length >= 10))];

  const [branches, takenNationalIds, existingParents, maxRow] = await Promise.all([
    prisma.branch.findMany({ where: { institutionId }, select: { id: true, name: true } }),
    prisma.student.findMany({ where: { nationalId: { in: nationalIds } }, select: { nationalId: true } }),
    prisma.parent.findMany({
      where: { institutionId, mobilePhone: { in: parentPhones } },
      select: { id: true, mobilePhone: true },
    }),
    prisma.student.findFirst({
      where: { institutionId, studentNumber: { startsWith: `${new Date().getFullYear()}-` } },
      orderBy: { studentNumber: "desc" },
      select: { studentNumber: true },
    }),
  ]);

  // Yeni veli açılacaksa numara SİSTEMDE (her kurum, her rol) başka bir
  // hesaba ait olmamalı — tekil yoldaki findAccountByPhone kuralının
  // toplulaştırılmış hali.
  const takenPhoneDigits = await collectTakenPhones(parentDigits);

  const branchByName = new Map(branches.map((b) => [b.name.trim().toLocaleLowerCase("tr"), b.id]));
  const takenIds = new Set(takenNationalIds.map((s) => s.nationalId));
  const parentIdByPhone = new Map(existingParents.map((p) => [p.mobilePhone, p.id]));

  const year = new Date().getFullYear();
  const lastSeq = maxRow?.studentNumber ? Number(maxRow.studentNumber.slice(`${year}-`.length)) : 0;
  let nextSeq = Math.max(Number.isFinite(lastSeq) ? lastSeq : 0, 1000);

  // --- 2) Bellekte doğrula ---
  const seenNationalIds = new Set<string>();
  type Prepared = {
    rowIndex: number;
    id: string;
    fullName: string;
    nationalId: string;
    branchId: string;
    phone: string;
    healthNote: string | null;
    studentNumber: string;
    password: string;
    parentPhone: string;
    parentName: string;
    parentSmsConsent: boolean;
  };
  const prepared: Prepared[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = (row.fullName ?? "").trim();
    const nationalId = (row.nationalId ?? "").trim();
    const fail = (error: string) => {
      results[i] = { rowIndex: i, fullName: fullName || `Satır ${i + 1}`, status: "failed", error };
    };

    if (!fullName) { fail("Ad Soyad zorunludur."); continue; }
    if (!/^\d{11}$/.test(nationalId)) { fail("T.C. No 11 haneli olmalı."); continue; }
    if (seenNationalIds.has(nationalId)) { fail("Bu dosya içinde tekrar eden T.C. No."); continue; }
    if (takenIds.has(nationalId)) { fail("Bu T.C. No ile kayıtlı bir öğrenci zaten var."); continue; }

    const branchId = branchByName.get((row.branchName ?? "").trim().toLocaleLowerCase("tr"));
    if (!branchId) { fail(`Şube bulunamadı: "${(row.branchName ?? "").trim()}".`); continue; }

    const phone = (row.phone ?? "").trim();
    if (!phone) { fail("Öğrenci GSM zorunludur (kişisel telefonu yoksa veli telefonu girilebilir)."); continue; }

    const parentName = (row.parentName ?? "").trim();
    const parentPhone = (row.parentPhone ?? "").trim();
    if (!parentName || !parentPhone) { fail("Veli Ad Soyad ve Veli GSM zorunludur."); continue; }

    // Veli bu kurumda YOKSA yeni açılacak demektir; o zaman numara
    // sistemde başka bir hesaba ait olmamalı.
    if (!parentIdByPhone.has(parentPhone) && takenPhoneDigits.has(normalizePhone(parentPhone))) {
      fail("Veli telefonu başka bir hesaba (öğrenci/öğretmen/yönetici/veli) ait.");
      continue;
    }

    seenNationalIds.add(nationalId);
    nextSeq += 1;
    prepared.push({
      rowIndex: i,
      id: generatePrefixedId("std"),
      fullName,
      nationalId,
      branchId,
      phone,
      healthNote: row.healthNote?.trim() || null,
      studentNumber: `${year}-${nextSeq}`,
      password: generateTemporaryPassword(),
      parentPhone,
      parentName,
      parentSmsConsent: row.parentSmsConsent ?? false,
    });
  }

  if (prepared.length === 0) {
    return { results: fillGaps(results, rows), successCount: 0, failedCount: rows.length };
  }

  // --- 3) Şifreleri paralel hashle (bcrypt en pahalı adım) ---
  const hashes = await Promise.all(prepared.map((p) => hashPassword(p.password)));

  // --- 4) Eksik velileri TEK komutta aç ---
  const newParentPhones = [...new Set(prepared.map((p) => p.parentPhone))].filter((ph) => !parentIdByPhone.has(ph));
  if (newParentPhones.length > 0) {
    const nameByPhone = new Map(prepared.map((p) => [p.parentPhone, p.parentName]));
    const consentByPhone = new Map(prepared.map((p) => [p.parentPhone, p.parentSmsConsent ?? false]));
    const created = await prisma.parent.createManyAndReturn({
      data: newParentPhones.map((ph) => {
        const { firstName, lastName } = splitFullName(nameByPhone.get(ph) ?? "Veli");
        return {
          id: generatePrefixedId("prt"),
          institutionId,
          firstName,
          lastName: lastName || "Veli",
          relationship: "GUARDIAN" as const,
          mobilePhone: ph,
          // Dosyada "SMS İzni" sütunu varsa oradan; yoksa kapalı
          // (bkz. create-user.ts'teki aynı gerekçe).
          smsConsent: consentByPhone.get(ph) ?? false,
        };
      }),
      select: { id: true, mobilePhone: true },
    });
    for (const p of created) parentIdByPhone.set(p.mobilePhone, p.id);
  }

  // --- 5) Öğrencileri ve veli bağlarını toplu yaz ---
  await prisma.student.createMany({
    data: prepared.map((p, i) => ({
      id: p.id,
      institutionId,
      nationalId: p.nationalId,
      firstName: splitFullName(p.fullName).firstName,
      lastName: splitFullName(p.fullName).lastName,
      studentNumber: p.studentNumber,
      branchId: p.branchId,
      phone: p.phone,
      healthNote: p.healthNote,
      passwordHash: hashes[i],
    })),
  });

  await prisma.parentStudent.createMany({
    data: prepared
      .map((p) => ({ parentId: parentIdByPhone.get(p.parentPhone)!, studentId: p.id }))
      .filter((l) => Boolean(l.parentId)),
    skipDuplicates: true,
  });

  // --- 6) Kayıt dönemi ---
  //
  // Tekil kayıt yolu bunu açıyordu ama TOPLU yol açmıyordu; oysa yeni
  // bir kurum öğrencilerini tam olarak buradan yüklüyor. Sonuç: sıfırdan
  // kurulan her kurum, 100 öğrencisinin hiçbirinin kayıt dönemi olmadan
  // başlıyor — yenileme listesi kalıcı olarak boş kalıyordu. (Yeniden
  // testte ölçüldü: 100 öğrencinin 99'unda kayıt dönemi yoktu.)
  //
  // Ücret BİLİNMEZ: toplu aktarma dosyasında ücret sütunu yok, plan
  // ayrıca kuruluyor. Dönem kaydı bu yüzden tutarsız değil, sadece
  // ücretsiz açılır — müdür yenilerken girer.
  const academicYear = currentAcademicYear();
  await prisma.studentEnrollment.createMany({
    data: prepared.map((p) => ({
      institutionId,
      studentId: p.id,
      academicYear,
      startDate: new Date(),
      endDate: defaultEndDate(academicYear),
      createdByAdminId: actorId,
    })),
    skipDuplicates: true,
  });

  for (const p of prepared) {
    results[p.rowIndex] = {
      rowIndex: p.rowIndex,
      fullName: p.fullName,
      status: "success",
      username: p.studentNumber,
      password: p.password,
      phone: p.phone,
    };
  }

  // Denetim izi öğrenci başına DEĞİL, içe aktarım başına tek kayıt:
  // 100 satırlık bir aktarımda 100 ayrı "kullanıcı oluşturuldu" kaydı
  // izi okunmaz hale getirirdi.
  await recordAuditLog({
    institutionId,
    actorId,
    actorRole: "ADMIN",
    action: "USER_CREATED",
    targetType: "StudentBulkImport",
    targetId: institutionId,
    metadata: { created: prepared.length, failed: rows.length - prepared.length },
  });

  const final = fillGaps(results, rows);
  const successCount = final.filter((r) => r.status === "success").length;
  return { results: final, successCount, failedCount: final.length - successCount };
}

function fillGaps(results: StudentImportResult[], rows: StudentImportRow[]): StudentImportResult[] {
  for (let i = 0; i < rows.length; i++) {
    if (!results[i]) {
      results[i] = { rowIndex: i, fullName: (rows[i].fullName ?? "").trim() || `Satır ${i + 1}`, status: "failed", error: "Bilinmeyen hata" };
    }
  }
  return results;
}

// Verilen telefon eklerinin HERHANGİ bir hesaba ait olup olmadığını
// dört tabloyu toplu tarayarak bulur. Tekil yolda bu kontrol satır
// başına 4 sorgu demekti (100 öğrencide 400 sorgu).
async function collectTakenPhones(digits: string[]): Promise<Set<string>> {
  const taken = new Set<string>();
  if (digits.length === 0) return taken;

  for (let i = 0; i < digits.length; i += PHONE_CHUNK) {
    const chunk = digits.slice(i, i + PHONE_CHUNK);
    const [teachers, students, admins, parents] = await Promise.all([
      prisma.teacher.findMany({ where: { OR: chunk.map((d) => ({ mobilePhone: { endsWith: d } })) }, select: { mobilePhone: true } }),
      prisma.student.findMany({ where: { OR: chunk.map((d) => ({ phone: { endsWith: d } })) }, select: { phone: true } }),
      prisma.admin.findMany({ where: { OR: chunk.map((d) => ({ institutionalMobile: { endsWith: d } })) }, select: { institutionalMobile: true } }),
      prisma.parent.findMany({ where: { OR: chunk.map((d) => ({ mobilePhone: { endsWith: d } })) }, select: { mobilePhone: true } }),
    ]);
    for (const p of [...teachers.map((t) => t.mobilePhone), ...students.map((s) => s.phone), ...admins.map((a) => a.institutionalMobile), ...parents.map((p) => p.mobilePhone)]) {
      if (p) taken.add(normalizePhone(p));
    }
  }
  return taken;
}
