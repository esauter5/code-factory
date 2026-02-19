"use client";

import { useCallback, useState } from "react";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { RepoConfig } from "@/lib/harness/types";

import type { DirectoryBrowseResponse, DirectoryEntry } from "../_hooks/use-run-actions";

type RepoView = "list" | "add" | "edit";

export function RepoManagementDialog({
  open,
  repos,
  onClose,
  onCreateRepo,
  onUpdateRepo,
  onDeleteRepo,
  onBrowseDirectory,
}: {
  open: boolean;
  repos: RepoConfig[];
  onClose: () => void;
  onCreateRepo: (params: {
    localPath: string;
    name?: string;
    setupScript?: string;
    envFiles?: string[];
    defaultTestCommand?: string;
  }) => Promise<RepoConfig | null>;
  onUpdateRepo: (
    repoId: string,
    params: {
      name?: string;
      setupScript?: string;
      envFiles?: string[];
      defaultTestCommand?: string;
    },
  ) => Promise<RepoConfig | null>;
  onDeleteRepo: (repoId: string) => Promise<boolean>;
  onBrowseDirectory: (path: string) => Promise<DirectoryBrowseResponse>;
}) {
  const [view, setView] = useState<RepoView>("list");
  const [editingRepo, setEditingRepo] = useState<RepoConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [localPath, setLocalPath] = useState("");
  const [name, setName] = useState("");
  const [setupScript, setSetupScript] = useState("");
  const [envFiles, setEnvFiles] = useState("");
  const [defaultTestCommand, setDefaultTestCommand] = useState("pnpm lint");

  // Picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerPath, setPickerPath] = useState("");
  const [pickerParentPath, setPickerParentPath] = useState<string | null>(null);
  const [pickerDirectories, setPickerDirectories] = useState<DirectoryEntry[]>([]);
  const [pickerShortcuts, setPickerShortcuts] = useState<Array<{ label: string; path: string }>>([]);

  const resetForm = () => {
    setLocalPath("");
    setName("");
    setSetupScript("");
    setEnvFiles("");
    setDefaultTestCommand("pnpm lint");
    setEditingRepo(null);
    setShowPicker(false);
  };

  const openAdd = () => {
    resetForm();
    setView("add");
  };

  const openEdit = (repo: RepoConfig) => {
    setEditingRepo(repo);
    setName(repo.name);
    setSetupScript(repo.setupScript);
    setEnvFiles(repo.envFiles.join(", "));
    setDefaultTestCommand(repo.defaultTestCommand);
    setView("edit");
  };

  const goBack = () => {
    resetForm();
    setView("list");
  };

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

  const handleSaveNew = async () => {
    if (!localPath.trim()) return;
    setSaving(true);
    const envFileList = envFiles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await onCreateRepo({
      localPath: localPath.trim(),
      name: name.trim() || undefined,
      setupScript: setupScript.trim() || undefined,
      envFiles: envFileList.length > 0 ? envFileList : undefined,
      defaultTestCommand: defaultTestCommand.trim() || undefined,
    });
    setSaving(false);
    if (result) {
      goBack();
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRepo) return;
    setSaving(true);
    const envFileList = envFiles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await onUpdateRepo(editingRepo.id, {
      name: name.trim(),
      setupScript: setupScript.trim(),
      envFiles: envFileList,
      defaultTestCommand: defaultTestCommand.trim(),
    });
    setSaving(false);
    if (result) {
      goBack();
    }
  };

  const handleDelete = async (repoId: string) => {
    setSaving(true);
    await onDeleteRepo(repoId);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {view === "list" && "Repositories"}
            {view === "add" && "Add Repository"}
            {view === "edit" && "Edit Repository"}
          </DialogTitle>
          <DialogDescription>
            {view === "list" && "Manage registered repositories for pipeline runs."}
            {view === "add" && "Register an existing local git repository."}
            {view === "edit" && `Editing ${editingRepo?.name}`}
          </DialogDescription>
        </DialogHeader>

        {view === "list" && (
          <>
            <ScrollArea className="max-h-[400px]">
              {repos.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  No repositories registered yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="rounded-md border p-3 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{repo.name}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => openEdit(repo)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            disabled={saving}
                            onClick={() => void handleDelete(repo.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <code className="text-[10px] text-muted-foreground font-mono break-all">
                        {repo.localPath}
                      </code>
                      <div className="flex items-center gap-2 flex-wrap">
                        {repo.gitRemote && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">
                            {repo.gitRemote.replace(/^https?:\/\//, "").replace(/\.git$/, "")}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                          {repo.defaultBranch}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <Separator />
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" className="gap-1" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add Repo
              </Button>
            </DialogFooter>
          </>
        )}

        {(view === "add" || view === "edit") && (
          <>
            {showPicker ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Browse directories</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowPicker(false)}>
                    Back to form
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/30 px-2 py-1 text-[11px] font-mono break-all">
                  {pickerPath || "(loading...)"}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={pickerLoading || !pickerParentPath} onClick={() => pickerParentPath && void loadDirectory(pickerParentPath)}>Up</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={pickerLoading} onClick={() => void loadDirectory(pickerPath || localPath || ".")}>Refresh</Button>
                  <Button size="sm" className="h-6 text-[10px]" disabled={!pickerPath} onClick={() => { setLocalPath(pickerPath); setShowPicker(false); }}>Use this folder</Button>
                </div>
                {pickerShortcuts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pickerShortcuts.map((s) => (
                      <Button key={s.path} variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => void loadDirectory(s.path)}>{s.label}</Button>
                    ))}
                  </div>
                )}
                {pickerError && <p className="text-xs text-destructive">{pickerError}</p>}
                <ScrollArea className="h-48 rounded-md border">
                  {pickerLoading ? (
                    <p className="p-3 text-xs text-muted-foreground">Loading...</p>
                  ) : pickerDirectories.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No subdirectories found.</p>
                  ) : (
                    <div className="divide-y">
                      {pickerDirectories.map((dir) => (
                        <div key={dir.path} className="flex items-center justify-between gap-2 px-2 py-1">
                          <button type="button" className="grow truncate text-left text-xs hover:text-primary" onClick={() => void loadDirectory(dir.path)} title={dir.path}>{dir.name}</button>
                          <Button variant="outline" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => { setLocalPath(dir.path); setShowPicker(false); }}>Use</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {view === "add" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">Local Path</label>
                    <div className="flex gap-2">
                      <Input
                        className="text-sm font-mono"
                        placeholder="/path/to/repo"
                        value={localPath}
                        onChange={(e) => setLocalPath(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1"
                        onClick={() => {
                          setShowPicker(true);
                          void loadDirectory(localPath || ".");
                        }}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Browse
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Display Name</label>
                  <Input
                    className="text-sm"
                    placeholder="my-api"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Setup Script</label>
                  <Textarea
                    className="text-sm font-mono min-h-[60px]"
                    placeholder="pnpm install && cp .env.example .env"
                    value={setupScript}
                    onChange={(e) => setSetupScript(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Runs in each new worktree after creation.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Env Files</label>
                  <Input
                    className="text-sm font-mono"
                    placeholder=".env, .env.local"
                    value={envFiles}
                    onChange={(e) => setEnvFiles(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Comma-separated globs copied from the main clone to each worktree.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Default Test Command</label>
                  <Input
                    className="text-sm font-mono"
                    placeholder="pnpm lint"
                    value={defaultTestCommand}
                    onChange={(e) => setDefaultTestCommand(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!showPicker && (
              <DialogFooter>
                <Button variant="outline" onClick={goBack}>
                  Back
                </Button>
                <Button
                  disabled={saving || (view === "add" && !localPath.trim())}
                  onClick={view === "add" ? handleSaveNew : handleSaveEdit}
                >
                  {view === "add" ? "Add Repo" : "Save Changes"}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
