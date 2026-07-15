import { NextResponse } from 'next/server';
import { generateFileId, generateKey, exportKey, encryptFile, encryptString, ivToBase64, arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/crypto/utils';

// In-memory storage for testing
const inMemoryFiles = new Map<string, any>();

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

    // Read the file as ArrayBuffer
    const fileBuffer = await fileBlob.arrayBuffer();

    // Generate encryption key (in a real app, this would be done client-side)
    const key = await generateKey();
    const exportedKey = await exportKey(key);

    // Encrypt the file (in a real app, this would be done client-side)
    const { ciphertext, iv } = await encryptFile(fileBuffer, key);

    // Encrypt metadata (in a real app, this would be done client-side)
    const { ciphertext: nameCiphertext } = await encryptString(originalName, key);
    const { ciphertext: mimeCiphertext } = await encryptString(mimeType, key);

    // Generate file ID
    const fileId = generateFileId();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Store the file in memory
    const fileData = {
      fileId,
      encryptedBlobRef: arrayBufferToBase64(ciphertext),
      iv: ivToBase64(iv),
      originalNameEncrypted: nameCiphertext,
      mimeTypeEncrypted: mimeCiphertext,
      size: fileBlob.size,
      downloadLimit,
      downloadsUsed: 0,
      expiresAt,
      isBurned: downloadLimit === 1,
      createdAt: new Date()
    };

    inMemoryFiles.set(fileId, fileData);

    // Construct the shareable URL with the key in the fragment
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/f/${fileId}#key=${encodeURIComponent(exportedKey)}`;

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

export async function GET(
  request: Request
) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get the file from in-memory storage
    const file = inMemoryFiles.get(fileId);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if file has expired
    if (new Date() > file.expiresAt) {
      inMemoryFiles.delete(fileId);
      return NextResponse.json({ error: 'File has expired' }, { status: 410 });
    }

    // Check if file has reached download limit
    if (file.downloadsUsed >= file.downloadLimit) {
      inMemoryFiles.delete(fileId);
      return NextResponse.json({ error: 'Download limit reached' }, { status: 410 });
    }

    // Increment download count
    file.downloadsUsed++;
    if (file.downloadsUsed >= file.downloadLimit) {
      inMemoryFiles.delete(fileId);
    } else {
      inMemoryFiles.set(fileId, file);
    }

    // Convert base64 encrypted data back to ArrayBuffer
    const encryptedData = base64ToArrayBuffer(file.encryptedBlobRef);

    // Return the encrypted file
    return new NextResponse(encryptedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="encrypted_${fileId}"`,
        'Content-Length': encryptedData.byteLength.toString(),
        'X-File-IV': file.iv // Send IV in header for client-side decryption
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET_META(
  request: Request
) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get the file from in-memory storage
    const file = inMemoryFiles.get(fileId);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if file has expired
    if (new Date() > file.expiresAt) {
      inMemoryFiles.delete(fileId);
      return NextResponse.json({ error: 'File has expired' }, { status: 410 });
    }

    // Return non-sensitive metadata
    return NextResponse.json({
      fileId: file.fileId,
      size: file.size,
      expiresAt: file.expiresAt,
      downloadsRemaining: file.downloadLimit - file.downloadsUsed,
      isBurned: file.isBurned
    });
  } catch (error) {
    console.error('Metadata error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}