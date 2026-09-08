import { computeAccountBalances } from "@/lib/server/payments/account-balance";

export type FundsCheck = { ok: true } | { ok: false; error: string; balance: number };

// Bir hesaptan para ÇIKARMADAN önce bakiye kontrolü.
//
// Virman ve iade uçlarında bu kontrol baştan beri vardı ama gider ve
// bordro ödemesinde YOKTU — bu yüzden parası olmayan bir hesaptan kira ve
// maaş ödenip bakiye sessizce eksiye düşebiliyordu (gerçek testte banka
// −137.100 ₺'ye indi, sistem tek uyarı vermedi).
//
// allowOverdraft: kurumun kredili mevduat hesabı olabilir; müdür farkında
// olarak eksiye düşmek isteyebilir. Bu yüzden kontrol SESSİZ bir engel
// değil, açık bir onay noktasıdır: arayüz "bakiye yetersiz, yine de
// kaydedilsin mi?" diye sorar. Amaç eksiyi yasaklamak değil, KAZA ile
// eksiye düşülmesini engellemek.
export async function assertSufficientFunds(
  institutionId: string,
  accountId: string,
  amount: number,
  allowOverdraft: boolean
): Promise<FundsCheck> {
  if (allowOverdraft) return { ok: true };

  const balances = await computeAccountBalances(institutionId);
  const account = balances.find((b) => b.id === accountId);
  const balance = account?.balance ?? 0;
  if (balance >= amount) return { ok: true };

  return {
    ok: false,
    balance,
    error: `Yetersiz bakiye: "${account?.name ?? "hesap"}" bakiyesi ${balance.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ₺, çıkacak tutar ${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺.`,
  };
}
