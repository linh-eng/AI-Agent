-- AlterTable — quyền bổ sung cấp riêng cho tài khoản (ngoài vai trò). Additive, mặc định rỗng.
ALTER TABLE "users" ADD COLUMN     "extraPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
