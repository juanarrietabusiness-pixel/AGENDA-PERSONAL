-- ============================================================
-- 0004 · El cerebro, el seguimiento, las conexiones y Claude
--
--   cerebro           lo que el asistente sabe de Juan (ficha, notas, lo aprendido)
--   avisos_enviados   lo que ya se mandó por Telegram: un aviso sale UNA vez
--   conexiones        Juancito Ads y cada cuenta de Google, con sus permisos
--   oauth_pendientes  el «state» de un permiso a medio dar (10 minutos)
--   externos          los eventos de Google Calendar leídos (una copia que se repone)
--   mcp_*             Claude como cliente del MCP de la agenda (OAuth 2.1 con PKCE)
--
-- Todo `create` lleva `if not exists` (un test lo exige).
-- ============================================================

create table if not exists cerebro (
  owner_id    text not null references usuarios(id) on delete cascade,
  id          text not null,
  tipo        text not null check (tipo in ('ficha', 'nota', 'aprendido')),
  titulo      text not null,
  texto       text not null,
  sombrero    text,
  origen      text not null default 'yo',
  usos        integer not null default 0,
  creado      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (owner_id, id)
);

create table if not exists avisos_enviados (
  owner_id text not null references usuarios(id) on delete cascade,
  clave    text not null,
  enviado  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (owner_id, clave)
);
create index if not exists avisos_enviados_fecha on avisos_enviados(enviado);

create table if not exists conexiones (
  owner_id     text not null references usuarios(id) on delete cascade,
  servicio     text not null,
  datos        text not null,
  sincronizado text,
  error        text,
  actualizado  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (owner_id, servicio)
);

create table if not exists oauth_pendientes (
  estado_hash text primary key,
  owner_id    text not null references usuarios(id) on delete cascade,
  servicio    text not null,
  verificador text not null,
  caduca      text not null
);

create table if not exists externos (
  owner_id text not null references usuarios(id) on delete cascade,
  fuente   text not null,
  id       text not null,
  tipo     text not null,
  dia      text not null,
  datos    text not null,
  primary key (owner_id, fuente, id)
);
create index if not exists externos_dia on externos(owner_id, dia);

create table if not exists mcp_clientes (
  id            text primary key,
  nombre        text not null default '',
  redirect_uris text not null,
  creado        text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists mcp_codigos (
  codigo_hash  text primary key,
  owner_id     text not null references usuarios(id) on delete cascade,
  cliente_id   text not null,
  redirect_uri text not null,
  reto         text not null,
  caduca       text not null
);

create table if not exists mcp_tokens (
  id              text primary key,
  owner_id        text not null references usuarios(id) on delete cascade,
  cliente_id      text not null,
  acceso_hash     text not null unique,
  renovacion_hash text not null unique,
  caduca          text not null,
  usado           text,
  creado          text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
