import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

async function main() {
  const [email, newPassword] = process.argv.slice(2);
  const uri = process.env.MONGODB_URI;

  if (!uri) throw new Error('Set MONGODB_URI in this terminal first.');
  if (!email || !newPassword) {
    throw new Error('Usage: npm run set-password -- <email> <new-password>');
  }
  if (newPassword.length < 10) throw new Error('Use a password of at least 10 characters.');

  await mongoose.connect(uri);
  const users = mongoose.connection.collection('users');

  const user = await users.findOne({ email: email.toLowerCase() });
  if (!user) throw new Error(`No user found with email ${email}`);

  // Your user documents store the hash under either of these names.
  const field = 'passwordHash' in user ? 'passwordHash' : 'password';
  const hash = await bcrypt.hash(newPassword, 12);

  await users.updateOne({ _id: user._id }, { $set: { [field]: hash } });
  console.log(`Password updated for ${email} (field: ${field})`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});