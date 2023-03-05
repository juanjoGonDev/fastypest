<h1 align="center">FASTYPEST</h1>
<p align="center">
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/fastypest?logo=npm&logoColor=fff&label=NPM+package"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="npm peer dependency version" src="https://img.shields.io/npm/dependency-version/fastypest/peer/typeorm"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="Node version" src="https://img.shields.io/node/v/fastypest"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img src="https://img.shields.io/npm/l/fastypest" alt="Package License" /></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img src="https://img.shields.io/npm/dm/fastypest" alt="NPM Downloads" /></a>
</p>

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
