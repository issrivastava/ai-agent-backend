import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { Extraction } from '../modules/extractions/extraction.model';
import { Counter } from '../utils/counter';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to create demo extractions in production.');
  process.exit(1);
}

const sample = (name: string) => [
  { field: 'Document', value: name.replace(/\.[^.]+$/, ''), confidence: 0.99 },
  { field: 'Vendor', value: 'Sharma Logistics Pvt Ltd', confidence: 0.97 },
  { field: 'Invoice number', value: 'INV-2026-0142', confidence: 0.95 },
  { field: 'Invoice date', value: '2026-11-05', confidence: 0.93 },
  { field: 'Subtotal', value: '₹42,500.00', confidence: 0.9 },
  { field: 'GST (18%)', value: '₹7,650.00', confidence: 0.82 },
  { field: 'Total', value: '₹50,150.00', confidence: 0.96 },
  { field: 'Payment terms', value: 'Net 30', confidence: 0.64 },
];

async function main() {
  await connectDb();
  await Extraction.init();

  if (process.argv.includes('--reset')) {
    await Extraction.deleteMany({});
    await Counter.deleteOne({ _id: 'extraction' });
  } else if ((await Extraction.estimatedDocumentCount()) > 0) {
    console.log('Extractions already exist. Run with --reset to replace them.');
    await disconnectDb();
    return;
  }

  const jobs = [
    { n: 1, name: 'invoice-october.pdf', size: 184_320, mime: 'application/pdf', at: '2026-11-10T09:15:00.000Z', ok: true },
    { n: 2, name: 'warehouse-receipt.png', size: 902_144, mime: 'image/png', at: '2026-11-11T12:30:00.000Z', ok: true },
    { n: 3, name: 'scan-corrupted.pdf', size: 52_224, mime: 'application/pdf', at: '2026-11-12T16:05:00.000Z', ok: false },
  ];

  for (const j of jobs) {
    const created = new Date(j.at);
    await Extraction.create({
      number: j.n,
      fileName: j.name,
      fileSize: j.size,
      mimeType: j.mime,
      status: j.ok ? 'completed' : 'failed',
      fields: j.ok ? sample(j.name) : [],
      error: j.ok ? undefined : 'Could not read this document. The file may be corrupted or password-protected.',
      finishedAt: new Date(created.getTime() + 8000),
      createdAt: created,
    });
  }
  await Counter.findOneAndUpdate({ _id: 'extraction' }, { seq: jobs.length }, { upsert: true });

  console.log('created 3 extraction jobs (EXT-001 to EXT-003)');
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});