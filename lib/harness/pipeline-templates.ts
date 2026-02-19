export type StageExecutionType = "claude-prompt" | "shell-command";

export interface StageDefinition {
  name: string;
  executionType: StageExecutionType;
  templateOrCommand: string;
  timeoutMs: number;
  successCriteria?: {
    failIfOutputContains?: string;
    extractUrlPattern?: string;
  };
  provider?: string;
  model?: string;
  thinkingLevel?: string;
}

export interface PipelineTemplate {
  id: string;
  label: string;
  description: string;
  stages: StageDefinition[];
}

export const BUILTIN_TEMPLATES: PipelineTemplate[] = [
  {
    id: "feature",
    label: "Feature",
    description: "Full pipeline: Plan, Implement, Verify, Test, PR",
    stages: [
      { name: "Plan", executionType: "claude-prompt", templateOrCommand: "plan", timeoutMs: 600_000 },
      { name: "Implement", executionType: "claude-prompt", templateOrCommand: "implement", timeoutMs: 900_000 },
      {
        name: "Verify",
        executionType: "claude-prompt",
        templateOrCommand: "verify",
        timeoutMs: 600_000,
        successCriteria: { failIfOutputContains: "BLOCKER:" },
      },
      { name: "Test", executionType: "shell-command", templateOrCommand: "$testCommand", timeoutMs: 600_000 },
      {
        name: "PR",
        executionType: "claude-prompt",
        templateOrCommand: "pr",
        timeoutMs: 600_000,
        successCriteria: { extractUrlPattern: "https://github\\.com/[^\\s]+/pull/\\d+" },
      },
    ],
  },
  {
    id: "bugfix",
    label: "Bug Fix",
    description: "Plan, Implement, Test, PR (no Verify stage)",
    stages: [
      { name: "Plan", executionType: "claude-prompt", templateOrCommand: "plan", timeoutMs: 600_000 },
      { name: "Implement", executionType: "claude-prompt", templateOrCommand: "implement", timeoutMs: 900_000 },
      { name: "Test", executionType: "shell-command", templateOrCommand: "$testCommand", timeoutMs: 600_000 },
      {
        name: "PR",
        executionType: "claude-prompt",
        templateOrCommand: "pr",
        timeoutMs: 600_000,
        successCriteria: { extractUrlPattern: "https://github\\.com/[^\\s]+/pull/\\d+" },
      },
    ],
  },
  {
    id: "refactor",
    label: "Refactor",
    description: "Plan, Implement, Test (no PR stage)",
    stages: [
      { name: "Plan", executionType: "claude-prompt", templateOrCommand: "plan", timeoutMs: 600_000 },
      { name: "Implement", executionType: "claude-prompt", templateOrCommand: "implement", timeoutMs: 900_000 },
      { name: "Test", executionType: "shell-command", templateOrCommand: "$testCommand", timeoutMs: 600_000 },
    ],
  },
  {
    id: "docs",
    label: "Docs",
    description: "Plan, Implement, PR (no Verify or Test)",
    stages: [
      { name: "Plan", executionType: "claude-prompt", templateOrCommand: "plan", timeoutMs: 600_000 },
      { name: "Implement", executionType: "claude-prompt", templateOrCommand: "implement", timeoutMs: 900_000 },
      {
        name: "PR",
        executionType: "claude-prompt",
        templateOrCommand: "pr",
        timeoutMs: 600_000,
        successCriteria: { extractUrlPattern: "https://github\\.com/[^\\s]+/pull/\\d+" },
      },
    ],
  },
  {
    id: "review",
    label: "Review",
    description: "Plan, Verify (review only, no implementation)",
    stages: [
      { name: "Plan", executionType: "claude-prompt", templateOrCommand: "plan", timeoutMs: 600_000 },
      {
        name: "Verify",
        executionType: "claude-prompt",
        templateOrCommand: "verify",
        timeoutMs: 600_000,
        successCriteria: { failIfOutputContains: "BLOCKER:" },
      },
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = "feature";

export function getTemplate(id: string): PipelineTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

export function getTemplateOrDefault(id?: string | null): PipelineTemplate {
  if (id) {
    const found = getTemplate(id);
    if (found) return found;
  }
  return BUILTIN_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;
}
