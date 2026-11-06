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

**Estado:** en línea en `agenda.juancitoads.com`, con servidor (Worker de Cloudflare con D1), acceso con contraseña y
un asistente (Muse Spark o Claude) que ordena lo que le dices por la aplicación, por Telegram o desde Claude. Tres
pantallas —**Hoy** (día, semana o mes, con tareas, reuniones, recordatorios y eventos especiales), **Plan** (tu semana y
tus sombreros, que puedes renombrar, crear y ordenar por prioridad) y **Mentor** (qué vale más, qué delegar, qué
soltar, y lo que el asistente sabe de ti)—, el asistente en una burbuja en todas, y conectada con **Juancito Ads**,
**Google Calendar y Google Tasks** (las dos cuentas) y **Claude**. El seguimiento por Telegram se configura en Ajustes.
Los pasos para desplegarla y conectar todo, sólo de navegador, están en [`DEPLOY.md`](DEPLOY.md); la propuesta, en
[`docs/propuesta.md`](docs/propuesta.md).

```bash
npm install
npm run dev         # sólo la interfaz: el prototipo (datos de ejemplo, se guarda en el navegador)
npm run dev:worker  # la aplicación con su servidor en local (wrangler, con D1 local)
npm run verificar   # lint + pruebas + build, lo mismo que CI
```

Para `dev:worker` hace falta un `.dev.vars` (no se versiona) con `CODIGO_ALTA=…` y, si se quiere IA, las llaves; y
antes, una vez: `npx wrangler d1 migrations apply agenda-personal-db --local`.
