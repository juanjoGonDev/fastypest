<h1 align="center">FASTYPEST</h1>
<p align="center">
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/juanjoGonDev/fastypest"/>
  <img alt="Github Last Commit" src="https://img.shields.io/github/last-commit/juanjoGonDev/fastypest"/>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/v/juanjoGonDev/fastypest?logo=github&logoColor=fff&label=GitHub+package"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/fastypest?logo=npm&logoColor=fff&label=NPM+package"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="npm peer dependency version" src="https://img.shields.io/github/package-json/dependency-version/juanjoGonDev/fastypest/peer/typeorm"></a>
  <!-- <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="Node version" src="https://img.shields.io/node/v/fastypest"></a> -->
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img src="https://img.shields.io/github/license/juanjoGonDev/fastypest" alt="Package License" /></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img src="https://img.shields.io/npm/dm/fastypest" alt="NPM Downloads" /></a>
</p>
<p align=center>
<a href="https://buymeacoffee.com/juanjogondev" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>
</p>

With this library, you can run your test suites without having to stop and restore the database in between them.

Currently compatible with:

- <a href="https://www.npmjs.com/fastypest"><img alt="MySQL >= v5.7 supported" src="https://img.shields.io/badge/MySQL-%3E%3D5.7-informational"></a>
- <a href="https://www.npmjs.com/fastypest"><img alt="MariaDB >= v10.0 supported" src="https://img.shields.io/badge/MariaDB-%3E%3D10.0-yellowgreen"></a>
- <a href="https://www.npmjs.com/fastypest"><img alt="Postgres >= v9.0 supported" src="https://img.shields.io/badge/Postgres-%3E%3D9.0-green"></a>
- <a href="https://www.npmjs.com/fastypest"><img alt="cockroachDB >= v22.2.0 supported" src="https://img.shields.io/badge/CockroachDB-%3E%3D22.2.0-blue"></a>

If you need compatibility with another database, you can request it <b><a href="https://github.com/juanjoGonDev/fastypest/issues/new?assignees=juanjoGonDev&labels=enhancement&projects=&template=feature.yml&title=%5BFeature+Request%5D%3A+">here</a></b>.

Install with npm

```
npm i -D fastypest
```

To use it, you must have inserted all the seeds beforehand, and before starting the tests, you must initialize it by indicating the typeorm connection configuration. You must execute restoreData after each test, so that the database is returned to its initial state.

Example of use with jest

> **Note**
> (I recommend using it in a [setupFilesAfterEnv](https://jestjs.io/es-ES/docs/configuration#setupfilesafterenv-array) file):

```typescript
beforeAll(async () => {
  fastypest = new Fastypest(connection);
  await fastypest.init();
});

afterEach(async () => {
  await fastypest.restoreData();
});
```
