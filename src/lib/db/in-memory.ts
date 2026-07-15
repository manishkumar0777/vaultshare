// In-memory storage for development without MongoDB

class InMemoryDB {
  private files: Map<string, any> = new Map();
  private isConnected: boolean = true;

  async connect(): Promise<void> {
    this.isConnected = true;
    // No-op for in-memory storage
  }

  async createFile(file: any): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const newFile = {
      ...file,
      _id: Math.random().toString(36).substring(2, 11),
      createdAt: new Date()
    };

    this.files.set(newFile.fileId, newFile);
    return newFile;
  }

  async getFile(fileId: string): Promise<any | null> {
    if (!this.isConnected) return null;
    return this.files.get(fileId) || null;
  }

  async updateFile(fileId: string, updates: any): Promise<any | null> {
    if (!this.isConnected) return null;
    const file = this.files.get(fileId);
    if (!file) return null;

    const updatedFile = { ...file, ...updates };
    this.files.set(fileId, updatedFile);
    return updatedFile;
  }

  async deleteFile(fileId: string): Promise<boolean> {
    if (!this.isConnected) return false;
    return this.files.delete(fileId);
  }

  async findExpiredFiles(): Promise<any[]> {
    if (!this.isConnected) return [];
    const now = new Date();
    return Array.from(this.files.values()).filter(file => file.expiresAt < now);
  }

  async findFilesByUserId(userId: string): Promise<any[]> {
    if (!this.isConnected) return [];
    return Array.from(this.files.values()).filter(file => file.userId === userId);
  }

  async getAllFiles(): Promise<any[]> {
    if (!this.isConnected) return [];
    return Array.from(this.files.values());
  }
}

export const inMemoryDB = new InMemoryDB();
export default inMemoryDB;