//MongoDB connection
import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb() {
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB connected (${mongoose.connection.name})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}