import { NextResponse } from "next/server";

import { STAGE_ORDER } from "@/lib/harness/types";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    stages: STAGE_ORDER,
  });
}
