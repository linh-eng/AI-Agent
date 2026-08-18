// =============================================================================
// Tính khấu hao tài sản: đường thẳng (STRAIGHT_LINE) và số dư giảm dần (DECLINING,
// gấp đôi + tự chuyển sang đường thẳng khi có lợi, chặn dưới giá trị thu hồi).
// Giá trị lũy kế / còn lại tính theo thời điểm `asOf`. Kèm bảng theo dõi theo năm.
// =============================================================================

export type DepMethod = "STRAIGHT_LINE" | "DECLINING";

export interface DepInput {
  cost: number; // nguyên giá
  salvage: number; // giá trị thu hồi ước tính
  months: number; // thời gian khấu hao (tháng)
  start: Date; // ngày bắt đầu khấu hao
  method: DepMethod;
}

export interface DepYearRow {
  year: number;
  depreciation: number; // khấu hao trong năm
  accumulated: number; // lũy kế cuối năm
  remaining: number; // còn lại cuối năm
}

export interface DepResult {
  monthly: number; // khấu hao/tháng (đường thẳng tham chiếu)
  yearlyStraight: number; // khấu hao/năm (đường thẳng tham chiếu)
  accumulated: number; // đã khấu hao lũy kế tới asOf
  remaining: number; // giá trị còn lại tới asOf
  percent: number; // % đã khấu hao (0-100)
  endDate: Date; // ngày khấu hao xong
  yearly: DepYearRow[]; // bảng theo dõi theo năm
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
const r0 = (n: number) => Math.round(n);

/** Trả về null nếu thiếu dữ liệu (nguyên giá / số tháng / ngày bắt đầu). */
export function computeDepreciation(input: DepInput, asOf = new Date()): DepResult | null {
  const { cost, months, start, method } = input;
  const salvage = Math.max(0, Math.min(input.salvage || 0, cost));
  if (!cost || cost <= 0 || !months || months <= 0 || !start || isNaN(start.getTime())) return null;

  const sl = (cost - salvage) / months; // đường thẳng / tháng
  let book = cost;
  let accToAsOf = 0;
  const perYear = new Map<number, number>(); // năm -> tổng khấu hao trong năm

  for (let m = 0; m < months; m++) {
    let dep: number;
    if (method === "DECLINING") {
      const decl = book * (2 / months);
      const slRemain = (book - salvage) / (months - m);
      dep = Math.max(decl, slRemain);
    } else {
      dep = sl;
    }
    if (book - dep < salvage) dep = book - salvage;
    if (dep < 0) dep = 0;
    book -= dep;

    const monthStart = addMonths(start, m);
    const y = monthStart.getFullYear();
    perYear.set(y, (perYear.get(y) ?? 0) + dep);
    if (monthStart < asOf) accToAsOf += dep; // đã qua tháng này tính tới asOf
  }

  // Bảng theo năm (lũy kế + còn lại cuối mỗi năm).
  const years = Array.from(perYear.keys()).sort((a, b) => a - b);
  let acc = 0;
  const yearly: DepYearRow[] = years.map((year) => {
    const dep = perYear.get(year) ?? 0;
    acc += dep;
    return { year, depreciation: r0(dep), accumulated: r0(acc), remaining: r0(cost - acc) };
  });

  const accumulated = Math.min(r0(accToAsOf), r0(cost - salvage));
  return {
    monthly: r0(sl),
    yearlyStraight: r0(sl * 12),
    accumulated,
    remaining: r0(cost - accumulated),
    percent: cost > 0 ? Math.min(100, Math.round((accumulated / cost) * 100)) : 0,
    endDate: addMonths(start, months),
    yearly,
  };
}
