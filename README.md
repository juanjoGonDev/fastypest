# Fastypest

With this library, you can run your test suites without having to stop and restore the database in between them.

Currently compatible with:

- Mysql
- MariaDB
- Postgres

Install with npm

```
npm i -D fastypest
```

To use it, you must have inserted all the seeds beforehand, and before starting the tests, you must initialize it by indicating the typeorm connection configuration. You must execute restoreData after each test, so that the database is returned to its initial state.

Example of use with jest:

```typescript
beforeAll(async () => {
  fastypest = new Fastypest(connection);
  await fastypest.init();
});

afterEach(async () => {
  await fastypest.restoreData();
});
```
