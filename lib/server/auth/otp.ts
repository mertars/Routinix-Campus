import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/server/prisma";

// ----------------------------------------------------------------------------
// Tek kullanımlık şifre (OTP) yardımcıları — telefon bazlı ilk giriş ve şifre
// sıfırlama akışlarında kullanılır (bkz. prisma/schema.prisma > OtpCode).
// Kod düz metin saklanmaz; bcrypt hash'i tutulur.
// ----------------------------------------------------------------------------

export type AuthRole = "STUDENT" | "TEACHER" | "ADMIN" | "PARENT";

// Kullanıcının girdiği telefonu, veritabanındaki telefonlarla eşleşebilecek
// sadeleştirilmiş bir biçime indirger. "+90 555 000 00 01", "05550000001" ve
// "5550000001" girdilerinin hepsi "5550000001" olarak normalize edilir.
export function normalizePhone(phone: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

// 6 haneli, kriptografik olarak güvenli rastgele OTP.
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// OTP için daha hızlı bir bcrypt maliyeti (10 yerine 6) yeterlidir — kod 6
// haneli ve 5 dakika ömürlü olduğundan brute-force yüzeyi çok küçüktür.
export async function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, 6);
}

export async function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

// Telefon numarasına göre giriş yapılabilecek hesabı bulur. Rol sıralaması
// önemlidir: aynı numara teorik olarak birden fazla tipte olamaz ama
// deterministik olması için Teacher -> Student -> Admin -> Parent önceliği
// kullanılır. phone alanı her modelde farklı isimlendirildiği için (mobilePhone,
// phone, institutionalMobile) ayrı ayrı sorgulanır.
export type FoundAccount = {
  id: string;
  role: AuthRole;
  phone: string;
  name: string;
  passwordHash: string | null;
  mustChangePassword: boolean;
  institutionId: string;
};

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

export async function findAccountByPhone(phone: string): Promise<FoundAccount | null> {
  const digits = normalizePhone(phone);
  if (digits.length < 10) return null;

  // Askıya alınmış (isActive=false) bir kuruma ait hesaplar telefonla dahi
  // "bulunamaz" — statik JWT'si hâlâ geçerli olan biri için ayrıca
  // requireSession() de aynı kontrolü tekrarlar (bkz. session-guard.ts).
  const activeInstitution = { institution: { isActive: true } };

  const teacher = await prisma.teacher.findFirst({ where: { mobilePhone: { endsWith: digits }, ...activeInstitution } });
  if (teacher) {
    return {
      id: teacher.id,
      role: "TEACHER",
      phone: teacher.mobilePhone,
      name: fullName(teacher.firstName, teacher.lastName),
      passwordHash: teacher.passwordHash,
      mustChangePassword: teacher.mustChangePassword,
      institutionId: teacher.institutionId,
    };
  }

  const student = await prisma.student.findFirst({ where: { phone: { endsWith: digits }, ...activeInstitution } });
  if (student) {
    return {
      id: student.id,
      role: "STUDENT",
      phone: student.phone ?? phone,
      name: fullName(student.firstName, student.lastName),
      passwordHash: student.passwordHash,
      mustChangePassword: student.mustChangePassword,
      institutionId: student.institutionId,
    };
  }

  const admin = await prisma.admin.findFirst({ where: { institutionalMobile: { endsWith: digits }, ...activeInstitution } });
  if (admin) {
    return {
      id: admin.id,
      role: "ADMIN",
      phone: admin.institutionalMobile,
      name: fullName(admin.firstName, admin.lastName),
      passwordHash: admin.passwordHash,
      mustChangePassword: admin.mustChangePassword,
      institutionId: admin.institutionId,
    };
  }

  const parent = await prisma.parent.findFirst({ where: { mobilePhone: { endsWith: digits }, ...activeInstitution } });
  if (parent) {
    return {
      id: parent.id,
      role: "PARENT",
      phone: parent.mobilePhone,
      name: fullName(parent.firstName, parent.lastName),
      passwordHash: parent.passwordHash,
      mustChangePassword: parent.mustChangePassword,
      institutionId: parent.institutionId,
    };
  }

  return null;
}