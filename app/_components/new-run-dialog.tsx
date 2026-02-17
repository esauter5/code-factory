"use client";

import { useCallback, useState } from "react";
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
import type { RunRecord } from "@/lib/harness/types";

import type { DirectoryBrowseResponse, DirectoryEntry } from "../_hooks/use-run-actions";

export function NewRunDialog({
  open,
  loading,
  onSubmit,
  onClose,
  onBrowseDirectory,
}: {
  open: boolean;
  loading: boolean;
  onSubmit: (params: {
    ticket: string;
    repoPath: string;
    runnerMode: "mock" | "claude";
    testCommand: string;
  }) => Promise<RunRecord | null>;
  onClose: () => void;
  onBrowseDirectory: (path: string) => Promise<DirectoryBrowseResponse>;
}) {
  const [ticket, setTicket] = useState("");
  const [repoPath, setRepoPath] = useState(".");
  const [runnerMode, setRunnerMode] = useState<"mock" | "claude">("mock");
  const [testCommand, setTestCommand] = useState("pnpm lint");

  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerPath, setPickerPath] = useState("");
  const [pickerParentPath, setPickerParentPath] = useState<string | null>(null);
  const [pickerDirectories, setPickerDirectories] = useState<DirectoryEntry[]>([]);
  const [pickerShortcuts, setPickerShortcuts] = useState<Array<{ label: string; path: string }>>([]);

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
    const result = await onSubmit({ ticket, repoPath, runnerMode, testCommand });
    if (result) {
      setTicket("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Run</DialogTitle>
          <DialogDescription>
            Create a new pipeline run. It will start from the Plan stage.
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
              <label className="text-xs font-medium" htmlFor="repoPath">
                Repo Path
              </label>
              <div className="flex gap-2">
                <Input
                  id="repoPath"
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Runner</label>
                <Select value={runnerMode} onValueChange={(v) => setRunnerMode(v as "mock" | "claude")}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock">mock</SelectItem>
                    <SelectItem value="claude">claude -p</SelectItem>
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
            <Button disabled={loading || !ticket.trim()} onClick={handleSubmit}>
              Create + Start
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
