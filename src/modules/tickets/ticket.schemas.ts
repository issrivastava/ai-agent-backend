import { z } from 'zod';
import { ticketAgents, ticketPriorities, ticketStatuses } from './ticket.model';

export const listQuerySchema = z.object({
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
});

export const updateTicketSchema = z
  .object({
    assignedAgent: z.enum(ticketAgents).optional(),
    status: z.enum(ticketStatuses).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });