import type { SmsProvider, SmsSendResult } from "../types";

// Endpoint (sms/send/get) ve alan adları (usercode/password/gsmno/msgheader/
// message, "00" ile başlayan başarı kodu) genel NetGSM dokümantasyonu ve
// yaygın kullanılan istemci kütüphaneleriyle çapraz doğrulandı. `gsmno`
// alanı 10 haneli, başında "0"/"90" OLMAYAN yerel formatı bekler — bu proje
// zaten normalizePhone() ile bu formatı üretiyor (bkz. lib/server/auth/otp.ts),
// ekstra bir dönüşüm gerekmez. `header` (msgheader) NetGSM panelinde
// ONAYLANMIŞ bir gönderici başlığı olmalı, aksi halde istek "00" dışında bir
// hata koduyla döner.
export class NetGsmProvider implements SmsProvider {
  readonly name = "netgsm";

  constructor(
    private readonly usercode: string,
    private readonly password: string,
    private readonly header: string
  ) {}

  async send(to: string, message: string): Promise<SmsSendResult> {
    try {
      const params = new URLSearchParams({
        usercode: this.usercode,
        password: this.password,
        gsmno: to,
        message,
        msgheader: this.header,
      });

      const response = await fetch(`https://api.netgsm.com.tr/sms/send/get?${params.toString()}`, {
        method: "GET",
      });
      const text = (await response.text()).trim();

      if (text.startsWith("00")) {
        return { success: true, providerRef: text };
      }
      return { success: false, error: `NetGSM hata kodu: ${text}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Bilinmeyen NetGSM hatası" };
    }
  }
}
