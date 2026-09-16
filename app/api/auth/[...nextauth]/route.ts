import NextAuth, { AuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || 'placeholder-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'placeholder-secret',
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder-secret',
    }),

  ],
  pages: {
    signIn: "/sign-in",
    newUser: "/sign-up",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "default-development-secret-change-in-env",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
