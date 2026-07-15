import { NextResponse } from 'next/server';
import { generateFileId, generateKey, exportKey, encryptFile, encryptString, ivToBase64, arrayBufferToBase64 } from '@/lib/crypto/utils';
import { inMemoryFileStorage } from '@/lib/storage';

// Max file size in bytes (25MB default)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '25') * 1024 * 1024;

export async function POST(request: Request) {
  try {
    // Parse form data using built-in FormData API
    const formData = await request.formData();

    // Get the file
    const fileBlob = formData.get('file') as Blob | null;

    if (!fileBlob) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (fileBlob.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds limit' }, { status: 413 });
    }

    // Get other form fields
    const downloadLimit = formData.get('downloadLimit') ? parseInt(formData.get('downloadLimit') as string) : 1;
    const expiresInHours = formData.get('expiresInHours') ? parseInt(formData.get('expiresInHours') as string) : 24;
    const originalName = formData.get('originalName') as string || 'encrypted.bin';
    const mimeType = formData.get('mimeType') as string || 'application/octet-stream';

    // Validate download limit
    if (isNaN(downloadLimit) || downloadLimit < 1 || downloadLimit > 100) {
      return NextResponse.json({ error: 'Invalid download limit' }, { status: 400 });
    }

    // Validate expiration
    if (isNaN(expiresInHours) || expiresInHours < 1 || expiresInHours > 720) {
      return NextResponse.json({ error: 'Invalid expiration time' }, { status: 400 });
    }

    // Check if the client already performed encryption (E2E)
    const clientIv = formData.get('iv') as string | null;
    const clientOriginalNameEncrypted = formData.get('originalNameEncrypted') as string | null;
    const clientMimeTypeEncrypted = formData.get('mimeTypeEncrypted') as string | null;
    const clientOriginalSize = formData.get('size') as string | null;

    let finalCiphertext: ArrayBuffer;
    let finalIv: string;
    let finalOriginalNameEncrypted: string;
    let finalMimeTypeEncrypted: string;
    let finalSize: number;
    let shareUrlKeyFragment = '';

    const fileId = generateFileId();

    if (clientIv && clientOriginalNameEncrypted && clientMimeTypeEncrypted) {
      // E2E Client-side encryption: use client's encrypted data
      finalCiphertext = await fileBlob.arrayBuffer();
      
      // Convert comma-separated IV to base64 if needed
      if (clientIv.includes(',')) {
        const ivArray = new Uint8Array(clientIv.split(',').map(Number));
        finalIv = ivToBase64(ivArray);
      } else {
        finalIv = clientIv;
      }
      
      finalOriginalNameEncrypted = clientOriginalNameEncrypted;
      finalMimeTypeEncrypted = clientMimeTypeEncrypted;
      finalSize = clientOriginalSize ? parseInt(clientOriginalSize) : fileBlob.size;
    } else {
      // Server-side encryption fallback (legacy clients)
      const fileBuffer = await fileBlob.arrayBuffer();
      const key = await generateKey();
      const exportedKey = await exportKey(key);

      const { ciphertext, iv } = await encryptFile(fileBuffer, key);
      const { ciphertext: nameCiphertext } = await encryptString(originalName, key);
      const { ciphertext: mimeCiphertext } = await encryptString(mimeType, key);

      finalCiphertext = ciphertext;
      finalIv = ivToBase64(iv);
      finalOriginalNameEncrypted = nameCiphertext;
      finalMimeTypeEncrypted = mimeCiphertext;
      finalSize = fileBlob.size;
      shareUrlKeyFragment = `#key=${encodeURIComponent(exportedKey)}`;
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Store the file in memory
    const fileData = {
      fileId,
      encryptedBlobRef: arrayBufferToBase64(finalCiphertext),
      iv: finalIv,
      originalNameEncrypted: finalOriginalNameEncrypted,
      mimeTypeEncrypted: finalMimeTypeEncrypted,
      size: finalSize,
      downloadLimit,
      downloadsUsed: 0,
      expiresAt,
      isBurned: downloadLimit === 1,
      createdAt: new Date()
    };

    inMemoryFileStorage.setFile(fileId, fileData);

    // Construct the shareable URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/f/${fileId}${shareUrlKeyFragment}`;

    return NextResponse.json({
      success: true,
      fileId,
      shareUrl,
      expiresAt,
      downloadLimit
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}