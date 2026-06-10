export type IngestionJob = {
  uid: string;
  documentId: string;
  runAfterMs: number;
};

/**
 * In-process durable queue (SPEC C11 MVP). Jobs are keyed by uid+documentId.
 */
export class DocumentIngestionJobStore {
  private readonly jobs = new Map<string, IngestionJob>();

  private jobKey(uid: string, documentId: string): string {
    return `${uid}:${documentId}`;
  }

  schedule(job: IngestionJob): void {
    const key = this.jobKey(job.uid, job.documentId);
    const existing = this.jobs.get(key);
    if (!existing || job.runAfterMs <= existing.runAfterMs) {
      this.jobs.set(key, job);
    }
  }

  pollReady(nowMs = Date.now()): IngestionJob | undefined {
    for (const [key, job] of this.jobs.entries()) {
      if (job.runAfterMs <= nowMs) {
        this.jobs.delete(key);
        return job;
      }
    }
    return undefined;
  }

  hasPending(): boolean {
    return this.jobs.size > 0;
  }
}
