import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { User } from '../modules/users/user.model';
import { hashPassword } from '../utils/password';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to create demo accounts in production.');
  process.exit(1);
}

const demoUsers = [
  { name: 'Asha Admin', email: 'admin@example.com', password: 'Admin123', role: 'admin' },
  { name: 'Arjun Agent', email: 'agent@example.com', password: 'Agent123', role: 'agent' },
  { name: 'Vikram Viewer', email: 'viewer@example.com', password: 'Viewer123', role: 'viewer' },
] as const;

async function main() {
  await connectDb();
  await User.init(); // makes sure the unique email index exists

  for (const { password, ...rest } of demoUsers) {
    if (await User.exists({ email: rest.email })) {
      console.log(`skipped  ${rest.email} (already exists)`);
      continue;
    }
    await User.create({ ...rest, passwordHash: await hashPassword(password) });
    console.log(`created  ${rest.email} (${rest.role})`);
  }

  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});