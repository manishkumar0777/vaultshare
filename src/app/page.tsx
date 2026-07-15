'use client';

import { motion } from 'framer-motion';
import UploadForm from '@/components/UploadForm';
import AnimatedCard from '@/components/AnimatedCard';
import AnimatedCounter from '@/components/AnimatedCounter';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              🔒 VaultShare
            </motion.h1>
            <motion.p
              className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Secure file sharing with end-to-end encryption. Files are encrypted in your browser before upload,
              so we never see your data or decryption keys.
            </motion.p>
          </motion.div>

          {/* Stats Section */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <AnimatedCard delay={0.5}>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  <AnimatedCounter end={256} suffix="-bit" />
                </div>
                <p className="text-gray-600">AES Encryption</p>
              </div>
            </AnimatedCard>
            <AnimatedCard delay={0.6}>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  <AnimatedCounter end={100} suffix="%" />
                </div>
                <p className="text-gray-600">Client-Side</p>
              </div>
            </AnimatedCard>
            <AnimatedCard delay={0.7}>
              <div className="text-center">
                <div className="text-3xl font-bold text-pink-600 mb-2">
                  <AnimatedCounter end={0} />
                </div>
                <p className="text-gray-600">Server Access</p>
              </div>
            </AnimatedCard>
          </motion.div>

          {/* Upload Form */}
          <motion.div
            className="bg-white rounded-2xl shadow-2xl p-8 mb-12"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
          >
            <UploadForm />
          </motion.div>

          {/* How It Works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { icon: '📁', title: 'Select', desc: 'Choose file' },
                { icon: '🔐', title: 'Encrypt', desc: 'In browser' },
                { icon: '☁️', title: 'Upload', desc: 'Encrypted data' },
                { icon: '🔗', title: 'Share', desc: 'Secure link' },
                { icon: '📥', title: 'Decrypt', desc: 'Locally' },
              ].map((step, index) => (
                <motion.div
                  key={index}
                  className="bg-white rounded-lg shadow p-4 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <div className="text-4xl mb-2">{step.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Security Notice */}
          <motion.div
            className="mt-12 p-6 bg-yellow-50 rounded-xl border-2 border-yellow-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
          >
            <h3 className="font-bold text-yellow-800 mb-2 text-lg">⚠️ Important Security Note</h3>
            <p className="text-yellow-700">
              The decryption key is only in the URL fragment. If you lose this link, we cannot recover your file.
              We never see or store the decryption key. The server only stores encrypted data.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}