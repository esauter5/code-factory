import path from "node:path";

import { HarnessOrchestrator } from "@/lib/harness/orchestrator";
import type { ProviderInfo } from "@/lib/harness/providers";
import { detectProviders, getAllProviders } from "@/lib/harness/providers";
import { JsonRunStore } from "@/lib/harness/store";

const globalForHarness = globalThis as {
  __harness_orchestrator__?: HarnessOrchestrator;
  __harness_version__?: number;
  __harness_providers__?: ProviderInfo[];
  __harness_providers_detected__?: boolean;
};

// Bump this when runner/orchestrator behavior changes so the
// singleton is recreated after hot-reload in dev mode.
const CODE_VERSION = 6;

export function getOrchestrator(): HarnessOrchestrator {
  if (
    !globalForHarness.__harness_orchestrator__ ||
    globalForHarness.__harness_version__ !== CODE_VERSION
  ) {
    const storePath = path.join(process.cwd(), ".data", "store.json");
    const store = new JsonRunStore(storePath);
    globalForHarness.__harness_orchestrator__ = new HarnessOrchestrator(store);
    globalForHarness.__harness_version__ = CODE_VERSION;
  }
  return globalForHarness.__harness_orchestrator__;
}

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  if (!globalForHarness.__harness_providers_detected__) {
    globalForHarness.__harness_providers__ = await detectProviders();
    globalForHarness.__harness_providers_detected__ = true;
  }
  return globalForHarness.__harness_providers__ ?? getAllProviders();
}
