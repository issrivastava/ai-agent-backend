import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error';
import { param } from '../../utils/params';
import {
  Extraction,
  nextExtractionNumber,
  toPublicExtraction,
} from './extraction.model';
import { advanceExtraction } from './extraction.processor';

// "EXT-003" -> 3. Anything else is simply "not found".
function parseExtractionNumber(raw: string) {
  const match = /^EXT-(\d+)$/i.exec(raw);
  if (!match) throw HttpError.notFound('Extraction job not found');
  return Number(match[1]);
}

export const listExtractions: RequestHandler = async (_req, res) => {
  const docs = await Extraction.find().sort({ createdAt: -1, number: -1 }).limit(500);
  const advanced = await Promise.all(docs.map(advanceExtraction));
  res.json(advanced.map(toPublicExtraction));
};

export const getExtraction: RequestHandler = async (req, res) => {
  const doc = await Extraction.findOne({ number: parseExtractionNumber(param(req, 'id')) });
  if (!doc) throw HttpError.notFound('Extraction job not found');
  res.json(toPublicExtraction(await advanceExtraction(doc)));
};

export const createExtraction: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) throw HttpError.badRequest('No file uploaded');

  const doc = await Extraction.create({
    number: await nextExtractionNumber(),
    fileName: file.originalname.slice(0, 255),
    fileSize: file.size,
    mimeType: file.mimetype,
    createdBy: req.user?.id,
  });
  res.status(201).json(toPublicExtraction(doc));
};