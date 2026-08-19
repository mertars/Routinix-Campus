import type { SmsProvider, SmsSendResult } from "../types";

// Sağlayıcı-bağımsız, en esnek seçenek: kendi endpoint'inizi ve API
// anahtarınızı .env üzerinden verirsiniz, JSON gövdeyle POST atar.
// Farklı bir sağlayıcı sözleşmesine uyması gerekiyorsa (örn. farklı alan
// adları) sadece bu dosyayı düzenlemeniz yeterli.
export class GenericRestProvider implements SmsProvider {
  readonly name = "generic";

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string
  ) {}

  async send(to: string, message: string): Promise<SmsSendResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ to, message }),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = (await response.json().catch(() => null)) as { id?: string } | null;
      return { success: true, providerRef: data?.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" };
    }
  }
}
