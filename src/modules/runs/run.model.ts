import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { nextSequence } from '../../utils/counter';
import { formatWorkflowId } from '../workflows/workflow.model';

// Keep these identical to the frontend's types/run.ts.
export const runStatuses = ['running', 'waiting_approval', 'completed', 'failed'] as const;
export const stepStatuses = ['pending', 'running', 'waiting_approval', 'completed', 'failed'] as const;

export type RunStatus = (typeof runStatuses)[number];
export type StepStatus = (typeof stepStatuses)[number];

export interface IRunStep {
  agent: string;
  action: string;
  tool?: string;
  status: StepStatus;
  durationMs?: number;
  output?: string;
  requiresApproval: boolean;
  approval?: 'approved' | 'rejected';
  startedAt?: Date; // internal, used to compute durationMs
}

export interface IRun {
  number: number;
  workflowNumber: number;
  workflowName: string;
  status: RunStatus;
  cursor: number; // index of the step currently in progress
  stepDueAt: Date | null; // when the current step finishes. null while waiting for a human
  startedBy: Types.ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  steps: IRunStep[];
}

const stepSchema = new Schema<IRunStep>(
  {
    agent: { type: String, required: true },
    action: { type: String, required: true },
    tool: { type: String },
    status: { type: String, enum: stepStatuses, required: true },
    durationMs: { type: Number },
    output: { type: String },
    requiresApproval: { type: Boolean, required: true },
    approval: { type: String, enum: ['approved', 'rejected'] },
    startedAt: { type: Date },
  },
  { _id: false },
);

const runSchema = new Schema<IRun>(
  {
    number: { type: Number, required: true, unique: true },
    workflowNumber: { type: Number, required: true },
    workflowName: { type: String, required: true },
    status: { type: String, enum: runStatuses, required: true },
    cursor: { type: Number, required: true, default: 0 },
    stepDueAt: { type: Date, default: null },
    startedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    finishedAt: { type: Date },
    steps: { type: [stepSchema], required: true },
  },
  // A save fails with a VersionError if the document changed since it was loaded.
  { optimisticConcurrency: true },
);

runSchema.index({ startedAt: -1 }); // the list page
runSchema.index({ status: 1, stepDueAt: 1 }); // the executor's "what is due?" query

export const Run = model<IRun>('Run', runSchema);

/** Run numbers start at 101, so the first run is RUN-101. */
export const nextRunNumber = async () => 100 + (await nextSequence('run'));
export const formatRunId = (n: number) => `RUN-${n}`;

// The shape the frontend's `Run` type expects.
export function toPublicRun(r: HydratedDocument<IRun>) {
  const id = formatRunId(r.number);
  return {
    id,
    workflowId: formatWorkflowId(r.workflowNumber),
    workflowName: r.workflowName,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString(),
    steps: r.steps.map((s, i) => ({
      id: `${id}-s${i + 1}`,
      agent: s.agent,
      action: s.action,
      tool: s.tool,
      status: s.status,
      durationMs: s.durationMs,
      output: s.output,
      requiresApproval: s.requiresApproval,
      approval: s.approval,
    })),
  };
}