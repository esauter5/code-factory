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
import { Input } from "@/components/ui/input";
import type { StageName } from "@/lib/harness/types";

export function SkipStageDialog({
  open,
  stageName,
  loading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  stageName: StageName;
  loading: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("Demo override");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skip {stageName}</DialogTitle>
          <DialogDescription>
            Provide a reason for skipping this stage. The run will proceed to the next stage.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for skipping..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={loading || !reason.trim()}
            onClick={() => onSubmit(reason)}
          >
            Skip stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
