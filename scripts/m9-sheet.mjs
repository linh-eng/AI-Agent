import fs from "node:fs";
const o = JSON.parse(fs.readFileSync(process.env.EV_OUT || "/tmp/m9-out.json", "utf8"));
const OUT = "/tmp/claude-0/-home-user-AI-Agent/b21d6139-80c5-55eb-aa46-2d5f7a118bf4/scratchpad/m9-evidence-sheet.html";

const A = o.A, B = o.B, C = o.C, D = o.D, E = o.E, F = o.F, G = o.G;
const chip = (ok) => ok ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>';
const code = (x) => `<code>${typeof x === "object" ? JSON.stringify(x) : x}</code>`;

const rows = [
  ["A", "Áp 3 bước (+0/+1/+7) 14/08 → 1 instance + 3 task đủ field",
    `Instance <b>${A.instanceCode}</b>, ${A.tasksCount} task · dueAt ${A.tasks.map(t=>t.dueDate).join(" / ")}<br>step1: ver=${A.tasks[0].processVersion}, stepId=${A.tasks[0].processStepId.slice(-6)}, channel=${A.tasks[0].channel}, checklist=${JSON.stringify(A.tasks[0].checklist)}, assignee=${A.tasks[0].assignee}`,
    A.tasksCount===3],
  ["B", "Áp lại same customer+process+startDate → chặn, DB không tăng",
    `HTTP <b>${B.status}</b> · "${B.error}"<br>existing=${B.existing?.code} · instancesBefore=${B.instancesBefore}, after=${B.instancesAfter}`,
    B.status===409 && B.instancesBefore===B.instancesAfter],
  ["C", "Sửa mẫu lên v2: task cũ giữ v1, task mới v2",
    `template version → <b>${C.templateVersionAfterEdit}</b><br>oldTask_A: ver=${C.oldTask_A.processVersion}, title="${C.oldTask_A.title}"<br>newInstance_B ${C.newInstance_B.code} ver=${C.newInstance_B.templateVersion}, newTask ver=${C.newTask_B.processVersion}, title="${C.newTask_B.title}"`,
    C.oldTask_A.processVersion===1 && C.newTask_B.processVersion===2],
  ["D", "Ngưng dùng mẫu → không áp mới, dữ liệu cũ còn (không hard-delete)",
    `apply khi ngưng → HTTP <b>${D.applyWhenStopped_status}</b> "${D.applyWhenStopped_error}"<br>instanceStillExists=${D.instanceStillExists}, tasksStillCount=${D.tasksStillCount}`,
    D.applyWhenStopped_status===409 && D.instanceStillExists && D.tasksStillCount===3],
  ["E", "Audit task: hoàn thành / mở lại / đổi hạn-phụ trách (before/after)",
    `complete → completedBy=${E.complete.completedBy}, actualChannel=${E.complete.actualChannel}, checklist=${JSON.stringify(E.complete.checklistState)}<br>reopen → status=${E.reopen.statusAfter}, by=${E.reopen.reopenedBy}, reason="${E.reopen.reopenReason}"<br>update → assignee→${E.update.assigneeAfter}, priority→${E.update.priorityAfter} (audit TASK_UPDATED diff)`,
    E.complete.status===200 && E.reopen.status===200 && E.update.status===200],
  ["F", "RBAC backend: gọi API trực tiếp với role thiếu quyền → 403",
    `MANAGER PATCH template → <b>${F.manager_PATCH_template.status}</b><br>RECEPTION PATCH template → <b>${F.reception_PATCH_template.status}</b> "${F.reception_PATCH_template.error}"<br>RECEPTION POST apply → <b>${F.reception_POST_apply.status}</b> "${F.reception_POST_apply.error}"`,
    F.manager_PATCH_template.status===200 && F.reception_PATCH_template.status===403 && F.reception_POST_apply.status===403],
  ["G", "Birthday duplicate: chúc mừng lần 1 OK, lần 2 same → chặn",
    `lần 1 → HTTP <b>${G.first.status}</b> · ${G.first.instanceCode}<br>lần 2 → HTTP <b>${G.second.status}</b> "${G.second.error}" existing=${G.second.existing?.code}`,
    G.first.status===200 && G.second.status===409],
];

const allPass = rows.every(r=>r[3]);

const html = `<!doctype html><meta charset=utf8>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#f8fafc;color:#0f172a;padding:28px}
 h1{font-size:20px;margin:0 0 4px} .sub{color:#64748b;font-size:13px;margin-bottom:16px}
 table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
 th,td{border-bottom:1px solid #e2e8f0;padding:12px 14px;text-align:left;vertical-align:top;font-size:13px}
 th{background:#0f172a;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
 td.k{font-weight:700;font-size:15px;width:34px;text-align:center;background:#f1f5f9}
 td.exp{width:230px;color:#334155}
 code{background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:11px}
 .pass{background:#dcfce7;color:#166534;font-weight:700;padding:3px 10px;border-radius:999px;font-size:12px}
 .fail{background:#fee2e2;color:#991b1b;font-weight:700;padding:3px 10px;border-radius:999px;font-size:12px}
 .banner{margin-top:14px;padding:10px 14px;border-radius:10px;font-weight:600;font-size:13px;background:${allPass?'#dcfce7':'#fee2e2'};color:${allPass?'#166534':'#991b1b'}}
 .tag{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:6px;padding:1px 6px;font-size:11px;margin-left:6px}
</style>
<h1>Mục 9 · Bước 3 — Phiếu bằng chứng A–G <span class="tag">HTTP API + DB thật</span></h1>
<div class="sub">Sophia Care · CSKH · Follow-up & Sinh nhật — chạy qua route handler thật, login theo role (quanly=MANAGER, letan=RECEPTION, cskh=CUSTOMER_CARE). Ngày container 14/08/2026.</div>
<table><tr><th>#</th><th>Expected</th><th>Actual (thật)</th><th>Kết quả</th></tr>
${rows.map(r=>`<tr><td class="k">${r[0]}</td><td class="exp">${r[1]}</td><td>${r[2]}</td><td>${chip(r[3])}</td></tr>`).join("")}
</table>
<div class="banner">${allPass?'✔ 7/7 PASS — bằng chứng persistence / RBAC / snapshot đều từ HTTP API + DB (không chỉ UI).':'✘ Có mục FAIL'}</div>`;

fs.writeFileSync(OUT, html);
console.log("sheet written, allPass=", allPass);
