export interface JobStatus {
  jobId: string;
  status: 'received' | 'transcribing' | 'saving' | 'completed' | 'failed';
  message: string;
  progress: number;
  error?: string;
}

const jobs = new Map<string, JobStatus>();

export function createJob(jobId: string): void {
  jobs.set(jobId, { jobId, status: 'received', message: 'Job created', progress: 0 });
  // Auto-cleanup after 10 minutes
  setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
}

export function updateJob(jobId: string, update: Partial<Omit<JobStatus, 'jobId'>>): void {
  const existing = jobs.get(jobId);
  if (!existing) return;
  jobs.set(jobId, { ...existing, ...update });
}

export function getJob(jobId: string): JobStatus | null {
  return jobs.get(jobId) ?? null;
}
