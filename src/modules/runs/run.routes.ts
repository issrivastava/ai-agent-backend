import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { decide, getRun, listRuns } from './run.controller';

export const runsRouter = Router();

// Every signed-in role can read runs. Approving or rejecting needs runs:decide.
runsRouter.use(authenticate);
runsRouter.get('/', listRuns);
runsRouter.get('/:id', getRun);
runsRouter.post('/:id/decision', requirePermission('runs:decide'), decide);