import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// Mock user database
const users = [
  {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    password: 'test123', // Plain text for testing
  }
];

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = users.find(u => u.email === credentials.email);
        if (!user) {
          return null;
        }

        // Simple password comparison for testing
        if (credentials.password !== user.password) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email
        };
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };