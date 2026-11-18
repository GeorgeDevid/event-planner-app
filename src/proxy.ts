import { convexAuthNextjsProxy, nextjsProxyRedirect } from "@/lib/convex-auth";

const PROTECTED = ["/home", "/onboarding", "/app", "/vendor", "/admin"];
const GUEST_ONLY = ["/sign-in", "/sign-up"];

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Refreshes the session before rendering and handles the signed-in/out
 * redirects. Which area a signed-in user may open (client, vendor or admin) is
 * decided by their role in the area layouts, and every Convex function checks
 * the role again on the server.
 */
export const proxy = convexAuthNextjsProxy(async (request, ctx) => {
  const { pathname } = request.nextUrl;
  if (matches(pathname, PROTECTED) && !(await ctx.isAuthenticated())) {
    return nextjsProxyRedirect(request, "/sign-in");
  }
  if (matches(pathname, GUEST_ONLY) && (await ctx.isAuthenticated())) {
    return nextjsProxyRedirect(request, "/home");
  }
});

export const config = {
  // Everything except static files and Next.js internals.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
