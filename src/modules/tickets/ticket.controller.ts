import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error';
import { listQuerySchema, updateTicketSchema } from './ticket.schemas';
import { Ticket, toPublicTicket } from './ticket.model';

// "TCK-1005" -> 1005. Anything else is simply "not found".
function parseTicketNumber(raw: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = /^TCK-(\d+)$/i.exec(value ?? '');
  if (!match) throw HttpError.notFound('Ticket not found');
  return Number(match[1]);
}

export const listTickets: RequestHandler = async (req, res) => {
  const filter = listQuerySchema.parse(req.query);
  // The frontend table paginates and searches in the browser, so it gets the full list.
  // The limit is a safety cap. Server-side pagination comes when volumes demand it.
  const tickets = await Ticket.find(filter).sort({ createdAt: -1, number: -1 }).limit(1000);
  res.json(tickets.map(toPublicTicket));
};

export const getTicket: RequestHandler = async (req, res) => {
  const ticket = await Ticket.findOne({ number: parseTicketNumber(req.params.id) });
  if (!ticket) throw HttpError.notFound('Ticket not found');
  res.json(toPublicTicket(ticket));
};

export const updateTicket: RequestHandler = async (req, res) => {
  const update = updateTicketSchema.parse(req.body);
  const ticket = await Ticket.findOneAndUpdate(
    { number: parseTicketNumber(req.params.id) },
    update,
    { new: true, runValidators: true },
  );
  if (!ticket) throw HttpError.notFound('Ticket not found');
  res.json(toPublicTicket(ticket));
};