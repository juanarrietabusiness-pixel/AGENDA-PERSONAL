-- ============================================================
-- 0003 · Telegram: qué chat es de quién
--
-- El webhook de Telegram llega SIN sesión: lo único que dice de quién es un
-- mensaje es el chat. Un chat queda atado a la cuenta con un código de un
-- solo uso que da la aplicación (15 minutos); del código sólo se guarda la
-- huella. Un chat que no esté aquí no recibe respuesta.
-- ============================================================

create table if not exists telegram (
  owner_id  text primary key references usuarios(id) on delete cascade,
  chat_id   text unique,
  nombre    text not null default '',
  vinculado text,
  codigo    text,
  caduca    text
);
