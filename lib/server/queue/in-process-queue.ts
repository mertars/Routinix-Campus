import { randomUUID } from "crypto";
import type { QueueAdapter } from "./types";

// Şimdilik Redis/BullMQ yok — bu sınıf aynı 'QueueAdapter' arayüzünü
// uygulayan, tek süreç içinde çalışan basit bir kuyruktur. Sistemi
// bloklamadan (enqueue çağıranı beklemeden) asenkron işler, hatada üstel
// gecikmeli yeniden dener. İleride gerçek ölçeğe geçilince bu dosyanın
// yerine aynı arayüzü uygulayan bir 'BullMqQueueAdapter' yazılıp
// notification-service.ts'te TEK SATIR değiştirilerek geçiş yapılabilir —
// çağıran kodun geri kalanı hiç değişmez.
export class InProcessQueue<T> implements QueueAdapter<T> {
  private handler: ((data: T) => Promise<void>) | null = null;
  private readonly maxAttempts: number;

  constructor(maxAttempts = 3) {
    this.maxAttempts = maxAttempts;
  }

  process(handler: (data: T) => Promise<void>) {
    this.handler = handler;
  }

  async enqueue(data: T): Promise<string> {
    const jobId = randomUUID();
    queueMicrotask(() => {
      void this.runWithRetry(data, jobId, 1);
    });
    return jobId;
  }

  private async runWithRetry(data: T, jobId: string, attempt: number): Promise<void> {
    if (!this.handler) {
      console.error(`[InProcessQueue] İşlenecek handler tanımlı değil (job ${jobId})`);
      return;
    }
    try {
      await this.handler(data);
    } catch (error) {
      if (attempt < this.maxAttempts) {
        const delayMs = attempt * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.runWithRetry(data, jobId, attempt + 1);
      }
      console.error(`[InProcessQueue] Job ${jobId} ${this.maxAttempts} denemeden sonra başarısız oldu:`, error);
    }
  }
}
