import { NextResponse } from "next/server";

import { BUILTIN_TEMPLATES } from "@/lib/harness/pipeline-templates";
import { DEFAULT_STAGE_ORDER } from "@/lib/harness/types";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    stages: DEFAULT_STAGE_ORDER,
    templates: BUILTIN_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      stages: t.stages.map((s) => s.name),
    })),
  });
}
