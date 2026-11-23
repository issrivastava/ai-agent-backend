import { Schema, model, type HydratedDocument } from 'mongoose';
import { nextSequence } from '../../utils/counter';

// Keep these identical to the frontend's types/extraction.ts.
export const extractionStatuses = ['queued', 'processing', 'completed', 'failed'] as const;
export type ExtractionStatus = (typeof extractionStatuses)[number];

export interface IExtractedField {
  field: string;
  value: string;
  confidence: number;
}

export interface IExtraction {
  number: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: ExtractionStatus;
  error?: string;
  fields: IExtractedField[];
  finishedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fieldSchema = new Schema<IExtractedField>(
  {
    field: { type: String, required: true },
    value: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const extractionSchema = new Schema<IExtraction>(
  {
    number: { type: Number, required: true, unique: true },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    fileSize: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true },
    status: { type: String, enum: extractionStatuses, default: 'queued', required: true },
    error: { type: String },
    fields: { type: [fieldSchema], default: [] },
    finishedAt: { type: Date },
    createdBy: { type: String },
  },
  { timestamps: true },
);

extractionSchema.index({ createdAt: -1 });

export const Extraction = model<IExtraction>('Extraction', extractionSchema);

/** IDs are EXT-001, EXT-002, ... */
export const nextExtractionNumber = () => nextSequence('extraction');

export const formatExtractionId = (n: number) => `EXT-${String(n).padStart(3, '0')}`;

// The shape the frontend's `ExtractionJob` type expects.
export function toPublicExtraction(e: HydratedDocument<IExtraction>) {
  return {
    id: formatExtractionId(e.number),
    fileName: e.fileName,
    fileSize: e.fileSize,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    finishedAt: e.finishedAt?.toISOString(),
    error: e.error,
    fields: e.fields.map((f) => ({ field: f.field, value: f.value, confidence: f.confidence })),
  };
}