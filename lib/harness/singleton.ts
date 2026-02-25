import path from "node:path";

import { detectRuntimeCapabilities } from "@/lib/harness/capabilities";
import { HarnessOrchestrator } from "@/lib/harness/orchestrator";
import type { ProviderInfo } from "@/lib/harness/providers";
import { detectProviders, getAllProviders } from "@/lib/harness/providers";
import { JsonRunStore } from "@/lib/harness/store";
import type { RuntimeCapabilitiesData } from "@/lib/harness/types";

const globalForHarness = globalThis as {
  __harness_orchestrator__?: HarnessOrchestrator;
  __harness_ctor__?: typeof HarnessOrchestrator;
  __harness_providers__?: ProviderInfo[];
  __harness_providers_detected__?: boolean;
};

/**
 * Returns a cached orchestrator singleton. Automatically recreates it when
 * the HarnessOrchestrator class reference changes (i.e. the module was
 * re-evaluated via hot reload), so code changes take effect without needing
 * a manual version bump or server restart.
 */
export function getOrchestrator(): HarnessOrchestrator {
  if (
    !globalForHarness.__harness_orchestrator__ ||
    globalForHarness.__harness_ctor__ !== HarnessOrchestrator
  ) {
    const storePath = path.join(process.cwd(), ".data", "store.json");
    const store = new JsonRunStore(storePath);
    globalForHarness.__harness_orchestrator__ = new HarnessOrchestrator(store);
    globalForHarness.__harness_ctor__ = HarnessOrchestrator;
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

export async function getRuntimeCapabilities(): Promise<RuntimeCapabilitiesData> {
  return detectRuntimeCapabilities();
}
