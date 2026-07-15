import mongoose, { Document, Schema } from 'mongoose';
import { inMemoryDB } from '../connect';

// File metadata interface
export interface IFile extends Document {
  fileId: string;
  encryptedBlobRef: string;
  iv: string;
  originalNameEncrypted: string;
  mimeTypeEncrypted: string;
  size: number;
  downloadLimit: number;
  downloadsUsed: number;
  expiresAt: Date;
  createdAt: Date;
  userId?: string;
  isBurned: boolean;
}

// File schema
const FileSchema: Schema = new Schema({
  fileId: { type: String, required: true, unique: true },
  encryptedBlobRef: { type: String, required: true },
  iv: { type: String, required: true },
  originalNameEncrypted: { type: String, required: true },
  mimeTypeEncrypted: { type: String, required: true },
  size: { type: Number, required: true },
  downloadLimit: { type: Number, required: true, default: 1 },
  downloadsUsed: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  userId: { type: String, required: false },
  isBurned: { type: Boolean, default: false }
});

// Indexes for better query performance
FileSchema.index({ fileId: 1 });
FileSchema.index({ expiresAt: 1 });
FileSchema.index({ userId: 1 });

// Create the Mongoose model
const MongooseFile = mongoose.models.File || mongoose.model<IFile>('File', FileSchema);

// Helper to wrap in-memory plain objects with a save() method
function wrapInMemoryDocument(doc: any) {
  if (!doc) return doc;
  return {
    ...doc,
    async save() {
      return await inMemoryDB.updateFile(this.fileId, this);
    }
  };
}

class FileProxy {
  private data: any;

  constructor(data: any) {
    this.data = data;
  }

  async save() {
    if (mongoose.connection.readyState === 1) {
      const fileDoc = new MongooseFile(this.data);
      return await fileDoc.save();
    } else {
      return await inMemoryDB.createFile(this.data);
    }
  }

  static async findOne(query: { fileId: string }) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseFile.findOne(query);
    } else {
      const doc = await inMemoryDB.getFile(query.fileId);
      return wrapInMemoryDocument(doc);
    }
  }

  static async deleteOne(query: { fileId: string }) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseFile.deleteOne(query);
    } else {
      return await inMemoryDB.deleteFile(query.fileId);
    }
  }

  static async find(query: any) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseFile.find(query);
    } else {
      let docs: any[] = [];
      if (query && query.userId) {
        docs = await inMemoryDB.findFilesByUserId(query.userId);
      } else if (query && query.expiresAt && query.expiresAt.$lt) {
        docs = await inMemoryDB.findExpiredFiles();
      } else {
        docs = await inMemoryDB.getAllFiles();
      }
      return docs.map(wrapInMemoryDocument);
    }
  }
}

const File: any = FileProxy;

export default File;