import type { SmsProvider, SmsSendResult } from "../types";

// ⚠️ DOĞRULAMA GEREKİR: MutluSMS'in güncel resmi API dokümantasyonu internet
// erişimim olmadığı için teyit edilemedi. Aşağıdaki JSON/Bearer-token deseni
// yaygın SMS API'leri için makul bir varsayımdır — üretime almadan önce
// sağlayıcının güncel dokümantasyonuyla endpoint/alan adlarını doğrulayın.
export class MutluSmsProvider implements SmsProvider {
  readonly name = "mutlusms";

  constructor(
    private readonly apiKey: string,
    private readonly originator: string
  ) {}

  async send(to: string, message: string): Promise<SmsSendResult> {
    try {
      const response = await fetch("https://api.mutlucell.com/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ to, message, originator: this.originator }),
      });

      const data = (await response.json().catch(() => null)) as { status?: string; messageId?: string; error?: string } | null;

      if (response.ok && data?.status === "ok") {
        return { success: true, providerRef: data.messageId };
      }
      return { success: false, error: data?.error ?? `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Bilinmeyen MutluSMS hatası" };
    }
  }
}
