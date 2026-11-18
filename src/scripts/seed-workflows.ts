import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { Workflow, nextWorkflowNumber, type IWorkflow } from '../modules/workflows/workflow.model';
import { Counter } from '../utils/counter';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to create demo workflows in production.');
  process.exit(1);
}

type Seed = Pick<IWorkflow, 'name' | 'description' | 'type' | 'status' | 'agents'>;

const seeds: Seed[] = [
  {
    name: 'Support ticket triage',
    description: 'Classifies incoming tickets and routes them to the right team.',
    type: 'dispatch',
    status: 'active',
    agents: [
      { role: 'triage', prompt: 'Classify the ticket by topic and urgency.', tools: ['ticket_lookup'] },
      { role: 'billing', prompt: 'Handle billing and refund questions.', tools: ['invoice_search', 'refund_api'] },
      { role: 'dispatch', prompt: 'Assign the ticket to the best available human or agent.', tools: ['assign_ticket'] },
    ],
  },
  {
    name: 'Invoice data extraction',
    description: 'Extracts line items and totals from uploaded invoices.',
    type: 'extraction',
    status: 'active',
    agents: [
      { role: 'extractor', prompt: 'Extract vendor, date, line items, and total as JSON.', tools: ['pdf_reader', 'ocr'] },
    ],
  },
  {
    name: 'Warehouse slot dispatch',
    description: 'Matches booking requests to available warehouse slots.',
    type: 'dispatch',
    status: 'draft',
    agents: [{ role: 'dispatch', prompt: 'Find the closest available slot.', tools: ['slot_search'] }],
  },
];

async function main() {
  await connectDb();
  await Workflow.init();

  if (process.argv.includes('--reset')) {
    await Workflow.deleteMany({});
    await Counter.deleteOne({ _id: 'workflow' });
    console.log('Removed existing workflows');
  } else if ((await Workflow.estimatedDocumentCount()) > 0) {
    console.log('Workflows already exist. Run with --reset to replace them.');
    await disconnectDb();
    return;
  }

  for (const seed of seeds) {
    const workflow = await Workflow.create({ ...seed, number: await nextWorkflowNumber() });
    console.log(`created  WF-${String(workflow.number).padStart(3, '0')}  ${workflow.name}`);
  }

  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});