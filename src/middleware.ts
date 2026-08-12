import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { PORTAL_COOKIE, verifyPortalSession } from "@/lib/portal-auth";

// Đường dẫn công khai (không cần phiên). /api/storage/blob tự xác thực bằng
// SIGNED TOKEN có hạn (giống S3 presigned) — không dùng phiên.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/storage/blob"];
// Cổng khách: tự xác thực bằng phiên PORTAL riêng (không dùng phiên nhân viên).
const PORTAL_PUBLIC = ["/portal/login", "/api/portal/login", "/api/portal/logout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Khu vực CỔNG KHÁCH HÀNG (tách hoàn toàn khỏi phiên nhân viên) ---
  if (pathname.startsWith("/portal") || pathname.startsWith("/api/portal")) {
    if (PORTAL_PUBLIC.some((p) => pathname === p)) return NextResponse.next();

    // API portal: để route handler tự enforce requirePortal() (trả 401 JSON).
    if (pathname.startsWith("/api/portal")) return NextResponse.next();

    // Trang portal: cần phiên portal hợp lệ, nếu không -> /portal/login.
    const token = req.cookies.get(PORTAL_COOKIE)?.value;
    const portal = token ? await verifyPortalSession(token) : null;
    if (!portal) {
      const url = req.nextUrl.clone();
      url.pathname = "/portal/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return NextResponse.next();

  // --- Khu vực NHÂN VIÊN (phiên staff) ---
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Bỏ qua static assets & ảnh; áp dụng cho phần còn lại.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
