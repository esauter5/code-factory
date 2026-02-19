"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProviderData, StageOverride } from "@/lib/harness/types";

const INHERIT_VALUE = "__inherit__";

export function StageSettingsPopover({
  stageName,
  executionType,
  defaultTimeoutMs,
  defaultTemplateOrCommand,
  override,
  onOverrideChange,
  providers,
}: {
  stageName: string;
  executionType: "claude-prompt" | "shell-command";
  defaultTimeoutMs: number;
  defaultTemplateOrCommand: string;
  override: StageOverride | undefined;
  onOverrideChange: (stageName: string, override: StageOverride | null) => void;
  providers: ProviderData[];
}) {
  const [localTimeout, setLocalTimeout] = useState<string>("");
  const [open, setOpen] = useState(false);

  const hasOverride = override && (override.provider || override.model || override.thinkingLevel || override.timeoutMs);

  const selectedProvider = override?.provider || INHERIT_VALUE;
  const providerData = providers.find((p) => p.id === selectedProvider);

  function update(patch: Partial<StageOverride>) {
    const next: StageOverride = { ...override, ...patch };
    // Clean up undefined/empty values
    if (!next.provider) delete next.provider;
    if (!next.model) delete next.model;
    if (!next.thinkingLevel) delete next.thinkingLevel;
    if (!next.timeoutMs) delete next.timeoutMs;

    // If all fields are empty, remove the override entirely
    if (!next.provider && !next.model && !next.thinkingLevel && !next.timeoutMs) {
      onOverrideChange(stageName, null);
    } else {
      onOverrideChange(stageName, next);
    }
  }

  function handleProviderChange(value: string) {
    if (value === INHERIT_VALUE) {
      // Clear provider, model, and thinking
      update({ provider: undefined, model: undefined, thinkingLevel: undefined });
    } else {
      update({ provider: value, model: undefined, thinkingLevel: undefined });
    }
  }

  function handleModelChange(value: string) {
    const newModelId = value === INHERIT_VALUE ? undefined : value;
    // Clear thinking if the new model doesn't support it
    const newModel = providerData?.models.find((m) => m.id === newModelId);
    const defaultModel = providerData?.models.find((m) => m.id === providerData.defaultModel);
    const modelForThinking = newModel ?? defaultModel;
    const hasThinking = (modelForThinking?.thinkingLevels.length ?? 0) > 0;
    update({
      model: newModelId,
      ...(hasThinking ? {} : { thinkingLevel: undefined }),
    });
  }

  function handleThinkingChange(value: string) {
    update({ thinkingLevel: value === INHERIT_VALUE ? undefined : value });
  }

  function handleTimeoutBlur() {
    const parsed = parseInt(localTimeout, 10);
    if (localTimeout === "" || isNaN(parsed)) {
      update({ timeoutMs: undefined });
      setLocalTimeout("");
    } else {
      update({ timeoutMs: parsed * 1000 });
    }
  }

  function handleReset() {
    setLocalTimeout("");
    onOverrideChange(stageName, null);
  }

  // Sync local timeout state when popover opens
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLocalTimeout(override?.timeoutMs ? String(override.timeoutMs / 1000) : "");
    }
    setOpen(nextOpen);
  }

  const isPromptStage = executionType === "claude-prompt";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
          title={`${stageName} settings`}
        >
          <Settings2 className="h-3 w-3" />
          {hasOverride && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">{stageName} Settings</span>
            {hasOverride && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5"
                onClick={handleReset}
              >
                Reset to defaults
              </Button>
            )}
          </div>

          {isPromptStage && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Provider</label>
                <Select value={selectedProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={INHERIT_VALUE}>Inherit from run</SelectItem>
                    {providers.filter((p) => p.available).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {override?.provider && providerData && (() => {
                const selectedModel = providerData.models.find((m) => m.id === override?.model);
                const defaultModel = providerData.models.find((m) => m.id === providerData.defaultModel);
                const effectiveModel = selectedModel ?? defaultModel;
                const thinkingLevels = effectiveModel?.thinkingLevels ?? [];

                return (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Model</label>
                      <Select value={override?.model || INHERIT_VALUE} onValueChange={handleModelChange}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_VALUE}>
                            Default ({providerData.defaultModel})
                          </SelectItem>
                          {providerData.models.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {thinkingLevels.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Thinking</label>
                        <Select value={override?.thinkingLevel || INHERIT_VALUE} onValueChange={handleThinkingChange}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={INHERIT_VALUE}>Default</SelectItem>
                            {thinkingLevels.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">Timeout (seconds)</label>
            <Input
              type="number"
              className="h-7 text-xs font-mono"
              placeholder={String(defaultTimeoutMs / 1000)}
              value={localTimeout}
              onChange={(e) => setLocalTimeout(e.target.value)}
              onBlur={handleTimeoutBlur}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">
              {executionType === "shell-command" ? "Command" : "Template"}
            </label>
            <div className="rounded-md bg-muted/50 px-2 py-1 text-[10px] font-mono text-muted-foreground truncate">
              {defaultTemplateOrCommand}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
