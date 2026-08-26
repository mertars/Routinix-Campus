import bcrypt from "bcryptjs";
import { prisma } from "@/lib/server/prisma";
import type { AuthRole } from "./otp";

// Ortak şifre yardımcıları — her kullanıcı modelinin kendi passwordHash
// alanı olduğu için role göre doğru tabloya yazılır.
//
// * hashPassword          : yeni şifre belirlerken / sıfırlarken kullanılır
// * setAccountPassword    : role göre passwordHash + mustChangePassword günceller
// * verifyAccountPassword : giriş (login) sırasında hash karşılaştırır

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setAccountPassword(
  id: string,
  role: AuthRole,
  passwordHash: string
): Promise<void> {
  switch (role) {
    case "TEACHER":
      await prisma.teacher.update({ where: { id }, data: { passwordHash, mustChangePassword: false } });
      break;
    case "STUDENT":
      await prisma.student.update({ where: { id }, data: { passwordHash, mustChangePassword: false } });
      break;
    case "ADMIN":
      await prisma.admin.update({ where: { id }, data: { passwordHash, mustChangePassword: false } });
      break;
    case "PARENT":
      await prisma.parent.update({ where: { id }, data: { passwordHash, mustChangePassword: false } });
      break;
    default:
      throw new Error(`Bilinmeyen rol: ${role}`);
  }
}