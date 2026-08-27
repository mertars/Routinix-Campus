import { NextResponse } from "next/server";
import { PLATFORM_SESSION_COOKIE_NAME } from "@/lib/server/auth/platform-jwt";
import { withApiLogging } from "@/lib/logger";

async function handlePost() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PLATFORM_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}

export const POST = withApiLogging("POST /api/platform/logout", handlePost);
