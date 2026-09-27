import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedEmail = process.env.ALLOWED_EMAIL?.toLowerCase();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Single-user app: only the owner's Google account may sign in.
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified !== false;
      return Boolean(allowedEmail && email === allowedEmail && verified);
    },
  },
};

export async function getAllowedSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  return email && email === allowedEmail ? session : null;
}
