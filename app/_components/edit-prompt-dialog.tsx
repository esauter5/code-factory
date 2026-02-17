"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { StageName } from "@/lib/harness/types";

export function EditPromptDialog({
  open,
  stageName,
  currentPrompt,
  loading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  stageName: StageName;
  currentPrompt: string;
  loading: boolean;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState(currentPrompt);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit prompt for {stageName}</DialogTitle>
          <DialogDescription>
            Modify the prompt that will be used when this stage is retried.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-[200px] font-mono text-xs"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={loading || !prompt.trim()}
            onClick={() => onSubmit(prompt)}
          >
            Save prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
