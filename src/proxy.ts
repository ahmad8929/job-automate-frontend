import { withAuth } from "next-auth/middleware";

// Redirects signed-out visitors to /login for every page. API routes check the session themselves.
const authProxy = withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token }) => Boolean(token?.email && token.email.toLowerCase() === process.env.ALLOWED_EMAIL?.toLowerCase()),
  },
});

export function proxy(...args: Parameters<typeof authProxy>) {
  return authProxy(...args);
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
