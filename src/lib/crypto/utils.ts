// Removed unused CryptoJS import to satisfy ESLint

// AES-GCM encryption/decryption utilities
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_SIZE = 256;
const IV_LENGTH = 12; // 96 bits for GCM

export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_ALGORITHM,
      length: KEY_SIZE
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

export async function importKey(keyStr: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyStr);
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: ENCRYPTION_ALGORITHM,
      length: KEY_SIZE
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

export async function generateIV(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

export function ivToBase64(iv: Uint8Array): string {
  return arrayBufferToBase64(iv.buffer);
}

export function base64ToIV(ivStr: string): Uint8Array {
  const buffer = base64ToArrayBuffer(ivStr);
  return new Uint8Array(buffer);
}

export async function encryptFile(
  file: File | Blob | ArrayBuffer,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array }> {
  // Generate a random IV
  const iv = await generateIV();

  // Convert file to ArrayBuffer if needed
  let fileBuffer: ArrayBuffer;
  if (file instanceof Blob) {
    fileBuffer = await file.arrayBuffer();
  } else if (file instanceof File) {
    fileBuffer = await file.arrayBuffer();
  } else {
    fileBuffer = file;
  }

  // Encrypt the file
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv as any
    },
    key,
    fileBuffer
  );

  return { ciphertext, iv };
}

export async function decryptFile(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv as any
    },
    key,
    ciphertext
  );
}

export async function encryptString(
  str: string,
  key: CryptoKey
): Promise<{ ciphertext: string, iv: string }> {
  const iv = await generateIV();
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv as any
    },
    key,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: ivToBase64(iv)
  };
}

export async function decryptString(
  ciphertext: string,
  key: CryptoKey,
  ivStr: string
): Promise<string> {
  const iv = base64ToIV(ivStr);
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv as any
    },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Helper functions
export function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// For generating file IDs
export function generateFileId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}