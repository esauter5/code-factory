import { NextResponse } from "next/server";

import { getAvailableProviders, getRuntimeCapabilities } from "@/lib/harness/singleton";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const [providers, capabilities] = await Promise.all([
    getAvailableProviders(),
    getRuntimeCapabilities(),
  ]);
  return NextResponse.json({
    providers: providers.map((p) => ({
      id: p.id,
      label: p.label,
      available: p.available,
      defaultModel: p.defaultModel,
      models: p.models.map((m) => ({
        id: m.id,
        label: m.label,
        thinkingLevels: m.thinkingLevels,
      })),
    })),
    capabilities,
  });
}
