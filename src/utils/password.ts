import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Compared against when an email doesn't exist, so response time doesn't reveal
// which emails are registered.
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);