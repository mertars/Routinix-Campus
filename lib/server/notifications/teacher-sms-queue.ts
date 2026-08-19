import { createSmsProvider } from "@/lib/server/sms/provider-factory";
import { InProcessQueue } from "@/lib/server/queue/in-process-queue";

type TeacherSmsJob = { phone: string; message: string };

// Toplu veli bildirimlerinden (notification-service.ts) ayrı, tek alıcılı
// ve daha hafif bir kuyruk — burada bir NotificationBatch/Log kaydı
// gerekmiyor, sadece "öğretmene anında haber ver" akışı var.
const globalForQueue = globalThis as unknown as { teacherSmsQueue?: InProcessQueue<TeacherSmsJob> };

function getTeacherSmsQueue(): InProcessQueue<TeacherSmsJob> {
  if (globalForQueue.teacherSmsQueue) return globalForQueue.teacherSmsQueue;

  const provider = createSmsProvider();
  const queue = new InProcessQueue<TeacherSmsJob>();
  queue.process(async ({ phone, message }) => {
    await provider.send(phone, message);
  });

  globalForQueue.teacherSmsQueue = queue;
  return queue;
}

// Öğrenci yeni bir soru gönderdiğinde öğretmeni anlık bilgilendirir. Şu an
// mock SMS sağlayıcısı üzerinden çalışır; ileride gerçek bir push bildirim
// servisiyle (FCM/APNs) veya gerçek bir SMS sağlayıcısıyla değiştirilebilir.
export async function notifyTeacherBySms(phone: string, message: string) {
  await getTeacherSmsQueue().enqueue({ phone, message });
}
