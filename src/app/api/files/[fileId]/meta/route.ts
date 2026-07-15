import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import File from '@/lib/db/models/File';
import { checkFileExpiry, getDownloadCount, getDownloadLimit } from '@/lib/redis/client';
import { rateLimit, rateLimitResponse } from '@/lib/utils/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Apply rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await rateLimit(ip, 'download');
    const rateLimitError = rateLimitResponse(rateLimitResult);
    if (rateLimitError) {
      return rateLimitError;
    }

    await dbConnect();

    // Check if file exists and is not expired
    const file = await File.findOne({ fileId });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check database-level expiry first (fallback and safety check)
    if (new Date() > file.expiresAt) {
      return NextResponse.json({ error: 'File has expired' }, { status: 410 });
    }

    // Check Redis for quick expiry check
    const isExpired = await checkFileExpiry(fileId);
    if (isExpired) {
      return NextResponse.json({ error: 'File has expired' }, { status: 410 });
    }

    // Check if file has reached download limit
    let downloadsUsed = await getDownloadCount(fileId);
    let downloadLimit = await getDownloadLimit(fileId);

    // Fallback to database values if Redis is not working/returning default fallback values
    if (downloadsUsed === 0 && file.downloadsUsed > 0) {
      downloadsUsed = file.downloadsUsed;
    }
    if (downloadLimit === 1 && file.downloadLimit > 1) {
      downloadLimit = file.downloadLimit;
    }

    if (downloadsUsed >= downloadLimit) {
      return NextResponse.json({ error: 'Download limit reached' }, { status: 410 });
    }

    // Return non-sensitive metadata (with E2E-encrypted fields)
    return NextResponse.json({
      fileId: file.fileId,
      size: file.size,
      expiresAt: file.expiresAt,
      downloadsRemaining: downloadLimit - downloadsUsed,
      isBurned: file.isBurned,
      originalNameEncrypted: file.originalNameEncrypted,
      mimeTypeEncrypted: file.mimeTypeEncrypted,
      rateLimit: {
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: new Date(rateLimitResult.reset).toISOString()
      }
    });
  } catch (error) {
    console.error('Metadata error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}