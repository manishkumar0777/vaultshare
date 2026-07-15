import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import SessionProvider from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VaultShare - End-to-End Encrypted File Sharing",
  description: "Share files securely with end-to-end encryption. Files are encrypted in your browser before upload, so we never see your data.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <SessionProvider session={session}>
          <AnimatedBackground />
          <Navbar />
          <div className="flex-1 relative z-10">
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}