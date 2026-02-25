"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BUILTIN_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  templateRequiresAgentBrowser,
} from "@/lib/harness/pipeline-templates";
import type {
  PrMode,
  ProviderData,
  RepoConfig,
  RunRecord,
  RunnerMode,
  RuntimeCapabilitiesData,
} from "@/lib/harness/types";

import type { DirectoryBrowseResponse, DirectoryEntry } from "../_hooks/use-run-actions";

const CUSTOM_PATH_VALUE = "__custom__";

export function NewRunDialog({
  open,
  loading,
  repos,
  initialRepoId,
  onSubmit,
  onClose,
  onBrowseDirectory,
  onRunnerModeChange,
}: {
  open: boolean;
  loading: boolean;
  repos: RepoConfig[];
  initialRepoId?: string | null;
  onSubmit: (params: {
    ticket: string;
    repoPath: string;
    repoId?: string;
    runnerMode: RunnerMode;
    testCommand: string;
    prMode: PrMode;
    templateId: string;
  }) => Promise<RunRecord | null>;
  onClose: () => void;
  onBrowseDirectory: (path: string) => Promise<DirectoryBrowseResponse>;
  onRunnerModeChange?: (mode: RunnerMode) => void;
}) {
  const [ticket, setTicket] = useState("");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [repoPath, setRepoPath] = useState(".");
  const [runnerMode, setRunnerMode] = useState<RunnerMode>("mock");
  const [testCommand, setTestCommand] = useState("pnpm lint");
  const [prMode, setPrMode] = useState<PrMode>("simulate");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [capabilities, setCapabilities] = useState<RuntimeCapabilitiesData | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerPath, setPickerPath] = useState("");
  const [pickerParentPath, setPickerParentPath] = useState<string | null>(null);
  const [pickerDirectories, setPickerDirectories] = useState<DirectoryEntry[]>([]);
  const [pickerShortcuts, setPickerShortcuts] = useState<Array<{ label: string; path: string }>>([]);

  // Fetch providers on mount
  useEffect(() => {
    if (!open) return;
    void fetch("/api/providers")
      .then((res) => res.json())
      .then((data: { providers: ProviderData[]; capabilities?: RuntimeCapabilitiesData }) => {
        setProviders(data.providers ?? []);
        setCapabilities(data.capabilities ?? null);
      })
      .catch(() => {});
  }, [open]);

  // Pre-select repo from active workspace when dialog opens
  useEffect(() => {
    if (open && initialRepoId) {
      setSelectedRepoId(initialRepoId);
      const repo = repos.find((r) => r.id === initialRepoId);
      if (repo) {
        setTestCommand(repo.defaultTestCommand || "pnpm lint");
      }
    }
  }, [open, initialRepoId, repos]);

  const isCustomPath = selectedRepoId === CUSTOM_PATH_VALUE;

  const handleRunnerChange = (value: string) => {
    const mode = value as RunnerMode;
    setRunnerMode(mode);
    onRunnerModeChange?.(mode);
  };

  const handleRepoChange = (value: string) => {
    setSelectedRepoId(value);
    if (value !== CUSTOM_PATH_VALUE) {
      const repo = repos.find((r) => r.id === value);
      if (repo) {
        setTestCommand(repo.defaultTestCommand || "pnpm lint");
      }
    } else {
      setPrMode("simulate");
    }
  };

  const selectedTemplate = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  const selectedTemplateRequiresAgentBrowser = selectedTemplate
    ? templateRequiresAgentBrowser(selectedTemplate)
    : false;
  const agentBrowser = capabilities?.agentBrowser ?? null;
  const isBlockedByMissingAgentBrowser = selectedTemplateRequiresAgentBrowser && !agentBrowser?.available;

  const loadDirectory = useCallback(
    async (targetPath: string) => {
      try {
        setPickerLoading(true);
        setPickerError("");
        const data = await onBrowseDirectory(targetPath);
        setPickerPath(data.currentPath);
        setPickerParentPath(data.parentPath);
        setPickerDirectories(data.directories);
        setPickerShortcuts(data.shortcuts);
      } catch (err) {
        setPickerError(err instanceof Error ? err.message : "failed to browse directories");
      } finally {
        setPickerLoading(false);
      }
    },
    [onBrowseDirectory],
  );

  const openPicker = () => {
    setShowPicker(true);
    void loadDirectory(repoPath || ".");
  };

  const selectDirectory = (path: string) => {
    setRepoPath(path);
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    const params: {
      ticket: string;
      repoPath: string;
      repoId?: string;
      runnerMode: RunnerMode;
      testCommand: string;
      prMode: PrMode;
      templateId: string;
    } = {
      ticket,
      repoPath: isCustomPath ? repoPath : ".",
      runnerMode,
      testCommand,
      prMode,
      templateId,
    };

    if (selectedRepoId && !isCustomPath) {
      params.repoId = selectedRepoId;
    }

    const result = await onSubmit(params);
    if (result) {
      setTicket("");
      setSelectedRepoId("");
      setRepoPath(".");
      setRunnerMode("mock");
      setTestCommand("pnpm lint");
      setPrMode("simulate");
      setTemplateId(DEFAULT_TEMPLATE_ID);
      onRunnerModeChange?.("mock");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Run</DialogTitle>
          <DialogDescription>
            Create a new pipeline run. Configure per-stage model settings via column gear icons.
          </DialogDescription>
        </DialogHeader>

        {showPicker ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Browse directories</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowPicker(false)}
              >
                Back to form
              </Button>
            </div>

            <div className="rounded-md border bg-muted/30 px-2 py-1 text-[11px] font-mono break-all">
              {pickerPath || "(loading...)"}
            </div>

            <div className="flex flex-wrap gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                disabled={pickerLoading || !pickerParentPath}
                onClick={() => pickerParentPath && void loadDirectory(pickerParentPath)}
              >
                Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                disabled={pickerLoading}
                onClick={() => void loadDirectory(pickerPath || repoPath || ".")}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                className="h-6 text-[10px]"
                disabled={!pickerPath}
                onClick={() => selectDirectory(pickerPath)}
              >
                Use this folder
              </Button>
            </div>

            {pickerShortcuts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pickerShortcuts.map((s) => (
                  <Button
                    key={s.path}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => void loadDirectory(s.path)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            )}

            {pickerError && (
              <p className="text-xs text-destructive">{pickerError}</p>
            )}

            <ScrollArea className="h-60 rounded-md border">
              {pickerLoading ? (
                <p className="p-3 text-xs text-muted-foreground">Loading...</p>
              ) : pickerDirectories.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No subdirectories found.</p>
              ) : (
                <div className="divide-y">
                  {pickerDirectories.map((dir) => (
                    <div key={dir.path} className="flex items-center justify-between gap-2 px-2 py-1">
                      <button
                        type="button"
                        className="grow truncate text-left text-xs hover:text-primary"
                        onClick={() => void loadDirectory(dir.path)}
                        title={dir.path}
                      >
                        {dir.name}
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-5 text-[10px] px-1.5"
                        onClick={() => selectDirectory(dir.path)}
                      >
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" htmlFor="ticket">
                Ticket
              </label>
              <Textarea
                id="ticket"
                placeholder="Describe the change request..."
                className="min-h-[80px] text-sm"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" htmlFor="templateSelect">
                Pipeline
              </label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="templateSelect" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUILTIN_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-medium">{t.label}</span>
                      <span className="ml-2 text-muted-foreground text-[11px]">
                        {t.stages.map((s) => s.name).join(" → ")}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <p className="text-[11px] text-muted-foreground">{selectedTemplate.description}</p>
              )}
              {selectedTemplateRequiresAgentBrowser && (
                <div className={`rounded-md border px-2 py-1.5 text-[11px] ${isBlockedByMissingAgentBrowser ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
                  {isBlockedByMissingAgentBrowser ? (
                    <>
                      <p className="font-medium">Browser verification requires `agent-browser`.</p>
                      <p className="mt-0.5 font-mono">Install: {agentBrowser?.installCommand ?? "npm install -g agent-browser"}</p>
                      <p className="font-mono">Setup: {agentBrowser?.setupCommand ?? "agent-browser install"}</p>
                    </>
                  ) : (
                    <p className="font-medium">`agent-browser` detected. Browser Verify is enabled for this template.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" htmlFor="repoSelect">
                Repository
              </label>
              {repos.length > 0 ? (
                <>
                  <Select value={selectedRepoId} onValueChange={handleRepoChange}>
                    <SelectTrigger id="repoSelect" className="text-sm">
                      <SelectValue placeholder="Select a repo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {repos.map((repo) => (
                        <SelectItem key={repo.id} value={repo.id}>
                          <span className="font-medium">{repo.name}</span>
                          <span className="ml-2 text-muted-foreground text-[11px] font-mono">
                            {repo.localPath}
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_PATH_VALUE}>
                        Custom path...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustomPath && (
                    <div className="flex gap-2 mt-1">
                      <Input
                        className="text-sm font-mono"
                        placeholder="/path/to/repo"
                        value={repoPath}
                        onChange={(e) => setRepoPath(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1"
                        onClick={openPicker}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Browse
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="repoSelect"
                    className="text-sm font-mono"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={openPicker}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Browse
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" htmlFor="runnerMode">
                  Provider
                </label>
                <Select value={runnerMode} onValueChange={handleRunnerChange}>
                  <SelectTrigger id="runnerMode" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock">mock</SelectItem>
                    {providers.filter((p) => p.available).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" htmlFor="prMode">
                  PR Mode
                </label>
                <Select
                  value={prMode}
                  onValueChange={(v) => setPrMode(v as PrMode)}
                >
                  <SelectTrigger id="prMode" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simulate">simulate</SelectItem>
                    <SelectItem value="create" disabled={isCustomPath || !selectedRepoId}>
                      create (real PR)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" htmlFor="testCmd">
                  Test Command
                </label>
                <Input
                  id="testCmd"
                  className="text-sm font-mono"
                  value={testCommand}
                  onChange={(e) => setTestCommand(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {!showPicker && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={loading || !ticket.trim() || isBlockedByMissingAgentBrowser} onClick={handleSubmit}>
              Create + Start
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
