import type { HydratedDocument } from 'mongoose';
import { Extraction, type IExtraction, type IExtractedField } from './extraction.model';

const QUEUED_MS = 1500;
const PROCESSING_MS = 6000;

// Placeholder output until a real extraction engine is connected (Step 4).
function sampleFields(fileName: string): IExtractedField[] {
  return [
    { field: 'Document', value: fileName.replace(/\.[^.]+$/, ''), confidence: 0.99 },
    { field: 'Vendor', value: 'Sharma Logistics Pvt Ltd', confidence: 0.97 },
    { field: 'Invoice number', value: 'INV-2026-0142', confidence: 0.95 },
    { field: 'Invoice date', value: '2026-11-05', confidence: 0.93 },
    { field: 'Subtotal', value: '₹42,500.00', confidence: 0.9 },
    { field: 'GST (18%)', value: '₹7,650.00', confidence: 0.82 },
    { field: 'Total', value: '₹50,150.00', confidence: 0.96 },
    { field: 'Payment terms', value: 'Net 30', confidence: 0.64 },
  ];
}

/** Moves a job forward based on its age. Final states are saved and never change again. */
export async function advanceExtraction(doc: HydratedDocument<IExtraction>) {
  if (doc.status === 'completed' || doc.status === 'failed') return doc;

  const elapsed = Date.now() - doc.createdAt.getTime();

  if (elapsed < QUEUED_MS) {
    doc.status = 'queued';
    return doc;
  }
  if (elapsed < PROCESSING_MS) {
    if (doc.status !== 'processing') {
      await Extraction.updateOne({ _id: doc._id, status: 'queued' }, { status: 'processing' });
      doc.status = 'processing';
    }
    return doc;
  }

  const failed = /fail/i.test(doc.fileName);
  const update = failed
    ? {
        status: 'failed' as const,
        error: 'Could not read this document. The file may be corrupted or password-protected.',
        finishedAt: new Date(),
      }
    : { status: 'completed' as const, fields: sampleFields(doc.fileName), finishedAt: new Date() };

  // Only the first request to get here writes the result. Later ones see it already final.
  const updated = await Extraction.findOneAndUpdate(
    { _id: doc._id, status: { $in: ['queued', 'processing'] } },
    update,
    { new: true },
  );
  return updated ?? (await Extraction.findById(doc._id)) ?? doc;
}