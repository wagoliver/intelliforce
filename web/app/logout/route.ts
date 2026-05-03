import { NextResponse } from "next/server";

import { clearSessionCookies } from "@/lib/auth/session";

export async function GET() {
  await clearSessionCookies();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
}
