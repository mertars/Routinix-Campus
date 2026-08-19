import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

// 0/O, 1/I/l gibi karışabilecek karakterler bilerek çıkarıldı — kart üzerinde
// elle okunup girilecek bir şifre bu yüzden bu karakter setini kullanır.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// 8 haneli, kriptografik olarak güvenli rastgele geçici şifre üretir.
export function generateTemporaryPassword(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => PASSWORD_CHARS[byte % PASSWORD_CHARS.length]).join("");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
