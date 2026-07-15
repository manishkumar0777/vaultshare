import { NextResponse } from 'next/server';
import { inMemoryFileStorage } from '@/lib/storage';
import { base64ToArrayBuffer } from '@/lib/crypto/utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get the file from in-memory storage
    const file = inMemoryFileStorage.getFile(fileId);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if file has expired
    if (new Date() > file.expiresAt) {
      inMemoryFileStorage.deleteFile(fileId);
      return NextResponse.json({ error: 'File has expired' }, { status: 410 });
    }

    // Check if file has reached download limit
    if (file.downloadsUsed >= file.downloadLimit) {
      inMemoryFileStorage.deleteFile(fileId);
      return NextResponse.json({ error: 'Download limit reached' }, { status: 410 });
    }

    // Increment download count
    file.downloadsUsed++;
    if (file.downloadsUsed >= file.downloadLimit) {
      inMemoryFileStorage.deleteFile(fileId);
    } else {
      inMemoryFileStorage.setFile(fileId, file);
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
