import mongoose from 'mongoose';
import { Run } from './run.model';
import { advanceRun } from './run.service';

const TICK_MS = 1000;

/** Starts the background loop that advances runs. Returns a function that stops it. */
export function startRunExecutor() {
  let busy = false; // never let two ticks overlap

  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const due = await Run.find({ status: 'running', stepDueAt: { $lte: new Date() } }).limit(50);
      for (const run of due) {
        try {
          await advanceRun(run);
        } catch (err) {
          // A VersionError means someone else (another instance, or a reviewer) changed the run first.
          if (!(err instanceof mongoose.Error.VersionError)) console.error('Run executor error:', err);
        }
      }
    } catch (err) {
      console.error('Run executor tick failed:', err);
    } finally {
      busy = false;
    }
  }, TICK_MS);

  console.log('Run executor started');
  return () => clearInterval(timer);
}