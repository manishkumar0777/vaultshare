'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <motion.nav
      className="bg-white shadow-sm border-b border-gray-200"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/">
            <motion.div
              className="text-xl font-bold text-gray-900 cursor-pointer"
              whileHover={{ scale: 1.05 }}
            >
              🔒 VaultShare
            </motion.div>
          </Link>
          <div className="flex space-x-4">
            <Link href="/">
              <motion.div
                className="text-gray-700 hover:text-gray-900 cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                Home
              </motion.div>
            </Link>
            {session ? (
              <>
                <Link href="/files">
                  <motion.div
                    className="text-gray-700 hover:text-gray-900 cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                  >
                    My Files
                  </motion.div>
                </Link>
                <motion.button
                  onClick={() => signOut()}
                  className="text-gray-700 hover:text-gray-900 cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                >
                  Sign Out
                </motion.button>
              </>
            ) : (
              <Link href="/auth/signin">
                <motion.div
                  className="text-gray-700 hover:text-gray-900 cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                >
                  Sign In
                </motion.div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}