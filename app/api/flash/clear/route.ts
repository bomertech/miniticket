import { NextResponse } from "next/server";

import { clearFlashMessage } from "@/lib/flash";

export async function POST() {
  await clearFlashMessage();

  return NextResponse.json({
    ok: true
  });
}
