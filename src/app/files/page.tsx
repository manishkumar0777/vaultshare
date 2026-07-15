'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileInfo {
  fileId: string;
  size: number;
  downloadLimit: number;
  downloadsUsed: number;
  expiresAt: Date;
  isBurned: boolean;
  createdAt: Date;
}

export default function MyFilesPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files/list');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete file');
      }
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading your files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-8">📁 My Files</h1>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-md mb-6">
            {error}
          </div>
        )}

        {files.length === 0 ? (
          <motion.div
            className="text-center py-16 bg-white rounded-lg shadow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-gray-500 text-lg">No files uploaded yet</p>
            <p className="text-gray-400 mt-2">Upload your first file to get started</p>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div
                  key={file.fileId}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        File ID: {file.fileId.substring(0, 16)}...
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Size</p>
                          <p className="font-medium">{Math.round(file.size / 1024)} KB</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Downloads</p>
                          <p className="font-medium">{file.downloadsUsed} / {file.downloadLimit}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Expires</p>
                          <p className="font-medium">{new Date(file.expiresAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Type</p>
                          <p className="font-medium">{file.isBurned ? '🔥 Burn' : '📋 Standard'}</p>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      onClick={() => handleDelete(file.fileId)}
                      className="ml-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Delete
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}