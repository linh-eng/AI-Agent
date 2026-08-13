export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { invoiceCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";
import {
  createInvoiceFromProposal,
  computeInvoiceTotals,
  nextInvoiceCode,
  invoicePaidAmount,
} from "@/lib/invoice";

// Danh sách hóa đơn (lọc theo khách nếu có).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.INVOICE_READ);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const invoices = await prisma.invoice.findMany({
    where: { customerId, ...(status ? { status: status as any } : {}) },
    include: {
      customer: { select: { code: true, fullName: true } },
      _count: { select: { items: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: 300,
  });
  // Kèm số đã trả để hiển thị còn phải thu (không cần join payment ở list).
  const ids = invoices.map((i) => i.id);
  const paidRows = ids.length
    ? await prisma.payment.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: ids } }, _sum: { amount: true } })
    : [];
  const paidMap = new Map(paidRows.map((r) => [r.invoiceId, Number(r._sum.amount ?? 0)]));
  const withPaid = invoices.map((i) => {
    const paid = paidMap.get(i.id) ?? 0;
    const outstanding = i.status === "CANCELLED" ? 0 : Math.max(0, Number(i.total) - paid);
    return { ...i, paidAmount: paid, outstanding };
  });
  return ok(withPaid);
});

// Tạo hóa đơn: từ báo giá đã chốt (proposalId) hoặc lập thủ công (customerId + items).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.INVOICE_WRITE);
  const parsed = invoiceCreateSchema.parse(await req.json());

  if (parsed.proposalId) {
    const { invoice, reused } = await createInvoiceFromProposal(parsed.proposalId, session.name);
    if (!reused) {
      await auditLog({
        userId: session.userId,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: invoice.id,
        changes: { proposalId: parsed.proposalId, total: invoice.total },
      });
    }
    const paid = await invoicePaidAmount(invoice.id);
    return created({ ...invoice, paidAmount: paid, outstanding: Math.max(0, Number(invoice.total) - paid), reused });
  }

  // Lập thủ công
  const customer = await prisma.customer.findUnique({ where: { id: parsed.customerId! } });
  if (!customer) return fail(404, "Không tìm thấy khách hàng");
  const { subtotal, discount, total, lines } = computeInvoiceTotals(parsed.items!, parsed.discount);
  const invoice = await prisma.invoice.create({
    data: {
      code: await nextInvoiceCode(),
      customerId: parsed.customerId!,
      planId: parsed.planId ?? null,
      status: "UNPAID",
      subtotal,
      discount,
      total,
      dueDate: parsed.dueDate ?? null,
      note: parsed.note ?? null,
      createdBy: session.name,
      items: {
        create: lines.map((l, i) => ({
          name: l.name,
          quantity: l.quantity ?? 1,
          unitPrice: Number(l.unitPrice ?? 0),
          amount: l.amount,
          note: l.note ?? null,
          orderIndex: i,
        })),
      },
    },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });
  await auditLog({
    userId: session.userId,
    action: "INVOICE_CREATED",
    entityType: "Invoice",
    entityId: invoice.id,
    changes: { customerId: parsed.customerId, total },
  });
  return created({ ...invoice, paidAmount: 0, outstanding: total });
});
