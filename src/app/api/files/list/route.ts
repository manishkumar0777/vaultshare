import { NextResponse } from 'next/server';
import { inMemoryFileStorage } from '@/lib/storage';
import File from '@/lib/db/models/File';
import dbConnect from '@/lib/db/connect';

export async function GET() {
  try {
    await dbConnect();

    // Get files from database
    const dbFiles = await File.find({});

    // Get files from in-memory simple storage
    const simpleFiles = inMemoryFileStorage.getAllFiles();

    const fileIds = new Set(dbFiles.map((f: any) => f.fileId));

    const combinedFiles = [
      ...dbFiles.map((file: any) => ({
        fileId: file.fileId,
        size: file.size,
        downloadLimit: file.downloadLimit,
        downloadsUsed: file.downloadsUsed,
        expiresAt: file.expiresAt,
        isBurned: file.isBurned,
        createdAt: file.createdAt
      })),
      ...simpleFiles
        .filter((file: any) => !fileIds.has(file.fileId))
        .map((file: any) => ({
          fileId: file.fileId,
          size: file.size,
          downloadLimit: file.downloadLimit,
          downloadsUsed: file.downloadsUsed,
          expiresAt: file.expiresAt,
          isBurned: file.isBurned,
          createdAt: file.createdAt
        }))
    ];

    return NextResponse.json({ files: combinedFiles });
  } catch (error) {
    console.error('Error listing files:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}