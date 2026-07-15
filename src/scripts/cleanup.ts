import dbConnect from '@/lib/db/connect';
import File from '@/lib/db/models/File';
import { cleanupFileKeys } from '@/lib/redis/client';

async function cleanupExpiredFiles() {
  try {
    await dbConnect();
    const now = new Date();

    // Find expired files
    const expiredFiles = await File.find({
      expiresAt: { $lt: now }
    });

    if (expiredFiles.length > 0) {
      console.log(`Found ${expiredFiles.length} expired files to clean up`);

      // Delete each expired file
      for (const file of expiredFiles) {
        await File.deleteOne({ _id: file._id });
        await cleanupFileKeys(file.fileId);
        console.log(`Deleted expired file: ${file.fileId}`);
      }
    } else {
      console.log('No expired files found');
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Run the cleanup
cleanupExpiredFiles().then(() => process.exit(0)).catch(() => process.exit(1));