# Agenda personal

Un asistente personal de tareas, reuniones y recordatorios. Le cuentas lo que
tienes en la cabeza (por Telegram, por Claude o en la aplicación, escribiendo o
con una nota de voz) y él lo aclara y lo ordena con GTD, lo acomoda en un solo
día con el color de cada sombrero (Trabajo, Artístico, Iglesia, Personal) y te
da seguimiento hasta que lo cumplas, con personalidad cristiana y sin volverse
pesado.

Es privada, de una sola persona, y va aparte del calendario de la agencia
(Juancito Ads), aunque lee de él las tareas de trabajo y de Google Calendar los
eventos.

**Estado:** fase 1A. Hay servidor (Worker de Cloudflare con D1), acceso con contraseña y
un asistente que ordena lo capturado con Muse Spark o Claude. Sale en `agenda.juancitoads.com`; los pasos para
desplegarla, sólo de navegador, están en [`DEPLOY.md`](DEPLOY.md). La propuesta completa, con lo que falta decidir, está en
[`docs/propuesta.md`](docs/propuesta.md).

```bash
npm install
npm run dev         # sólo la interfaz: el prototipo (datos de ejemplo, se guarda en el navegador)
npm run dev:worker  # la aplicación con su servidor en local (wrangler, con D1 local)
npm run verificar   # lint + pruebas + build, lo mismo que CI
```

Para `dev:worker` hace falta un `.dev.vars` (no se versiona) con `CODIGO_ALTA=…` y, si se quiere IA, las llaves; y
antes, una vez: `npx wrangler d1 migrations apply agenda-personal-db --local`.
