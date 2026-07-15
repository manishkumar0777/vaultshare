'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { importKey, decryptFile, base64ToIV, decryptString } from '@/lib/crypto/utils';

export default function FileDownloadPage({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = use(params);
  const router = useRouter();
  const [fileInfo, setFileInfo] = useState<{
    size: number;
    expiresAt: Date;
    downloadsRemaining: number;
    isBurned: boolean;
    originalNameEncrypted?: string;
    mimeTypeEncrypted?: string;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decryptionKey, setDecryptionKey] = useState<string | null>(null);
  const [decryptedName, setDecryptedName] = useState<string>('File');

  useEffect(() => {
    const extractKey = () => {
      if (typeof window !== 'undefined') {
        const href = window.location.href;
        const keyMatch = href.match(/#key=([^&]+)/);
        if (keyMatch) {
          return decodeURIComponent(keyMatch[1]);
        }
      }
      return null;
    };

    const key = extractKey();
    if (key) {
      setDecryptionKey(key);
    }

    // Register event listener in case hash changes later
    const handleHashChange = () => {
      const key = extractKey();
      if (key) setDecryptionKey(key);
    };
    window.addEventListener('hashchange', handleHashChange);
    
    // Fallback: check again after a short timeout to handle Next.js client hydration delays
    const timer = setTimeout(() => {
      const key = extractKey();
      if (key) setDecryptionKey(key);
    }, 150);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!fileId) return;

    const fetchFileInfo = async () => {
      try {
        const response = await fetch(`/api/files/${fileId}/meta`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch file info');
        }
        const data = await response.json();
        setFileInfo({
          ...data,
          expiresAt: new Date(data.expiresAt)
        });
      } catch (err) {
        console.error('Error fetching file info:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch file information');
      }
    };

    fetchFileInfo();
  }, [fileId]);

  useEffect(() => {
    if (!fileInfo || !decryptionKey) return;

    const decryptMetadata = async () => {
      try {
        const key = await importKey(decryptionKey);
        
        // Decrypt filename
        if (fileInfo.originalNameEncrypted) {
          const parts = fileInfo.originalNameEncrypted.split(':');
          if (parts.length === 2) {
            const [metaIv, metaCiphertext] = parts;
            const name = await decryptString(metaCiphertext, key, metaIv);
            setDecryptedName(name);
          } else {
            setDecryptedName('Secure File');
          }
        }
      } catch (err) {
        console.error('Failed to decrypt metadata:', err);
        setDecryptedName('Secure File');
      }
    };

    decryptMetadata();
  }, [fileInfo, decryptionKey]);

  const handleDownload = async () => {
    if (!fileId || !decryptionKey) {
      setError('Missing file ID or decryption key');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      // Fetch the encrypted file
      const response = await fetch(`/api/files/${fileId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download file');
      }

      const ivBase64 = response.headers.get('X-File-IV');
      if (!ivBase64) {
        throw new Error('Missing IV in response headers');
      }

      const iv = base64ToIV(ivBase64);
      const encryptedData = await response.arrayBuffer();

      // Import the decryption key
      const key = await importKey(decryptionKey);

      // Decrypt the file
      const decryptedData = await decryptFile(encryptedData, key, iv);

      // Create a blob and download it
      const blob = new Blob([decryptedData]);
      const url = window.URL.createObjectURL(blob);

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = decryptedName || 'decrypted_file';
      if (contentDisposition && filename === 'decrypted_file') {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace('encrypted_', '');
        }
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Refresh file info
      const infoResponse = await fetch(`/api/files/${fileId}/meta`);
      if (infoResponse.ok) {
        const data = await infoResponse.json();
        setFileInfo({
          ...data,
          expiresAt: new Date(data.expiresAt)
        });
      }
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download and decrypt file');
    } finally {
      setIsDownloading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          className="max-w-md w-full bg-white rounded-lg shadow-md p-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-red-600 mb-4">❌ Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <motion.button
            onClick={() => router.push('/')}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Return to Home
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!fileInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading file information...</p>
        </motion.div>
      </div>
    );
  }

  if (!decryptionKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          className="max-w-md w-full bg-white rounded-lg shadow-md p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-4">🔑 Missing Decryption Key</h1>
          <p className="text-gray-700 mb-6">
            This file requires a decryption key that should have been included in the URL.
            The link you received should look like: <code className="bg-gray-100 px-2 py-1 rounded">...#key=...</code>
          </p>
          <motion.button
            onClick={() => router.push('/')}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Return to Home
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <motion.div
        className="max-w-md w-full bg-white rounded-lg shadow-xl p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-6 truncate" title={decryptedName}>
          📥 Download {decryptedName}
        </h1>

        <motion.div
          className="space-y-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-500">File Size:</span>
            <span className="font-medium">{Math.round(fileInfo.size / 1024)} KB</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-500">Expires:</span>
            <span className="font-medium">{fileInfo.expiresAt.toLocaleString()}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-500">Downloads Remaining:</span>
            <span className="font-medium">{fileInfo.downloadsRemaining}</span>
          </div>
        </motion.div>

        {fileInfo.downloadsRemaining > 0 ? (
          <motion.button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {isDownloading ? '⏳ Downloading & Decrypting...' : '⬇️ Download & Decrypt File'}
          </motion.button>
        ) : (
          <motion.div
            className="p-4 bg-red-50 text-red-700 rounded-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            This file has reached its download limit and is no longer available.
          </motion.div>
        )}

        <motion.div
          className="mt-6 p-4 bg-yellow-50 rounded-md border border-yellow-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-semibold text-yellow-800 mb-2">🛡️ Security Notice</h3>
          <p className="text-sm text-yellow-700">
            This file was encrypted in the sender&apos;s browser before upload. The decryption key was never sent to our servers.
            Your browser is decrypting the file locally.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}