// =============================================================================
// Xóa dữ liệu demo/nghiệp vụ, GIỮ LẠI người dùng + phân quyền + cài đặt công ty.
// Chạy:  npm run db:clear-demo
// LƯU Ý: không thể hoàn tác — nên tải bản sao lưu trước khi chạy.
// =============================================================================
import { clearBusinessData } from "../src/lib/maintenance-service";

async function main() {
  console.log("→ Đang xóa dữ liệu nghiệp vụ (giữ người dùng + cài đặt công ty)…");
  const counts = await clearBusinessData();
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  for (const [name, n] of Object.entries(counts)) {
    if (n > 0) console.log(`   ✓ ${name}: ${n}`);
  }
  console.log(`✔ Xong. Đã xóa ${total} bản ghi. Người dùng, phân quyền và cài đặt công ty được giữ nguyên.`);
}

main()
  .catch((e) => {
    console.error("✗ Lỗi khi xóa dữ liệu:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
