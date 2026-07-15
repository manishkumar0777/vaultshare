// Shared in-memory storage for files
class InMemoryFileStorage {
  private files: Map<string, any> = new Map();

  getFile(fileId: string) {
    return this.files.get(fileId);
  }

  setFile(fileId: string, fileData: any) {
    this.files.set(fileId, fileData);
  }

  deleteFile(fileId: string) {
    this.files.delete(fileId);
  }

  getAllFiles() {
    return Array.from(this.files.values());
  }
}

export const inMemoryFileStorage = new InMemoryFileStorage();