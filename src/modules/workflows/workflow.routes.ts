import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { startRun } from '../runs/run.controller';
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
} from './workflow.controller';

export const workflowsRouter = Router();

// Every signed-in role can read workflows. Changing them needs workflows:manage.
workflowsRouter.use(authenticate);
workflowsRouter.get('/', listWorkflows);
workflowsRouter.get('/:id', getWorkflow);
workflowsRouter.post('/', requirePermission('workflows:manage'), createWorkflow);
workflowsRouter.patch('/:id', requirePermission('workflows:manage'), updateWorkflow);
workflowsRouter.delete('/:id', requirePermission('workflows:manage'), deleteWorkflow);
workflowsRouter.post('/:id/run', requirePermission('workflows:run'), startRun);