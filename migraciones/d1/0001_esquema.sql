-- ============================================================
-- 0001 · El esquema de la agenda personal
--
-- Todo `create` lleva `if not exists`: en el calendario de marketing, una
-- migración que no se podía reaplicar tumbó un despliegue entero.
--
-- Las cosas de la persona (acciones, proyectos, eventos, personas) van como
-- JSON en `elementos`: el modelo todavía cambia, es una sola persona y son
-- cientos de filas, no millones. Todo lleva `owner_id` desde el principio:
-- D1 no tiene RLS, y si un día se comparte algo, la base no se rehace.
-- ============================================================

create table if not exists usuarios (
  id     text primary key,
  email  text not null unique,
  nombre text not null default '',
  hash   text not null,
  creado text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists sesiones (
  huella     text primary key,
  usuario_id text not null references usuarios(id) on delete cascade,
  creada     text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  caduca     text not null
);
create index if not exists sesiones_usuario on sesiones(usuario_id);

create table if not exists elementos (
  owner_id    text not null references usuarios(id) on delete cascade,
  tipo        text not null check (tipo in ('accion', 'proyecto', 'evento', 'persona')),
  id          text not null,
  datos       text not null,
  actualizado text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (owner_id, tipo, id)
);

-- Los ajustes (horarios, IA, versículos) y el ritmo de la semana: una fila por persona.
create table if not exists perfil (
  owner_id    text primary key references usuarios(id) on delete cascade,
  ajustes     text not null,
  ritmo       text not null,
  actualizado text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Lo que se captura, tal cual, ANTES de que lo lea la IA: si la IA falla, se queda en la Bandeja.
create table if not exists capturas (
  id        text primary key,
  owner_id  text not null references usuarios(id) on delete cascade,
  texto     text not null,
  canal     text not null default 'app',
  estado    text not null default 'pendiente' check (estado in ('pendiente', 'ordenada', 'error', 'deshecha')),
  resultado text,
  error     text,
  creada    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists capturas_owner on capturas(owner_id, estado, creada);

-- Cada llamada a la IA deja su costo.
create table if not exists consumo_ia (
  id       text primary key,
  owner_id text not null references usuarios(id) on delete cascade,
  modelo   text not null,
  funcion  text not null,
  entrada  integer not null default 0,
  salida   integer not null default 0,
  costo    real not null default 0,
  creado   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists consumo_owner on consumo_ia(owner_id, creado);
