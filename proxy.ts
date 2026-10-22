import { NextResponse, type NextRequest } from "next/server";

// A dashboard that hasn't picked its house yet goes to the (demo-only) house picker first.
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/choose-house", request.url));
}

export const config = {
  matcher: [
    {
      source: "/((?!choose-house|api|_next|.*\\..*).*)",
      missing: [{ type: "cookie", key: "house_id" }],
    },
  ],
};
