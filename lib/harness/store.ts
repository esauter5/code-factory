import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RunRecord, StoreShape } from "@/lib/harness/types";

function defaultData(): StoreShape {
  return { runs: [] };
}

export class JsonRunStore {
  private filePath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async withLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }

  private async ensureStoreFile(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, "utf8");
    } catch {
      await this.writeData(defaultData());
    }
  }

  private async readData(): Promise<StoreShape> {
    await this.ensureStoreFile();
    const raw = await readFile(this.filePath, "utf8");
    try {
      const parsed = JSON.parse(raw) as StoreShape;
      if (!Array.isArray(parsed.runs)) {
        return defaultData();
      }
      return parsed;
    } catch {
      return defaultData();
    }
  }

  private async writeData(data: StoreShape): Promise<void> {
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmpPath, this.filePath);
    try {
      await unlink(tmpPath);
    } catch {
      // no-op
    }
  }

  async listRuns(): Promise<RunRecord[]> {
    return this.withLock(async () => {
      const data = await this.readData();
      return structuredClone(data.runs);
    });
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    return this.withLock(async () => {
      const data = await this.readData();
      const found = data.runs.find((run) => run.id === runId);
      return found ? structuredClone(found) : null;
    });
  }

  async createRun(run: RunRecord): Promise<RunRecord> {
    return this.withLock(async () => {
      const data = await this.readData();
      data.runs.push(structuredClone(run));
      await this.writeData(data);
      return structuredClone(run);
    });
  }

  async saveRun(run: RunRecord): Promise<RunRecord> {
    return this.withLock(async () => {
      const data = await this.readData();
      const idx = data.runs.findIndex((item) => item.id === run.id);
      if (idx === -1) {
        data.runs.push(structuredClone(run));
      } else {
        data.runs[idx] = structuredClone(run);
      }
      await this.writeData(data);
      return structuredClone(run);
    });
  }
}
