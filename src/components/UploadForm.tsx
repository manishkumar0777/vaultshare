'use client';

import { useState, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { generateKey, exportKey, encryptFile, encryptString, ivToBase64 } from '@/lib/crypto/utils';

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [downloadLimit, setDownloadLimit] = useState<number>(1);
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    shareUrl: string;
    expiresAt: Date;
    downloadLimit: number;
  } | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setProgress(0);

    if (!file) {
      setError('Please select a file');
      return;
    }

    setIsUploading(true);

    try {
      // Generate encryption key
      setProgress(20);
      const key = await generateKey();
      const exportedKey = await exportKey(key);

      // Encrypt the file
      setProgress(40);
      const { ciphertext, iv } = await encryptFile(file, key);

      // Encrypt metadata
      setProgress(50);
      const { ciphertext: nameCiphertext, iv: nameIv } = await encryptString(file.name, key);
      const { ciphertext: mimeCiphertext, iv: mimeIv } = await encryptString(file.type, key);

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', new Blob([ciphertext]), 'encrypted.bin');
      formData.append('iv', ivToBase64(iv));
      formData.append('originalNameEncrypted', `${nameIv}:${nameCiphertext}`);
      formData.append('mimeTypeEncrypted', `${mimeIv}:${mimeCiphertext}`);
      formData.append('downloadLimit', downloadLimit.toString());
      formData.append('expiresInHours', expiresInHours.toString());
      formData.append('size', file.size.toString());

      // Upload to server
      setProgress(70);
      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData
      });

      setProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setProgress(100);

      let shareUrl = result.shareUrl;
      if (shareUrl && !shareUrl.includes('#key=')) {
        shareUrl = `${shareUrl}#key=${encodeURIComponent(exportedKey)}`;
      }

      setSuccess({
        shareUrl,
        expiresAt: new Date(result.expiresAt),
        downloadLimit: result.downloadLimit
      });
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = () => {
    if (success) {
      navigator.clipboard.writeText(success.shareUrl).then(() => {
        alert('Link copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
        setError('Failed to copy to clipboard');
      });
    }
  };

  const resetForm = () => {
    setFile(null);
    setDownloadLimit(1);
    setExpiresInHours(24);
    setSuccess(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                Select File
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    transition-all duration-200"
                />
              </div>
              {file && (
                <motion.p
                  className="mt-2 text-sm text-gray-500"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label htmlFor="downloadLimit" className="block text-sm font-medium text-gray-700 mb-2">
                Download Limit
              </label>
              <select
                id="downloadLimit"
                value={downloadLimit}
                onChange={(e) => setDownloadLimit(parseInt(e.target.value))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md transition-all duration-200"
              >
                <option value="1">1 download (burn after reading)</option>
                <option value="3">3 downloads</option>
                <option value="5">5 downloads</option>
                <option value="10">10 downloads</option>
                <option value="100">100 downloads</option>
              </select>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label htmlFor="expiresInHours" className="block text-sm font-medium text-gray-700 mb-2">
                Expires In
              </label>
              <select
                id="expiresInHours"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(parseInt(e.target.value))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md transition-all duration-200"
              >
                <option value="1">1 hour</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
                <option value="720">30 days</option>
              </select>
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.div
                  className="p-4 bg-red-50 text-red-700 rounded-md"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {isUploading && (
              <motion.div
                className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="bg-blue-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <button
                type="submit"
                disabled={isUploading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isUploading ? `Encrypting & Uploading... ${progress}%` : 'Upload & Generate Link'}
              </button>
            </motion.div>
          </motion.form>
        ) : (
          <motion.div
            key="success"
            className="space-y-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="p-4 bg-green-50 text-green-700 rounded-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="font-semibold mb-2">File uploaded successfully!</h3>
              <p className="mb-4">Your file is encrypted and ready to share.</p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Shareable Link</label>
                <div className="flex">
                  <input
                    type="text"
                    value={success.shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <motion.button
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Copy
                  </motion.button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Expires</p>
                  <p className="font-medium text-sm">
                    {success.expiresAt.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Downloads</p>
                  <p className="font-medium text-sm">
                    {success.downloadLimit} {success.downloadLimit === 1 ? 'download' : 'downloads'}
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="flex space-x-4">
              <motion.button
                onClick={() => window.location.href = success.shareUrl}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                View File Page
              </motion.button>
              <motion.button
                onClick={resetForm}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Upload Another File
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}