import type { SmsProvider, SmsSendResult } from "../types";

// ⚠️ DOĞRULAMA GEREKİR: Bu implementasyon NetGSM'in yaygın bilinen klasik
// REST API deseni (usercode/password/gsmno/message, "00" ile başlayan başarı
// kodu) baz alınarak yazılmıştır — internet erişimim olmadığı için NetGSM'in
// GÜNCEL resmi dokümantasyonuyla teyit edilmedi. Üretime almadan önce
// https://www.netgsm.com.tr üzerindeki güncel API referansıyla endpoint ve
// alan adlarını doğrulayın.
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
