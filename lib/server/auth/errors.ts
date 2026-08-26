import { NextResponse } from "next/server";

// Auth route'ları (send-otp, verify-otp, set-password, login) arasında paylaşılan
// tek hata tipi — her route'un kendi XError alt sınıfını tekrar tanımlamasını önler.
// session-guard.ts'teki requireSession/requireRole/requireInstitution/assertOwnsSelf
// vb. de AYNI sınıfı fırlatır — böylece TÜM route'lar (auth + korumalı API'ler)
// tek bir catch deseniyle yanıt üretebilir (bkz. authErrorResponse altta).
export class AuthError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Korumalı bir route'un catch bloğunda tek satırla kullanılır:
//   catch (error) { return authErrorResponse(error); }
// AuthError değilse 500 döner ve loglanmaz (loglama çağıranın withApiLogging
// sarmalayıcısının işidir — burada sadece yanıt şekli standardize edilir).
export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
}
