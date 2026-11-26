import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../../utils/http-error';
import { param } from '../../utils/params';
import { Ticket } from '../tickets/ticket.model';
import { Workflow } from '../workflows/workflow.model';
import { parseWorkflowNumber } from '../workflows/workflow.controller';
import { Run, formatRunId, toPublicRun } from './run.model';
import { decisionSchema } from './run.schemas';
import { createRun, decideRun } from './run.service';

const startRunSchema = z.object({
  ticketId: z
    .string()
    .regex(/^TCK-\d+$/i)
    .optional(),
});

function parseRunNumber(raw: string) {
  const match = /^RUN-(\d+)$/i.exec(raw);
  if (!match) throw HttpError.notFound('Run not found');
  return Number(match[1]);
}

// POST /workflows/:id/run   body (optional): { "ticketId": "TCK-1001" }
export const startRun: RequestHandler = async (req, res) => {
  if (!req.user) throw HttpError.unauthorized();
  const { ticketId } = startRunSchema.parse(req.body ?? {});

  const workflow = await Workflow.findOne({ number: parseWorkflowNumber(param(req, 'id')) });
  if (!workflow) throw HttpError.notFound('Workflow not found');
  if (workflow.status !== 'active') throw HttpError.badRequest('Only active workflows can be run');

  // Only dispatch workflows work on a ticket. Extraction workflows stay simulated for now.
  let ticketNumber: number | undefined;
  if (workflow.type === 'dispatch') {
    const ticket = ticketId
      ? await Ticket.findOne({ number: Number(ticketId.slice(4)) })
      : await Ticket.findOne({ status: 'open' }).sort({ createdAt: -1 }); // stopgap until the UI has a picker
    if (!ticket) {
      throw HttpError.notFound(ticketId ? 'Ticket not found' : 'There is no open ticket to work on');
    }
    ticketNumber = ticket.number;
  }

  const run = await createRun(workflow, req.user.id, ticketNumber);
  res.status(201).json({ runId: formatRunId(run.number) });
};

export const listRuns: RequestHandler = async (_req, res) => {
  const runs = await Run.find().sort({ startedAt: -1 }).limit(200);
  res.json(runs.map(toPublicRun));
};

export const getRun: RequestHandler = async (req, res) => {
  const run = await Run.findOne({ number: parseRunNumber(param(req, 'id')) });
  if (!run) throw HttpError.notFound('Run not found');
  res.json(toPublicRun(run));
};

export const decide: RequestHandler = async (req, res) => {
  const { decision } = decisionSchema.parse(req.body);
  const run = await Run.findOne({ number: parseRunNumber(param(req, 'id')) });
  if (!run) throw HttpError.notFound('Run not found');

  try {
    await decideRun(run, decision);
  } catch (err) {
    // The executor or another reviewer changed this run a moment ago.
    if (err instanceof mongoose.Error.VersionError) {
      throw HttpError.conflict('This run was just updated. Refresh and try again.');
    }
    throw err;
  }
  res.json(toPublicRun(run));
};