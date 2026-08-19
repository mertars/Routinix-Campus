import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendBulkNotification } from "@/lib/server/sms/notification-service";
import { withApiLogging, logger } from "@/lib/logger";

const bodySchema = z.object({
  scopeType: z.enum(["ALL_SCHOOL", "GRADE", "BRANCH", "CUSTOM_GROUP", "CUSTOM_ID_LIST"]),
  scopeValue: z.string().optional(),
  templateBody: z.string().min(1, "templateBody boş olamaz"),
  extraParams: z.record(z.string(), z.string()).optional(),
});

// POST /api/notifications/send
// Body: { scopeType, scopeValue?, templateBody, extraParams? }
// 202 döner — gönderim kuyruğa alınır, senkron olarak beklenmez.
async function handlePost(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await sendBulkNotification(parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    logger.error("notifications_send_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/notifications/send", handlePost);
