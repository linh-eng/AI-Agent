// Mục 9 — Bước 3: thu thập BẰNG CHỨNG THẬT (HTTP API + DB) cho A–G.
// Gọi route handler qua HTTP thật (login theo role), in JSON request/response.
// Chạy: node scripts/m9-evidence.mjs  (cần server ở :3100)
const BASE = "http://localhost:3100";
let IP = 30;

function j(x) { return JSON.stringify(x, null, 2); }
function line(t) { console.log("\n" + "=".repeat(70) + "\n" + t + "\n" + "=".repeat(70)); }

// Cookie jar theo phiên đăng nhập
async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.7.0.${IP++}` },
    body: JSON.stringify({ email, password }),
  });
  const setc = res.headers.getSetCookie?.() ?? [];
  const cookie = setc.map((c) => c.split(";")[0]).join("; ");
  return { cookie, status: res.status };
}

async function api(cookie, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, data: json?.data ?? null, error: json?.error ?? null, details: json?.details ?? null };
}

const out = {};

// --- Đăng nhập 3 role ---
const mgr = await login("quanly@sophia.com.vn", "quanly123");
const letan = await login("letan@sophia.com.vn", "letan123");
const cskh = await login("cskh@sophia.com.vn", "cskh123");
console.log("Logins:", { mgr: mgr.status, letan: letan.status, cskh: cskh.status });

// Lấy vài khách để thao tác
const custs = (await api(mgr.cookie, "GET", "/api/customers")).data;
const findCust = (code) => custs.find((c) => c.code === code);
const kA = findCust("KH-100001");   // khách A
const kB = findCust("KH-100003");   // khách B
const kBirth = findCust("KH-100002"); // sinh nhật 20/08

// =====================================================================
line("A. ÁP QUY TRÌNH 3 BƯỚC (+0/+1/+7), startDate 14/08/2026 → 3 TASK");
// =====================================================================
const tplA = (await api(mgr.cookie, "POST", "/api/followup-templates", {
  name: "EVIDENCE 3 bước", trigger: "AFTER_SERVICE",
  steps: [
    { orderIndex: 0, dayOffset: 0, channel: "IN_PERSON", title: "Dặn dò ngay", script: "Dặn kiêng nắng.", checklist: ["Nhắc kiêng nắng", "Nhắc uống nước"] },
    { orderIndex: 1, dayOffset: 1, channel: "ZALO", title: "Hỏi thăm sau 1 ngày", script: "Da có đỏ/ngứa không ạ?", checklist: ["Hỏi phản ứng"] },
    { orderIndex: 2, dayOffset: 7, channel: "SMS", title: "Mời đặt lịch buổi kế", script: "Đến lịch buổi kế rồi ạ.", checklist: ["Chốt ngày"] },
  ],
})).data;
console.log("Template tạo:", tplA.code, "id=", tplA.id, "version=", tplA.version);

const applyA = await api(cskh.cookie, "POST", `/api/followup-templates/${tplA.id}/apply`, { customerId: kA.id, anchorDate: "2026-08-14", assignee: "Lê Thị CSKH" });
console.log("POST apply → status", applyA.status);
console.log("Instance:", j(applyA.data.instance));

const instA = (await api(mgr.cookie, "GET", `/api/care-process-instances?customerId=${kA.id}`)).data.find((i) => i.templateId === tplA.id);
const tasksA = (await api(mgr.cookie, "GET", `/api/tasks?careInstanceId=${instA.id}`)).data;
out.A = {
  endpoint: `POST /api/followup-templates/${tplA.id}/apply`,
  instanceId: instA.id, instanceCode: instA.code, tasksCount: tasksA.length,
  tasks: tasksA.map((t) => ({
    id: t.id, dueDate: t.dueDate?.slice(0, 10), channel: t.channel, title: t.title, description: t.description,
    checklist: t.checklist, assignee: t.assignee, processVersion: t.processVersion, processStepId: t.processStepId,
    careProcessInstanceId: t.careProcessInstanceId, customerId: t.customerId, stepSnapshotTitle: t.stepSnapshot?.title,
  })),
};
console.log(j(out.A));

// =====================================================================
line("B. CHỐNG TRÙNG — áp lại same customer+process+startDate");
// =====================================================================
const beforeCount = (await api(mgr.cookie, "GET", `/api/care-process-instances?customerId=${kA.id}`)).data.filter((i) => i.templateId === tplA.id).length;
const dupB = await api(cskh.cookie, "POST", `/api/followup-templates/${tplA.id}/apply`, { customerId: kA.id, anchorDate: "2026-08-14" });
const afterCount = (await api(mgr.cookie, "GET", `/api/care-process-instances?customerId=${kA.id}`)).data.filter((i) => i.templateId === tplA.id).length;
out.B = { endpoint: `POST .../apply (lần 2)`, status: dupB.status, error: dupB.error, existing: dupB.details?.existing, instancesBefore: beforeCount, instancesAfter: afterCount };
console.log(j(out.B));

// =====================================================================
line("C. SNAPSHOT / VERSION — v1(A) giữ nguyên khi template lên v2, v2(B) dùng nội dung mới");
// =====================================================================
const oldTask = tasksA[0];
const bumpC = await api(mgr.cookie, "PATCH", `/api/followup-templates/${tplA.id}`, {
  steps: [
    { orderIndex: 0, dayOffset: 0, channel: "EMAIL", title: "BƯỚC MỚI v2", script: "Nội dung v2", checklist: ["Mục v2-1", "Mục v2-2"] },
  ],
});
const tplV2 = bumpC.data;
const oldTaskAfter = (await api(mgr.cookie, "GET", `/api/tasks/${oldTask.id}`)).data;
const applyB = await api(cskh.cookie, "POST", `/api/followup-templates/${tplA.id}/apply`, { customerId: kB.id, anchorDate: "2026-08-14" });
const instB = (await api(mgr.cookie, "GET", `/api/care-process-instances?customerId=${kB.id}`)).data.find((i) => i.templateId === tplA.id);
const tasksB = (await api(mgr.cookie, "GET", `/api/tasks?careInstanceId=${instB.id}`)).data;
out.C = {
  templateVersionAfterEdit: tplV2.version,
  oldTask_A: { id: oldTaskAfter.id, processVersion: oldTaskAfter.processVersion, title: oldTaskAfter.title, script: oldTaskAfter.description, checklist: oldTaskAfter.checklist, snapshotTitle: oldTaskAfter.stepSnapshot?.title },
  newInstance_B: { code: instB.code, templateVersion: instB.templateVersion },
  newTask_B: { id: tasksB[0].id, processVersion: tasksB[0].processVersion, title: tasksB[0].title, script: tasksB[0].description, checklist: tasksB[0].checklist },
};
console.log(j(out.C));

// =====================================================================
line("D. NGƯNG DÙNG TEMPLATE — không áp mới, dữ liệu cũ còn, không hard-delete");
// =====================================================================
await api(mgr.cookie, "PATCH", `/api/followup-templates/${tplA.id}`, { isActive: false });
const applyStopped = await api(cskh.cookie, "POST", `/api/followup-templates/${tplA.id}/apply`, { customerId: kBirth.id, anchorDate: "2026-08-14" });
const instStillThere = (await api(mgr.cookie, "GET", `/api/care-process-instances?customerId=${kA.id}`)).data.find((i) => i.id === instA.id);
const tasksStillThere = (await api(mgr.cookie, "GET", `/api/tasks?careInstanceId=${instA.id}`)).data.length;
out.D = {
  applyWhenStopped_status: applyStopped.status, applyWhenStopped_error: applyStopped.error,
  instanceStillExists: !!instStillThere, tasksStillCount: tasksStillThere,
};
console.log(j(out.D));
await api(mgr.cookie, "PATCH", `/api/followup-templates/${tplA.id}`, { isActive: true }); // bật lại
console.log("→ đã bật lại template để giữ demo.");

// =====================================================================
line("E. AUDIT TASK — hoàn thành / mở lại / đổi hạn-phụ trách (before/after)");
// =====================================================================
const targetTask = tasksB[0];
const comp = await api(letan.cookie, "PATCH", `/api/tasks/${targetTask.id}`, { action: "complete", completionNote: "Đã gọi, khách OK", actualChannel: "ZALO", checklistState: [true, false] });
const compTask = (await api(mgr.cookie, "GET", `/api/tasks/${targetTask.id}`)).data;
const reopen = await api(letan.cookie, "PATCH", `/api/tasks/${targetTask.id}`, { action: "reopen", reason: "Khách chưa phản hồi, gọi lại" });
const reopenTask = (await api(mgr.cookie, "GET", `/api/tasks/${targetTask.id}`)).data;
const upd = await api(letan.cookie, "PATCH", `/api/tasks/${targetTask.id}`, { action: "update", assignee: "Nguyễn Lễ Tân", dueDate: "2026-08-20", priority: "HIGH" });
out.E = {
  complete: { status: comp.status, completedAt: compTask.completedAt, completedBy: compTask.completedBy, actualChannel: compTask.actualChannel, completionNote: compTask.completionNote, checklistState: compTask.checklistState },
  reopen: { status: reopen.status, statusAfter: reopenTask.status, reopenedAt: reopenTask.reopenedAt, reopenedBy: reopenTask.reopenedBy, reopenReason: reopenTask.reopenReason },
  update: { status: upd.status, assigneeAfter: upd.data?.assignee, priorityAfter: upd.data?.priority, taskId: targetTask.id },
};
console.log(j(out.E));

// =====================================================================
line("F. RBAC BACKEND — gọi API trực tiếp với role không quyền → 403");
// =====================================================================
const mgrEdit = await api(mgr.cookie, "PATCH", `/api/followup-templates/${tplA.id}`, { name: "Quản lý sửa được" });
const letanEdit = await api(letan.cookie, "PATCH", `/api/followup-templates/${tplA.id}`, { name: "Lễ tân sửa trộm" });
const letanApply = await api(letan.cookie, "POST", `/api/followup-templates/${tplA.id}/apply`, { customerId: kA.id, anchorDate: "2026-09-01", force: true });
out.F = {
  manager_PATCH_template: { role: "MANAGER (quanly)", status: mgrEdit.status },
  reception_PATCH_template: { role: "RECEPTION (letan)", status: letanEdit.status, error: letanEdit.error },
  reception_POST_apply: { role: "RECEPTION (letan)", status: letanApply.status, error: letanApply.error },
};
console.log(j(out.F));

// =====================================================================
line("G. BIRTHDAY DUPLICATE — Chúc mừng lần 1 OK, lần 2 same → chặn");
// =====================================================================
const bdayTpl = (await api(mgr.cookie, "GET", "/api/followup-templates")).data.find((t) => t.trigger === "BIRTHDAY" && t.isActive);
const bday1 = await api(cskh.cookie, "POST", `/api/followup-templates/${bdayTpl.id}/apply`, { customerId: kBirth.id, anchorDate: "2026-08-20", assignee: "Phạm Chuyên Viên" });
const bday2 = await api(cskh.cookie, "POST", `/api/followup-templates/${bdayTpl.id}/apply`, { customerId: kBirth.id, anchorDate: "2026-08-20" });
out.G = {
  template: bdayTpl.code,
  first: { status: bday1.status, instanceCode: bday1.data?.instance?.code },
  second: { status: bday2.status, error: bday2.error, existing: bday2.details?.existing },
};
console.log(j(out.G));

console.log("\n\n##### EVIDENCE_JSON_BEGIN #####");
console.log(j({ instanceA: instA.id, instanceB: instB?.id, targetTaskE: out.E.update.taskId, templateA: tplA.id }));
console.log("##### EVIDENCE_JSON_END #####");
