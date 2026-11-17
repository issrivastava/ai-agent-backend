import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import {
  Ticket,
  nextTicketNumber,
  ticketPriorities,
  ticketStatuses,
  type TicketAgent,
} from '../modules/tickets/ticket.model';
import { Counter } from '../utils/counter';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to create demo tickets in production.');
  process.exit(1);
}

const templates: { subject: string; detail: string; agent: TicketAgent }[] = [
  { subject: 'Refund not received', detail: 'The refund for a cancelled booking has not reached the account after 7 days.', agent: 'Billing Agent' },
  { subject: 'Cannot log in to account', detail: 'Login fails with "invalid credentials" even after resetting the password.', agent: 'Triage Agent' },
  { subject: 'Invoice amount mismatch', detail: 'The invoice total does not match the quoted storage price for this month.', agent: 'Billing Agent' },
  { subject: 'Warehouse slot not confirmed', detail: 'Booked a loading slot for Thursday but still have no confirmation.', agent: 'Dispatch Agent' },
  { subject: 'Request to reschedule pickup', detail: 'Need to move the pickup from Monday morning to Tuesday afternoon.', agent: 'Dispatch Agent' },
  { subject: 'Duplicate payment charged', detail: 'The card was charged twice for the same booking reference.', agent: 'Billing Agent' },
  { subject: 'GST invoice needed', detail: 'Please issue a GST-compliant invoice for last quarter\'s bookings.', agent: 'Billing Agent' },
  { subject: 'Goods delayed at dock', detail: 'The truck has been waiting at the dock for three hours with no unloading.', agent: 'Dispatch Agent' },
  { subject: 'Password reset email not arriving', detail: 'No reset email arrives, and the spam folder is empty.', agent: 'Triage Agent' },
  { subject: 'Wrong warehouse location listed', detail: 'The listing shows the wrong address, so the driver went to the wrong site.', agent: 'Triage Agent' },
];

const customers = [
  'Rohan Mehta', 'Priya Nair', 'Sharma Traders', 'Kapoor Logistics', 'Anita Desai',
  'Vijay Enterprises', 'Meera Iyer', 'Patel & Sons', 'Sanjay Gupta', 'Neha Verma',
];

const COUNT = 30;
const SEVEN_HOURS = 7 * 60 * 60 * 1000;

async function main() {
  await connectDb();
  await Ticket.init(); // makes sure the indexes exist

  if (process.argv.includes('--reset')) {
    await Ticket.deleteMany({});
    await Counter.deleteOne({ _id: 'ticket' });
    console.log('Removed existing tickets');
  } else if ((await Ticket.estimatedDocumentCount()) > 0) {
    console.log('Tickets already exist. Run with --reset to replace them.');
    await disconnectDb();
    return;
  }

  const now = Date.now();
  for (let i = 0; i < COUNT; i++) {
    const t = templates[i % templates.length];
    const customer = customers[(i * 3) % customers.length];
    await Ticket.create({
      number: await nextTicketNumber(),
      subject: t.subject,
      description: `${customer} wrote in: ${t.detail}`,
      customer,
      status: ticketStatuses[i % ticketStatuses.length],
      priority: ticketPriorities[(i * 3 + 1) % ticketPriorities.length],
      assignedAgent: t.agent,
      // Oldest ticket gets the lowest number.
      createdAt: new Date(now - (COUNT - i) * SEVEN_HOURS),
    });
  }

  console.log(`created ${COUNT} tickets (TCK-1001 to TCK-${1000 + COUNT})`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});