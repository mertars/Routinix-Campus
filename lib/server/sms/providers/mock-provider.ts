import type { SmsProvider, SmsSendResult } from "../types";

// Gerçek bir sağlayıcıya hiçbir ağ isteği atmaz — geliştirme/demo ortamı
// için varsayılan sağlayıcıdır (SMS_PROVIDER=mock). Gerçekçi gecikme ve
// düşük ihtimalli rastgele başarısızlıkla gerçek sağlayıcı davranışını simüle eder.
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  async send(to: string, message: string): Promise<SmsSendResult> {
    await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));

    if (Math.random() < 0.05) {
      return { success: false, error: "Mock sağlayıcı: simüle edilmiş geçici hata" };
    }

    console.log(`[MockSMS] -> ${to}: ${message}`);
    return { success: true, providerRef: `mock-${Date.now()}` };
  }
}
