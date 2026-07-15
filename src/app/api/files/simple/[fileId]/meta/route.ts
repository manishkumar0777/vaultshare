import { NextResponse } from 'next/server';
import { inMemoryFileStorage } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    console.log('DEBUG: Metadata route called with fileId:', fileId);

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

    // Return non-sensitive metadata (with E2E-encrypted fields)
    return NextResponse.json({
      fileId: file.fileId,
      size: file.size,
      expiresAt: file.expiresAt,
      downloadsRemaining: file.downloadLimit - file.downloadsUsed,
      isBurned: file.isBurned,
      originalNameEncrypted: file.originalNameEncrypted,
      mimeTypeEncrypted: file.mimeTypeEncrypted
    });
  } catch (error) {
    console.error('Metadata error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}