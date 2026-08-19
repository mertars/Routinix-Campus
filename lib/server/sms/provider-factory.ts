import type { SmsProvider } from "./types";
import { MockSmsProvider } from "./providers/mock-provider";
import { NetGsmProvider } from "./providers/netgsm-provider";
import { MutluSmsProvider } from "./providers/mutlu-sms-provider";
import { GenericRestProvider } from "./providers/generic-rest-provider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Ortam değişkeni eksik: ${name} (SMS_PROVIDER için gerekli)`);
  return value;
}

// SMS_PROVIDER ortam değişkenine göre doğru sağlayıcıyı döndürür.
// Varsayılan "mock" — hiçbir gerçek kimlik bilgisi gerektirmez.
export function createSmsProvider(): SmsProvider {
  const providerName = process.env.SMS_PROVIDER ?? "mock";

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
