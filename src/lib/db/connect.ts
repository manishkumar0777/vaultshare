import mongoose from 'mongoose';
import inMemoryDB from './in-memory';

const MONGODB_URI = process.env.MONGODB_URI;

// Global is used here to maintain a cached connection across hot reloads
// in development. This prevents connections growing exponentially
// during API Route usage.
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // Use in-memory storage if MongoDB is not available
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI not defined, using in-memory storage');
    await inMemoryDB.connect();
    return null;
  }

  try {
    if (cached.conn) {
      return cached.conn;
    }

    if (!cached.promise) {
      const opts = {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000, // 5 seconds timeout
        socketTimeoutMS: 45000, // 45 seconds
      };

      cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
        return mongoose;
      });
    }
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error('MongoDB connection failed, using in-memory storage:', error);
    await inMemoryDB.connect();
    return null;
  }
}

export { inMemoryDB };
export default dbConnect;