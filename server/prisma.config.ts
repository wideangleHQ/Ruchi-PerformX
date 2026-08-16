import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// This datasource is read by the Prisma CLI only. The running API never sees
// it: PrismaService builds its own PrismaPg adapter from process.env.DATABASE_URL.
//
// So the CLI gets DIRECT_URL and the API keeps the pooler. That split is not a
// preference. DATABASE_URL is Supabase's transaction pooler on 6543, which
// cannot hold the session-level advisory lock migrate takes, so every migrate
// command run against it hangs until something kills it rather than failing
// with a message that says why. DIRECT_URL is the 5432 connection.
//
// SHADOW_DATABASE_URL is read by `prisma migrate dev`, which needs a throwaway
// database to diff against. Supabase does not hand one out, so it is optional
// and `just shadow-up` starts a local one. `migrate deploy`, the command that
// runs against production, never touches it.
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
