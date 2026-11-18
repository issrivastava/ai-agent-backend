import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error';
import { param } from '../../utils/params';
import { Workflow, nextWorkflowNumber, toPublicWorkflow } from './workflow.model';
import { updateWorkflowSchema, workflowInputSchema } from './workflow.schemas';

// "WF-002" -> 2. Anything else is simply "not found".
function parseWorkflowNumber(raw: string) {
  const match = /^WF-(\d+)$/i.exec(raw);
  if (!match) throw HttpError.notFound('Workflow not found');
  return Number(match[1]);
}

export const listWorkflows: RequestHandler = async (_req, res) => {
  const workflows = await Workflow.find().sort({ updatedAt: -1 }).limit(500);
  res.json(workflows.map(toPublicWorkflow));
};

export const getWorkflow: RequestHandler = async (req, res) => {
  const workflow = await Workflow.findOne({ number: parseWorkflowNumber(param(req, 'id')) });
  if (!workflow) throw HttpError.notFound('Workflow not found');
  res.json(toPublicWorkflow(workflow));
};

export const createWorkflow: RequestHandler = async (req, res) => {
  const input = workflowInputSchema.parse(req.body);
  const workflow = await Workflow.create({ ...input, number: await nextWorkflowNumber() });
  res.status(201).json(toPublicWorkflow(workflow));
};

export const updateWorkflow: RequestHandler = async (req, res) => {
  const update = updateWorkflowSchema.parse(req.body);
  const workflow = await Workflow.findOneAndUpdate(
    { number: parseWorkflowNumber(param(req, 'id')) },
    { $set: update },
    { new: true, runValidators: true },
  );
  if (!workflow) throw HttpError.notFound('Workflow not found');
  res.json(toPublicWorkflow(workflow));
};

export const deleteWorkflow: RequestHandler = async (req, res) => {
  const result = await Workflow.deleteOne({ number: parseWorkflowNumber(param(req, 'id')) });
  if (result.deletedCount === 0) throw HttpError.notFound('Workflow not found');
  res.status(204).end();
};