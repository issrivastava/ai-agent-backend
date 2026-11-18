import { z } from 'zod';
import { agentRoles, workflowStatuses, workflowTools, workflowTypes } from './workflow.model';

const agentInput = z.object({
  role: z.enum(agentRoles),
  prompt: z
    .string()
    .trim()
    .min(10, 'Describe what this agent should do (10+ characters)')
    .max(4000, 'Prompt is too long'),
  // Only known tools are accepted, and duplicates are dropped.
  tools: z.array(z.enum(workflowTools)).transform((tools) => [...new Set(tools)]),
});

export const workflowInputSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(80, 'Name is too long'),
  description: z.string().trim().max(300, 'Keep the description under 300 characters'),
  type: z.enum(workflowTypes),
  status: z.enum(workflowStatuses),
  agents: z.array(agentInput).min(1, 'Add at least one agent'),
});

// PATCH accepts any subset of the fields, but not an empty body.
export const updateWorkflowSchema = workflowInputSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });