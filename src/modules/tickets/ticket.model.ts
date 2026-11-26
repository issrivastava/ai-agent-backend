import { Schema, model, type HydratedDocument } from 'mongoose';
import { nextSequence } from '../../utils/counter';

// Keep these three lists identical to the frontend's types/ticket.ts.
export const ticketStatuses = ['open', 'pending', 'escalated', 'resolved', 'closed'] as const;
export const ticketPriorities = ['low', 'medium', 'high', 'urgent'] as const;
export const ticketAgents = ['Triage Agent', 'Billing Agent', 'Dispatch Agent'] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketPriority = (typeof ticketPriorities)[number];
export type TicketAgent = (typeof ticketAgents)[number];

export interface ITicket {
  number: number;
  subject: string;
  description: string;
  customer: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedAgent: TicketAgent;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    number: { type: Number, required: true, unique: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    customer: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ticketStatuses, default: 'open', required: true },
    priority: { type: String, enum: ticketPriorities, default: 'medium', required: true },
    assignedAgent: { type: String, enum: ticketAgents, required: true },
  },
  { timestamps: true },
);

// Serves the list page: filter by status and/or priority, newest first.
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });

export const Ticket = model<ITicket>('Ticket', ticketSchema);

/** Ticket numbers start at 1001, so the first ticket is TCK-1001. */
export const nextTicketNumber = async () => 1000 + (await nextSequence('ticket'));
export const formatTicketId = (n: number) => `TCK-${n}`;

// The shape the frontend's `Ticket` type expects.
export function toPublicTicket(t: HydratedDocument<ITicket>) {
  return {
    id: formatTicketId(t.number),
    subject: t.subject,
    description: t.description,
    customer: t.customer,
    status: t.status,
    priority: t.priority,
    assignedAgent: t.assignedAgent,
    createdAt: t.createdAt.toISOString(),
  };
}