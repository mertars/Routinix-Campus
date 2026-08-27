import type { SmsProvider } from "./types";
import { MockSmsProvider } from "./providers/mock-provider";
import { NetGsmProvider } from "./providers/netgsm-provider";
import { MutluSmsProvider } from "./providers/mutlu-sms-provider";
import { GenericRestProvider } from "./providers/generic-rest-provider";
import { getEnv } from "@/lib/server/env";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Ortam değişkeni eksik: ${name} (SMS_PROVIDER için gerekli)`);
  return value;
}

// GERÇEK bir SMS göndermeden (bkz. /api/health) sadece seçili sağlayıcının
// gerekli ortam değişkenlerinin eksiksiz tanımlı olduğunu doğrular —
// createSmsProvider() zaten aynı requireEnv() kontrolünü yapıyor, burada
// sadece o hatayı bir sağlık durumuna çeviriyoruz.
export function getSmsProviderStatus(): { provider: string; configured: boolean; error?: string } {
  const providerName = getEnv().SMS_PROVIDER;
  try {
    createSmsProvider();
    return { provider: providerName, configured: true };
  } catch (error) {
    return { provider: providerName, configured: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// SMS_PROVIDER ortam değişkenine göre doğru sağlayıcıyı döndürür.
// Varsayılan "mock" — hiçbir gerçek kimlik bilgisi gerektirmez.
export function createSmsProvider(): SmsProvider {
  const providerName = getEnv().SMS_PROVIDER;

  switch (providerName) {
    case "netgsm":
      return new NetGsmProvider(requireEnv("NETGSM_USERCODE"), requireEnv("NETGSM_PASSWORD"), process.env.NETGSM_HEADER ?? "");
    case "mutlusms":
      return new MutluSmsProvider(requireEnv("MUTLUSMS_API_KEY"), process.env.MUTLUSMS_ORIGINATOR ?? "");
    case "generic":
      return new GenericRestProvider(requireEnv("GENERIC_SMS_ENDPOINT"), requireEnv("GENERIC_SMS_API_KEY"));
    case "mock":
      return new MockSmsProvider();
    default:
      throw new Error(`Bilinmeyen SMS_PROVIDER: "${providerName}" (mock | netgsm | mutlusms | generic olmalı)`);
  }
}
