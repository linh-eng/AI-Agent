// =============================================================================
// Tiện ích cho Route Handler — chuẩn hóa JSON response và bắt lỗi.
// =============================================================================
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { HttpError } from "./session";

export function ok(data: unknown, init?: number) {
  return NextResponse.json({ data }, { status: init ?? 200 });
}

export function created(data: unknown) {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

/**
 * Bọc handler để tự chuyển lỗi thường gặp thành HTTP response:
 *  - HttpError  -> status kèm theo
 *  - ZodError   -> 422 + chi tiết field
 *  - Prisma P2002 (unique) -> 409
 */
export function handle(
  fn: (req: Request, ctx: any) => Promise<Response>
): (req: Request, ctx: any) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      if (err instanceof ZodError) {
        return fail(422, "Dữ liệu không hợp lệ", err.flatten().fieldErrors);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          const fields = (err.meta?.target as string[]) ?? [];
          const labels: Record<string, string> = {
            sku: "Mã SKU",
            barcode: "Mã vạch",
            code: "Mã",
            name: "Tên",
            email: "Email",
            serialNumber: "Số serial",
          };
          const label = fields.map((f) => labels[f] ?? f).join(", ") || "Giá trị";
          return fail(409, `${label} đã tồn tại — vui lòng dùng giá trị khác.`);
        }
        if (err.code === "P2025") return fail(404, "Không tìm thấy bản ghi");
      }
      console.error("[API] Lỗi không xử lý:", err);
      return fail(500, "Lỗi máy chủ");
    }
  };
}
