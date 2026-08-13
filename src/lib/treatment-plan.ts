// =============================================================================
// Phác đồ (mục 4) — helper thuần: tần suất, tiến độ, derive trạng thái buổi,
// so sánh Kế hoạch vs Thực tế. Không phụ thuộc Prisma client cụ thể — nhận
// dữ liệu dạng plain object để dễ test.
// =============================================================================
import { FREQUENCY_UNIT_LABEL } from "./clinic-labels";

export type FrequencyUnit = "DAY" | "WEEK" | "MONTH";

/** "7 ngày/lần", "2 tuần/lần", "1 tháng/lần"; null khi thiếu cấu hình. */
export function frequencyLabel(value?: number | null, unit?: string | null): string | null {
  if (!value || !unit) return null;
  const u = FREQUENCY_UNIT_LABEL[unit] ?? unit;
  return `${value} ${u}/lần`;
}

/** Chuẩn hóa tần suất về SỐ NGÀY giữa 2 buổi (tuần=7, tháng≈30). */
export function frequencyToDays(value?: number | null, unit?: string | null): number | null {
  if (!value || !unit) return null;
  const mult = unit === "WEEK" ? 7 : unit === "MONTH" ? 30 : 1;
  return value * mult;
}

/**
 * Tính chuỗi ngày dự kiến cho các buổi trong 1 giai đoạn: bắt đầu tại `start`,
 * mỗi buổi cách nhau `frequency`. Trả mảng Date (rỗng nếu thiếu dữ liệu).
 */
export function computeStageSessionDates(
  start: Date | string | null | undefined,
  count: number | null | undefined,
  freqValue?: number | null,
  freqUnit?: string | null,
): Date[] {
  if (!start || !count || count <= 0) return [];
  const gap = frequencyToDays(freqValue, freqUnit) ?? 0;
  const base = new Date(start);
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + gap * i);
    out.push(d);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Derive trạng thái hiển thị của 1 BUỔI (mục 10) từ Session + Booking liên kết.
// Ưu tiên: đã ghi nhận thực tế (performedAt/COMPLETED) → Hoàn thành; nếu buổi
// bị SKIPPED/CANCELLED → theo đó; nếu có Booking → map theo trạng thái lịch hẹn;
// còn lại chưa có lịch → "Chưa lên lịch".
// ---------------------------------------------------------------------------
export type DerivedSessionStatus =
  | "PLANNED"
  | "SCHEDULED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "RESCHEDULED"
  | "SKIPPED"
  | "CANCELLED";

const BOOKING_TO_SESSION: Record<string, DerivedSessionStatus> = {
  NEW: "SCHEDULED",
  PENDING: "SCHEDULED",
  CONFIRMED: "SCHEDULED",
  RESCHEDULED: "RESCHEDULED",
  ARRIVED: "ARRIVED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  NO_SHOW: "SCHEDULED",
  CANCELLED: "CANCELLED",
};

export function deriveSessionStatus(
  session: { status?: string | null; performedAt?: Date | string | null },
  booking?: { status?: string | null } | null,
): DerivedSessionStatus {
  const s = session.status ?? "PLANNED";
  if (s === "COMPLETED" || session.performedAt) return "COMPLETED";
  if (s === "SKIPPED") return "SKIPPED";
  if (s === "CANCELLED") return "CANCELLED";
  if (s === "IN_PROGRESS") return "IN_PROGRESS";
  if (booking?.status) return BOOKING_TO_SESSION[booking.status] ?? "SCHEDULED";
  return "PLANNED";
}

/** Buổi được coi là "đã thực hiện" (tính vào tiến độ). */
export function isSessionDone(session: { status?: string | null; performedAt?: Date | string | null }): boolean {
  return session.status === "COMPLETED" || !!session.performedAt;
}

// ---------------------------------------------------------------------------
// Tiến độ phác đồ (mục 7) — tách rõ giai đoạn hiện tại / tiến độ giai đoạn /
// tiến độ toàn phác đồ / buổi tiếp theo.
// ---------------------------------------------------------------------------
export interface PlanStageLike {
  id: string;
  name: string;
  orderIndex: number;
}
export interface PlanSessionLike {
  id: string;
  stageId?: string | null;
  sessionNumber: number;
  status?: string | null;
  performedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  plannedDate?: Date | string | null;
}

export interface PlanProgress {
  totalSessions: number;
  doneSessions: number;
  currentStage: { id: string; name: string } | null;
  stageProgress: { done: number; total: number } | null;
  overallProgress: { done: number; total: number };
  nextSession: { id: string; sessionNumber: number; date: Date | null } | null;
}

export function computePlanProgress(stages: PlanStageLike[], sessions: PlanSessionLike[]): PlanProgress {
  const total = sessions.length;
  const done = sessions.filter(isSessionDone).length;

  // Giai đoạn hiện tại: buổi chưa hoàn thành/hủy đầu tiên → stage của nó;
  // nếu tất cả xong → stage của buổi hoàn thành cuối; else giai đoạn đầu.
  const notDone = sessions
    .filter((s) => !isSessionDone(s) && s.status !== "CANCELLED" && s.status !== "SKIPPED")
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
  const doneSorted = sessions.filter(isSessionDone).sort((a, b) => a.sessionNumber - b.sessionNumber);
  const stageId =
    notDone[0]?.stageId ?? doneSorted[doneSorted.length - 1]?.stageId ?? stages[0]?.id ?? null;
  const stage = stageId ? stages.find((s) => s.id === stageId) ?? null : null;

  let stageProgress: { done: number; total: number } | null = null;
  if (stage) {
    const inStage = sessions.filter((s) => s.stageId === stage.id);
    stageProgress = { done: inStage.filter(isSessionDone).length, total: inStage.length };
  }

  // Buổi tiếp theo: buổi chưa thực hiện có ngày (plannedDate/scheduledAt) sớm nhất,
  // fallback buổi chưa thực hiện có số thứ tự nhỏ nhất.
  const upcoming = notDone
    .map((s) => ({ s, date: s.scheduledAt ? new Date(s.scheduledAt) : s.plannedDate ? new Date(s.plannedDate) : null }))
    .sort((a, b) => {
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return -1;
      if (b.date) return 1;
      return a.s.sessionNumber - b.s.sessionNumber;
    });
  const next = upcoming[0]
    ? { id: upcoming[0].s.id, sessionNumber: upcoming[0].s.sessionNumber, date: upcoming[0].date }
    : null;

  return {
    totalSessions: total,
    doneSessions: done,
    currentStage: stage ? { id: stage.id, name: stage.name } : null,
    stageProgress,
    overallProgress: { done, total },
    nextSession: next,
  };
}

// ---------------------------------------------------------------------------
// So sánh Kế hoạch vs Thực tế (mục 14–15) — trả các dòng {label, planned, actual, differs}.
// Nhận resolver tên (id → tên) để hiển thị dịch vụ/công nghệ/protocol dễ đọc.
// ---------------------------------------------------------------------------
export interface PvARow {
  label: string;
  planned: string;
  actual: string;
  differs: boolean;
}

function j(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v || "—";
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text || "—";
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export function comparePlannedActual(
  session: Record<string, any>,
  resolve: (kind: "service" | "technology" | "protocol", id?: string | null) => string,
  fmtDate: (d?: Date | string | null) => string,
): PvARow[] {
  const rows: PvARow[] = [];
  const push = (label: string, planned: string, actual: string) =>
    rows.push({ label, planned, actual, differs: planned !== actual && actual !== "—" });

  push("Dịch vụ", resolve("service", session.plannedServiceId ?? session.serviceId), resolve("service", session.serviceId));
  push("Công nghệ", resolve("technology", session.plannedTechnologyId), resolve("technology", session.technologyId));
  push("Protocol", resolve("protocol", session.plannedProtocolId), resolve("protocol", session.brandProtocolId));
  push("Ngày", fmtDate(session.plannedDate ?? session.scheduledAt), fmtDate(session.performedAt));
  push("Vật tư", j(session.plannedMaterials), j(session.actualMaterials));
  push("Thông số", j(session.plannedParams), j(session.actualParams));
  return rows;
}
