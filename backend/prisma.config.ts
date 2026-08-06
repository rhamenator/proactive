import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    // Client generation does not connect, so CI can use a non-routable URL.
    // Runtime connections still require DATABASE_URL in createPrismaAdapter().
    url: process.env.DATABASE_URL ?? 'postgresql://prisma:prisma@127.0.0.1:5432/proactive'
  }
});
