import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { getTicket, listTickets, updateTicket } from './ticket.controller';

export const ticketsRouter = Router();

// Every role can read tickets. Only roles with tickets:reassign can change them.
ticketsRouter.use(authenticate);
ticketsRouter.get('/', listTickets);
ticketsRouter.get('/:id', getTicket);
ticketsRouter.patch('/:id', requirePermission('tickets:reassign'), updateTicket);