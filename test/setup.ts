// Nạp DATABASE_URL của DB test TRƯỚC khi bất kỳ module nào import PrismaClient.
import { config } from "dotenv";
config({ path: ".env.test" });

if (!process.env.DATABASE_URL || !/thng_test/.test(process.env.DATABASE_URL)) {
  throw new Error(
    "Test yêu cầu .env.test trỏ DATABASE_URL tới DB test (…/thng_test). Không chạy test trên DB thật."
  );
}
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret";
