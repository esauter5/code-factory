import { spawn } from "node:child_process";

import type { RuntimeCapabilitiesData } from "@/lib/harness/types";

function whichBinary(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", [binary], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

export async function detectRuntimeCapabilities(): Promise<RuntimeCapabilitiesData> {
  const agentBrowserBinary = "agent-browser";
  const agentBrowserAvailable = await whichBinary(agentBrowserBinary);

  return {
    agentBrowser: {
      available: agentBrowserAvailable,
      binary: agentBrowserBinary,
      installCommand: "npm install -g agent-browser",
      setupCommand: "agent-browser install",
    },
  };
}
