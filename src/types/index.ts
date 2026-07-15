export type FileMetadata = {
  fileId: string;
  size: number;
  expiresAt: Date;
  downloadsRemaining: number;
  isBurned: boolean;
};

export type UploadSuccess = {
  shareUrl: string;
  expiresAt: Date;
  downloadLimit: number;
};

export type EncryptedFileData = {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
};

export type EncryptedStringData = {
  ciphertext: string;
  iv: string;
};