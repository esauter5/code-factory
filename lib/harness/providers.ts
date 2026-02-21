import { spawn } from "node:child_process";

export interface ProviderThinkingLevel {
  id: string;
  label: string;
}

export interface ProviderModel {
  id: string;
  label: string;
  thinkingLevels: ProviderThinkingLevel[];
}

export interface ParsedProviderOutput {
  output: string;
  success: boolean;
  error: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
  binary: string;
  available: boolean;
  defaultModel: string;
  models: ProviderModel[];
  buildArgs(prompt: string, model?: string, thinkingLevel?: string): string[];
  buildEnv(thinkingLevel?: string): Record<string, string>;
  parseOutput(raw: string): ParsedProviderOutput;
}

// ---------------------------------------------------------------------------
// Shared stream-json parser (Claude)
// ---------------------------------------------------------------------------

interface StreamJsonEvent {
  type: string;
  subtype?: string;
  message?: {
    content: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  };
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  is_error?: boolean;
}

export function parseStreamJsonOutput(raw: string): ParsedProviderOutput {
  const lines = raw.split("\n").filter((l) => l.trim());
  const events: StreamJsonEvent[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as StreamJsonEvent);
    } catch {
      // skip malformed lines
    }
  }

  // Extract text content from assistant messages
  const textParts: string[] = [];
  for (const event of events) {
    if (event.type === "assistant" && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        }
      }
    }
  }

  const output = textParts.join("\n").trim();

  // Use the last result event if multiple are emitted.
  const resultEvent = [...events].reverse().find((e) => e.type === "result");

  // Extract metadata from result event
  const costUsd = resultEvent?.total_cost_usd;
  const durationMs = resultEvent?.duration_ms;

  if (resultEvent) {
    if (resultEvent.subtype === "error" || resultEvent.is_error) {
      return {
        output: resultEvent.result || output || "",
        success: false,
        error: resultEvent.result || "Provider returned an error result",
        costUsd,
        durationMs,
      };
    }
    const finalOutput = resultEvent.result || output || "";
    return { output: finalOutput, success: true, error: "", costUsd, durationMs };
  }

  if (output.length > 0) {
    return { output, success: true, error: "" };
  }

  return { output: "", success: false, error: "No output or result event from provider" };
}

// ---------------------------------------------------------------------------
// Codex JSONL parser
// ---------------------------------------------------------------------------

interface CodexEvent {
  type?: string;
  content?: string;
  text?: string;
  message?: string;
  status?: string;
  // Token usage from turn.completed events
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
  // Newer Codex CLI wraps events in an item envelope
  item?: {
    type?: string;
    text?: string;
    content?: string;
    message?: string;
    command?: string;
    aggregated_output?: string;
    exit_code?: number | null;
    status?: string;
  };
}

function parseCodexOutput(raw: string): ParsedProviderOutput {
  const lines = raw.split("\n").filter((l) => l.trim());
  const textParts: string[] = [];
  let hasError = false;
  let errorMsg = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as CodexEvent;

      // Extract token counts from turn.completed events
      if (event.type === "turn.completed" && event.usage) {
        totalInputTokens += event.usage.input_tokens ?? 0;
        totalOutputTokens += event.usage.output_tokens ?? 0;
        continue;
      }

      // Skip lifecycle events that don't carry content
      if (event.type === "thread.started" || event.type === "turn.started" || event.type === "turn.failed") {
        if (event.type === "turn.failed") {
          hasError = true;
          errorMsg = event.message || "Codex turn failed";
        }
        continue;
      }

      // Newer format: {type: "item.completed", item: {type: "agent_message", text: "..."}}
      if (event.item) {
        const item = event.item;
        if (item.type === "agent_message" && item.text) {
          textParts.push(item.text);
        } else if (item.type === "reasoning" && item.text) {
          // skip reasoning blocks from artifact output
        } else if (item.type === "command_execution" && item.aggregated_output) {
          // command outputs are context, not the final artifact
        } else if (item.type === "error") {
          hasError = true;
          errorMsg = item.message || item.text || "Codex returned an error";
        }
        continue;
      }

      // Legacy format: {type: "message", content: "..."}
      if (event.type === "message" && event.content) {
        textParts.push(event.content);
      } else if (event.type === "text" && event.text) {
        textParts.push(event.text);
      } else if (event.content) {
        textParts.push(event.content);
      } else if (event.type === "error") {
        hasError = true;
        errorMsg = event.message || event.content || "Codex returned an error";
      }
    } catch {
      // Non-JSON line — treat as plain text output
      if (line.trim()) {
        textParts.push(line);
      }
    }
  }

  const output = textParts.join("\n");
  const inputTokens = totalInputTokens > 0 ? totalInputTokens : undefined;
  const outputTokens = totalOutputTokens > 0 ? totalOutputTokens : undefined;

  if (hasError && !output) {
    return { output: "", success: false, error: errorMsg, inputTokens, outputTokens };
  }

  if (output.length > 0) {
    return { output, success: !hasError, error: hasError ? errorMsg : "", inputTokens, outputTokens };
  }

  return { output: "", success: false, error: "No output from Codex", inputTokens, outputTokens };
}

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

const claudeProvider: ProviderInfo = {
  id: "claude",
  label: "Claude Code",
  binary: "claude",
  available: false,
  defaultModel: "opus",
  models: [
    { id: "sonnet", label: "Sonnet", thinkingLevels: [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
    ]},
    { id: "opus", label: "Opus", thinkingLevels: [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
    ]},
    { id: "haiku", label: "Haiku", thinkingLevels: [] },
  ],
  buildArgs(prompt: string, model?: string): string[] {
    const args = ["-p", "--verbose", "--output-format", "stream-json"];
    if (model) {
      args.push("--model", model);
    }
    args.push(prompt);
    return args;
  },
  buildEnv(thinkingLevel?: string): Record<string, string> {
    if (thinkingLevel) {
      return { CLAUDE_CODE_EFFORT_LEVEL: thinkingLevel };
    }
    return {};
  },
  parseOutput: parseStreamJsonOutput,
};

const codexProvider: ProviderInfo = {
  id: "codex",
  label: "Codex",
  binary: "codex",
  available: false,
  defaultModel: "gpt-5.3-codex",
  models: [
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex", thinkingLevels: [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
      { id: "xhigh", label: "Extra High" },
    ]},
    { id: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark", thinkingLevels: [] },
    { id: "gpt-5.2-codex", label: "GPT-5.2 Codex", thinkingLevels: [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
      { id: "xhigh", label: "Extra High" },
    ]},
  ],
  buildArgs(prompt: string, model?: string, thinkingLevel?: string): string[] {
    const args = ["exec", prompt, "--json"];
    if (model) {
      args.push("--model", model);
    }
    if (thinkingLevel) {
      args.push("-c", `model_reasoning_effort="${thinkingLevel}"`);
    }
    return args;
  },
  buildEnv(): Record<string, string> {
    return {};
  },
  parseOutput: parseCodexOutput,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ALL_PROVIDERS: ProviderInfo[] = [claudeProvider, codexProvider];

function whichBinary(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", [binary], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

export async function detectProviders(): Promise<ProviderInfo[]> {
  const results = await Promise.all(
    ALL_PROVIDERS.map(async (p) => {
      const found = await whichBinary(p.binary);
      // Return a shallow copy with availability set
      return { ...p, available: found };
    }),
  );

  // Update the canonical objects so getProvider() reflects detection
  for (const result of results) {
    const canonical = ALL_PROVIDERS.find((p) => p.id === result.id);
    if (canonical) {
      canonical.available = result.available;
    }
  }

  return ALL_PROVIDERS;
}

export function getProvider(id: string): ProviderInfo | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export function getAvailableProviders(): ProviderInfo[] {
  return ALL_PROVIDERS.filter((p) => p.available);
}

export function getAllProviders(): ProviderInfo[] {
  return ALL_PROVIDERS;
}
