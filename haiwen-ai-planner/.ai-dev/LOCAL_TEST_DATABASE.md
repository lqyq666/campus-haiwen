# Local test database

The local Docker `postgres` service supplies the default isolated database
`haiwen_test` on `127.0.0.1`. `TEST_DATABASE_URL` overrides that URL only when
it is local and its database name ends in `_test`.

Run `pnpm db:test:setup` to create the isolated database and apply migrations,
then `pnpm db:test:check` to verify the connection and pgvector. Never run
destructive integration tests against a non-local or non-test database.
