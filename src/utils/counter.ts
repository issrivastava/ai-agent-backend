import { Schema, model } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  { _id: { type: String }, seq: { type: Number, default: 0 } },
  { versionKey: false },
);

export const Counter = model<ICounter>('Counter', counterSchema);

/** Atomically increments and returns the next number for a named sequence. */
export async function nextSequence(name: string) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  if (!doc) throw new Error(`Could not advance counter "${name}"`);
  return doc.seq;
}