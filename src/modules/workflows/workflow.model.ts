import { Schema, model, type HydratedDocument } from 'mongoose';
import { nextSequence } from '../../utils/counter';

// Keep these lists identical to the frontend's types/workflow.ts.
export const workflowTypes = ['dispatch', 'extraction'] as const;
export const workflowStatuses = ['draft', 'active', 'paused'] as const;
export const agentRoles = ['triage', 'billing', 'dispatch', 'extractor'] as const;
export const workflowTools = [
  'ticket_lookup',
  'assign_ticket',
  'invoice_search',
  'refund_api',
  'email_sender',
  'pdf_reader',
  'ocr',
  'slot_search',
] as const;

export type WorkflowType = (typeof workflowTypes)[number];
export type WorkflowStatus = (typeof workflowStatuses)[number];
export type AgentRole = (typeof agentRoles)[number];

export interface IWorkflowAgent {
  role: AgentRole;
  prompt: string;
  tools: string[];
}

export interface IWorkflow {
  number: number;
  name: string;
  description: string;
  type: WorkflowType;
  status: WorkflowStatus;
  agents: IWorkflowAgent[];
  createdAt: Date;
  updatedAt: Date;
}

const agentSchema = new Schema<IWorkflowAgent>(
  {
    role: { type: String, enum: agentRoles, required: true },
    prompt: { type: String, required: true, trim: true, minlength: 10, maxlength: 4000 },
    tools: { type: [{ type: String, enum: workflowTools }], default: [] },
  },
  { _id: false }, // agents are identified by their position in the list
);

const workflowSchema = new Schema<IWorkflow>(
  {
    number: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 300 },
    type: { type: String, enum: workflowTypes, required: true },
    status: { type: String, enum: workflowStatuses, default: 'draft', required: true },
    agents: {
      type: [agentSchema],
      validate: {
        validator: (agents: unknown[]) => agents.length >= 1,
        message: 'A workflow needs at least one agent',
      },
    },
  },
  { timestamps: true },
);

workflowSchema.index({ updatedAt: -1 });

export const Workflow = model<IWorkflow>('Workflow', workflowSchema);

export const nextWorkflowNumber = () => nextSequence('workflow');
export const formatWorkflowId = (n: number) => `WF-${String(n).padStart(3, '0')}`;

// The shape the frontend's `Workflow` type expects.
export function toPublicWorkflow(w: HydratedDocument<IWorkflow>) {
  return {
    id: formatWorkflowId(w.number),
    name: w.name,
    description: w.description,
    type: w.type,
    status: w.status,
    agents: w.agents.map((a) => ({ role: a.role, prompt: a.prompt, tools: [...a.tools] })),
    updatedAt: w.updatedAt.toISOString(),
  };
}