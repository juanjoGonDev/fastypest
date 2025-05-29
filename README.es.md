<h1 align="center">FASTYPEST</h1>
<p align="center">
  <img alt="Actividad de commits" src="https://img.shields.io/github/commit-activity/m/juanjoGonDev/fastypest"/>
  <img alt="Último commit" src="https://img.shields.io/github/last-commit/juanjoGonDev/fastypest"/>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="Versión en GitHub" src="https://img.shields.io/github/package-json/v/juanjoGonDev/fastypest?logo=github&logoColor=fff&label=GitHub+package"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="Versión en npm" src="https://img.shields.io/npm/v/fastypest?logo=npm&logoColor=fff&label=Paquete+NPM"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img alt="Versión peer typeorm" src="https://img.shields.io/github/package-json/dependency-version/juanjoGonDev/fastypest/peer/typeorm"></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img src="https://img.shields.io/github/license/juanjoGonDev/fastypest" alt="Licencia del paquete" /></a>
  <a href="https://www.npmjs.com/fastypest" target="_blank"><img src="https://img.shields.io/npm/dm/fastypest" alt="Descargas mensuales" /></a>
</p>
<p align="center">
  <a href="https://buymeacoffee.com/juanjogondev" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Invítame a un café"></a>
</p>

[![en](https://img.shields.io/badge/lang-en-blue.svg)](./README.md)

Con esta librería puedes ejecutar tus tests sin tener que parar y restaurar la base de datos entre ellos.

Actualmente compatible con:

- <a href="https://www.npmjs.com/fastypest"><img alt="MySQL >= v5.7 supported" src="https://img.shields.io/badge/MySQL-%3E%3D5.7-informational"></a>
- <a href="https://www.npmjs.com/fastypest"><img alt="MariaDB >= v10.0 supported" src="https://img.shields.io/badge/MariaDB-%3E%3D10.0-yellowgreen"></a>
- <a href="https://www.npmjs.com/fastypest"><img alt="Postgres >= v9.0 supported" src="https://img.shields.io/badge/Postgres-%3E%3D9.0-green"></a>
- <a href="https://www.npmjs.com/fastypest"><img alt="cockroachDB >= v22.2.0 supported" src="https://img.shields.io/badge/CockroachDB-%3E%3D22.2.0-blue"></a>

Si necesitas soporte para otra base de datos, puedes solicitarlo [aquí](https://github.com/juanjoGonDev/fastypest/issues/new?assignees=juanjoGonDev&labels=enhancement&template=feature.yml).

Instalación:

```
npm i -D fastypest
```

Para usarlo, debes insertar todos los seeds antes de iniciar los tests, y antes de iniciar los tests, debes inicializarlo indicando la configuración de la conexión de typeorm. Debes ejecutar restoreData después de cada test, para que la base de datos se devuelva a su estado inicial.

Ejemplo de uso con Jest:

> **Nota**
> (Recomiendo usarlo en [setupFilesAfterEnv](https://jestjs.io/es-ES/docs/configuration#setupfilesafterenv-array)):

```typescript
beforeAll(async () => {
  fastypest = new Fastypest(connection);
  await fastypest.init();
});

afterEach(async () => {
  await fastypest.restoreData();
});
```

## ⚙️ Flujo de trabajo automatizado

Este proyecto usa un sistema CI/CD avanzado con GitHub Actions:

- 🤖 Los PR de Dependabot se aprueban automáticamente solo si son actualizaciones seguras (patch/minor o dependencias de desarrollo)
- 🔁 Se lanza una nueva versión automáticamente cada 3 commits usando un contador
- 📦 Cuando toca publicar, se crea un pull request automáticamente con el cambio de versión
- 👤 El PR se asigna al mantenedor y se aprueba automáticamente (si se cumplen las condiciones)
- ✅ Todos los tests deben pasar antes de hacer merge
- 🚀 Al fusionarse, la nueva versión se publica automáticamente en NPM
- 🧪 Antes de publicar, se realiza una prueba de instalación completa para asegurar la integridad del paquete

Este sistema garantiza entregas fiables, frecuentes y sin fricción, manteniendo siempre el control sobre los cambios críticos

## Historial de Estrellas

[![Star History Chart](https://api.star-history.com/svg?repos=juanjoGonDev/fastypest&type=Date)](https://www.star-history.com/#juanjoGonDev/fastypest&Date)
