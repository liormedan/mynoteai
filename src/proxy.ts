import { authMiddleware, redirectToLogin } from "next-firebase-auth-edge";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig, authCookieNames, isOwner } from "@/lib/auth/config";

const LOGIN_PATH = "/login";
const PUBLIC_PATHS = [LOGIN_PATH, "/login/finish"];

export async function proxy(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    ...authConfig,
    handleValidToken: async ({ decodedToken }, headers) => {
      // A valid Firebase account is not enough: this install has one owner.
      if (!isOwner(decodedToken.email, decodedToken.email_verified)) {
        const url = new URL(LOGIN_PATH, request.url);
        url.searchParams.set("error", "not-owner");
        const response = NextResponse.redirect(url);
        for (const name of authCookieNames) response.cookies.delete(name);
        return response;
      }
      if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () =>
      redirectToLogin(request, { path: LOGIN_PATH, publicPaths: PUBLIC_PATHS }),
    handleError: async (error) => {
      console.error("Authentication error", error);
      return redirectToLogin(request, {
        path: LOGIN_PATH,
        publicPaths: PUBLIC_PATHS,
      });
    },
  });
}

export const config = {
  matcher: [
    "/api/login",
    "/api/logout",
    "/((?!_next|favicon.ico|api|.*\\.).*)",
  ],
};
