import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

const defaultTestDatabaseUrl =
  "postgresql://haiwen:haiwen@127.0.0.1:5433/haiwen_test";

export function resolveTestDatabaseUrl(environment = process.env): string {
  const value = environment.TEST_DATABASE_URL || defaultTestDatabaseUrl;
  const url = new URL(value);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("TEST_DATABASE_URL must use a local host");
  }
  if (!url.pathname.slice(1).endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must target a *_test database");
  }
  return value;
}

async function setup() {
  const databaseUrl = resolveTestDatabaseUrl();
  const url = new URL(databaseUrl);
  const database = url.pathname.slice(1);
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const rows = await admin<
      { exists: boolean }[]
    >`SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${database}) AS exists`;
    if (!rows[0]?.exists) {
      await admin.unsafe(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await admin.end();
  }
  const connection = postgres(databaseUrl, { max: 1 });
  try {
    await migrate(drizzle(connection), {
      migrationsFolder: "./lib/db/migrations",
    });
    await connection`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log(
      `TEST DATABASE\nhost: ${url.hostname}\ndatabase: ${database}\nconnection: PASS\nmigrations: PASS\npgvector: PASS`
    );
  } finally {
    await connection.end();
  }
}

async function check() {
  const databaseUrl = resolveTestDatabaseUrl();
  const url = new URL(databaseUrl);
  const connection = postgres(databaseUrl, { max: 1 });
  try {
    await connection`SELECT 1`;
    const vector = await connection<
      { extname: string }[]
    >`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (!vector.length) {
      throw new Error("pgvector is not installed");
    }
    console.log(
      `TEST DATABASE\nhost: ${url.hostname}\ndatabase: ${url.pathname.slice(1)}\nconnection: PASS\npgvector: PASS`
    );
  } finally {
    await connection.end();
  }
}

const [, , command] = process.argv;
if (command === "setup") {
  setup();
} else if (command === "check") {
  check();
} else {
  throw new Error("Expected setup or check");
}
