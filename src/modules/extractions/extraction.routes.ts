import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { createExtraction, getExtraction, listExtractions } from './extraction.controller';
import { uploadSingleFile } from './extraction.upload';

export const extractionsRouter = Router();

// Everyone signed in can read. Only roles with extractions:upload (admin, agent) can upload.
extractionsRouter.use(authenticate);
extractionsRouter.get('/', listExtractions);
extractionsRouter.get('/:id', getExtraction);
extractionsRouter.post('/', requirePermission('extractions:upload'), uploadSingleFile, createExtraction);