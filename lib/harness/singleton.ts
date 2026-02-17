import path from "node:path";

import { HarnessOrchestrator } from "@/lib/harness/orchestrator";
import { JsonRunStore } from "@/lib/harness/store";

const globalForHarness = globalThis as {
  __harness_orchestrator__?: HarnessOrchestrator;
};

export function getOrchestrator(): HarnessOrchestrator {
  if (!globalForHarness.__harness_orchestrator__) {
    const storePath = path.join(process.cwd(), ".data", "store.json");
    const store = new JsonRunStore(storePath);
    globalForHarness.__harness_orchestrator__ = new HarnessOrchestrator(store);
  }
  return globalForHarness.__harness_orchestrator__;
}
