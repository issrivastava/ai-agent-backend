import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { HttpError } from '../../utils/http-error';
import { param } from '../../utils/params';
import { Workflow } from '../workflows/workflow.model';
import { parseWorkflowNumber } from '../workflows/workflow.controller';
import { Run, formatRunId, toPublicRun } from './run.model';
import { decisionSchema } from './run.schemas';
import { createRun, decideRun } from './run.service';

function parseRunNumber(raw: string) {
  const match = /^RUN-(\d+)$/i.exec(raw);
  if (!match) throw HttpError.notFound('Run not found');
  return Number(match[1]);
}

// POST /workflows/:id/run
export const startRun: RequestHandler = async (req, res) => {
  if (!req.user) throw HttpError.unauthorized();

  const workflow = await Workflow.findOne({ number: parseWorkflowNumber(param(req, 'id')) });
  if (!workflow) throw HttpError.notFound('Workflow not found');
  if (workflow.status !== 'active') throw HttpError.badRequest('Only active workflows can be run');

  const run = await createRun(workflow, req.user.id);
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