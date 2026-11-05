-- ============================================================
-- 0002 · Los intentos fallidos de entrar
--
-- Cinco fallos desde la misma IP en 15 minutos cierran la entrada a esa IP
-- un rato; treinta en total, a todas (por si los intentos llegan repartidos).
-- La contraseña ya es lenta de probar (PBKDF2), pero sin tope cada intento
-- cuesta CPU y se puede insistir sin fin. No lleva `owner_id`: es de la
-- puerta, antes de saber quién eres. Lo de más de un día se borra solo.
-- ============================================================

create table if not exists intentos_acceso (
  id      text primary key,
  clave   text not null,
  momento text not null
);
create index if not exists intentos_momento on intentos_acceso(momento);
