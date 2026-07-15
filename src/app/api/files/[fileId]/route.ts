import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import File from '@/lib/db/models/File';
import { checkFileExpiry, getDownloadCount, getDownloadLimit, incrementDownloadCount, cleanupFileKeys } from '@/lib/redis/client';
import { rateLimit, rateLimitResponse } from '@/lib/utils/rate-limit';

// Helper function to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

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

    // Check if file exists
    const file = await File.findOne({ fileId });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check database-level expiry first (fallback and safety check)
    if (new Date() > file.expiresAt) {
      await File.deleteOne({ fileId });
      await cleanupFileKeys(fileId);
      return NextResponse.json({ error: 'File has expired' }, { status: 410 });
    }

    // Check Redis for quick expiry check
    const isExpired = await checkFileExpiry(fileId);
    if (isExpired) {
      // Clean up the file
      await File.deleteOne({ fileId });
      await cleanupFileKeys(fileId);
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
      // Clean up the file
      await File.deleteOne({ fileId });
      await cleanupFileKeys(fileId);
      return NextResponse.json({ error: 'Download limit reached' }, { status: 410 });
    }

    // Increment download count
    let newDownloadCount = await incrementDownloadCount(fileId);
    if (newDownloadCount === 1 && file.downloadsUsed > 0) {
      newDownloadCount = file.downloadsUsed + 1;
    }
    file.downloadsUsed = newDownloadCount;

    // If this was the last download, delete the file
    if (newDownloadCount >= downloadLimit) {
      await File.deleteOne({ fileId });
      await cleanupFileKeys(fileId);
    } else {
      // Otherwise, update the download count in MongoDB
      await file.save();
    }

    // Convert base64 encrypted data back to ArrayBuffer
    const encryptedData = base64ToArrayBuffer(file.encryptedBlobRef);

    // Return the encrypted file
    const response = new NextResponse(encryptedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="encrypted_${fileId}"`,
        'Content-Length': encryptedData.byteLength.toString(),
        'X-File-IV': file.iv, // Send IV in header for client-side decryption
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.reset / 1000).toString(),
      }
    });

    return response;
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}