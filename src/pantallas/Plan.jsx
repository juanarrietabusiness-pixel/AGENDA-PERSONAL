import { useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import Fila from "../componentes/Fila.jsx";
import { lunesDe, sumarDias, sumarMeses, DIAS, DIAS_CORTOS, MESES, partes, diaSemana, horaCorta, rangoCorto, textoCorto, textoLargo, minutos, aHora } from "../lib/fechas.js";
import { eventosDelDia } from "../lib/hoy.js";
import { sombrerosDe, estiloDe, nombreDe, balance, descuidados, aplicarSombrero, COLORES } from "../lib/sombreros.js";
import { cuadrante } from "../lib/prioridad.js";
import { ordenarPor, claseDeGoogle, esTodoElDia, eventosPorAgendar, normalizarEvento, porAgendar } from "../lib/agenda.js";
import { nuevaAccion } from "../lib/metodo.js";
import { RITMO_BASE, aplicarRitmo } from "../lib/ritmo.js";
import SemanaTipo from "../componentes/SemanaTipo.jsx";
import AsignarBloque from "../componentes/AsignarBloque.jsx";
import EditarBloque from "../componentes/EditarBloque.jsx";
import ProyectosConFecha from "../componentes/ProyectosConFecha.jsx";
import SemanaRejilla from "../componentes/SemanaRejilla.jsx";
import MesVista from "../componentes/MesVista.jsx";
import CrearAqui from "../componentes/CrearAqui.jsx";
import AnadirRapido from "../componentes/AnadirRapido.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { piezasDelDia, huecos, ventanaDelDia, duracionCercana } from "../lib/rejilla.js";
import { seriesTraidas, horasPorSombrero, semanaDelDia, diaEnBloques, minutosSinSombrero, porRevisar, textoHoras, rutinaDeGoogle, moverSiempre } from "../lib/semana.js";
import { zonaDeSoltar, empezarArrastre } from "../lib/arrastre.js";
import * as api from "../lib/api.js";

const PRIORIDADES = { alta: "Alta", media: "Media", baja: "Baja" };
const EN_BLOQUE = 3; // tareas que se ven dentro de un bloque; las demás, al tocarlo
const VISTAS = { semana: "Semana", horas: "Horas", mes: "Mes" };

const leerVista = () => {
  try {
    return VISTAS[localStorage.getItem("plan-vista")] ? localStorage.getItem("plan-vista") : "semana";
  } catch {
    return "semana";
  }
};

/**
 * Tu plan, para TRABAJAR en él: la semana como lista (cada día en una columna), con horas (un calendario) o el mes. En
 * cualquiera se crea tocando un espacio (o el «+» de un día), se mueve arrastrando y se sueltan las tareas del panel.
 * «Semana tipo» edita lo que se repite en el mismo calendario. A la derecha: añadir, lo por agendar, tus sombreros y tus
 * proyectos con fecha.
 */
export default function Plan({ estado, hoy, hora, cambiar, onHecha, onAbrir, avisar, servidor = false, recargar }) {
  const id = useId();
  const { acciones, eventos, ajustes } = estado;
  const sombreros = sombrerosDe(ajustes);
  const ritmo = estado.ritmo ?? RITMO_BASE;
  const [vista, setVistaE] = useState(leerVista);
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const [mes, setMes] = useState(() => `${hoy.slice(0, 8)}01`);
  const [tipo, setTipo] = useState(false);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const [vistoSel, setVisto] = useState(hoy);
  const visto = dias.includes(vistoSel) ? vistoSel : dias[0];
  const [asignando, setAsignando] = useState(null);
  const [crear, setCrear] = useState(null);
  const [alcance, setAlcance] = useState(null);
  const [editRitmo, setEditRitmo] = useState(null);

  const setVista = (v) => {
    setVistaE(v);
    try {
      localStorage.setItem("plan-vista", v);
    } catch {
      /* sin almacenamiento, se recuerda sólo en esta visita */
    }
  };

  const traidas = seriesTraidas(ritmo);
  const externos = (estado.externos ?? []).filter((x) => !traidas.has(x.serie));
  const propioDeGoogle = (x) => eventos.some((p) => p.google?.id && (p.google.id === x.id || String(x.id).startsWith(`${p.google.id}_`)));
  const googleDelDia = (d) =>
    externos.filter((x) => x.tipo === "evento" && x.dia === d && !propioDeGoogle(x)).map((x) => ({ ...x, fuente: "google", clase: claseDeGoogle(x, ajustes) }));

  const porDia = dias.map((d) => {
    if (tipo) {
      const base = diaEnBloques(ritmo, d, [], { tipo: true });
      return { dia: d, eventos: [], ...base, ...piezasDelDia({ ...base, eventos: [] }) };
    }
    const propios = eventosDelDia(eventos, d).map((e) => ({ ...e, fuente: "agenda" }));
    const tareas = acciones.filter((a) => a.estado === "abierta" && (a.cuando === d || (!a.cuando && a.limite === d)));
    const base = diaEnBloques(ritmo, d, tareas);
    const todos = [...propios, ...googleDelDia(d)];
    return { dia: d, eventos: todos, ...base, ...piezasDelDia({ ...base, eventos: todos }) };
  });

  // Lo de un día del mes: lo especial, las reuniones y compromisos (no tu rutina, que se repite) y las tareas.
  const cosasDe = (d) => {
    const ev = eventosDelDia(eventos, d).map((e) => ({ clave: `e:${e.id}`, tipo: e.clase === "especial" ? "especial" : "evento", titulo: e.titulo, sombrero: e.sombrero, obj: { ...e, fuente: "agenda" } }));
    const g = googleDelDia(d)
      .filter((x) => x.clase !== "rutina")
      .map((x) => ({ clave: `g:${x.id}`, tipo: x.todoElDia ? "especial" : "evento", titulo: x.titulo, color: x.color, obj: x }));
    const t = acciones
      .filter((a) => a.estado === "abierta" && (a.cuando === d || (!a.cuando && a.limite === d)))
      .map((a) => ({ clave: `t:${a.id}`, tipo: "tarea", titulo: a.titulo, sombrero: a.sombrero, obj: a }));
    const peso = { especial: 0, evento: 1, tarea: 2 };
    return [...ev, ...g, ...t].sort((a, b) => peso[a.tipo] - peso[b.tipo] || String(a.obj.inicio ?? a.obj.hora ?? "99").localeCompare(String(b.obj.inicio ?? b.obj.hora ?? "99")));
  };

  // Las horas de cada sombrero salen de tus bloques y compromisos fijos; sin ninguno con sombrero, de lo que pasó esta semana.
  const porBloques = horasPorSombrero(ritmo, sombreros);
  const hayBloques = porBloques.some((f) => f.minutos > 0);
  const sinSombrero = hayBloques ? minutosSinSombrero(ritmo, sombreros) : 0;
  const filas = hayBloques ? porBloques : balance({ eventos: porDia.flatMap((p) => p.eventos.filter((e) => e.fuente !== "google")), hechas: porDia.flatMap((p) => [...p.tareas, ...p.bloques.flatMap((b) => b.tareas)]) }, sombreros);
  const totalMin = filas.reduce((t, f) => t + (f.minutos ?? 0), 0) + sinSombrero;
  const flojos = descuidados(filas);
  const bloquesSinSombrero = porRevisar(ritmo, sombreros).sinSombrero.length;

  // Lo de Google que se repite y es sólo tuyo, todavía sin pasar a Kairos (allá no se mueve ni se edita igual).
  const deGoogle = rutinaDeGoogle(estado.externos ?? [], ritmo, { ajustes, todas: true });
  const google = (estado.conexiones ?? []).filter((c) => c.servicio?.startsWith("google:"));
  const publicada = google.some((c) => c.semana);

  const aplicarAlRitmo = (cambio, aviso) => {
    try {
      const r = aplicarRitmo(ritmo, { hoy, ...cambio });
      cambiar((e) => ({ ...e, ritmo: r.ritmo }));
      if (aviso) avisar(aviso(r.bloque));
      return null;
    } catch (err) {
      return err.message;
    }
  };
  const conAviso = (err) => err && avisar(err);

  const abrir = (tipoA, obj, dia) => {
    if (tipoA === "ritmo") return setEditRitmo({ item: ritmo.find((x) => x.id === obj.id) ?? obj, dia });
    if (tipoA === "evento") return onAbrir("evento", eventos.find((x) => x.id === obj.id) ?? obj);
    return onAbrir(tipoA, obj);
  };
  const abrirBloque = (bloque, dia) => {
    const base = ritmo.find((x) => x.id === bloque.id) ?? bloque;
    if (tipo) setEditRitmo({ item: base, dia });
    else setAsignando({ bloque, dia });
  };

  /** Mover o estirar algo en el calendario. Lo que se repite pregunta: ¿sólo este día o todas las semanas? */
  const mover = (p, { dia, inicio, fin, desde }) => {
    if (p.tipo === "bloque" || p.tipo === "compromiso") {
      const base = ritmo.find((x) => x.id === p.obj.id);
      if (!base) return;
      if (tipo) return conAviso(aplicarAlRitmo(moverSiempre(base, { desde, a: dia, inicio, fin }), (b) => `«${b.titulo.trim()}»: ahora ${rangoCorto(inicio, fin)}.`));
      return setAlcance({ base, desde, dia, inicio, fin });
    }
    if (p.tipo === "evento") {
      const e = eventos.find((x) => x.id === p.obj.id);
      if (!e) return;
      if (e.repite?.regla) {
        if (dia !== desde) return avisar(`«${e.titulo}» se repite: para cambiarle el día, ábrelo.`);
        cambiar((s) => ({ ...s, eventos: s.eventos.map((x) => (x.id === e.id ? normalizarEvento({ ...x, inicio, fin }) : x)) }));
        return avisar(`«${e.titulo}»: ahora ${rangoCorto(inicio, fin)}, todas las veces.`);
      }
      cambiar((s) => ({ ...s, eventos: s.eventos.map((x) => (x.id === e.id ? normalizarEvento({ ...x, fecha: dia, inicio, fin }) : x)) }));
      return avisar(`«${e.titulo}»: ${textoCorto(dia, hoy)}, ${rangoCorto(inicio, fin)}.`);
    }
    if (p.tipo === "tarea") {
      cambiar((s) => ({ ...s, acciones: s.acciones.map((x) => (x.id === p.obj.id ? { ...x, cuando: dia, hora: inicio, minutos: duracionCercana(minutos(fin) - minutos(inicio)), bloque: null } : x)) }));
      avisar(`«${p.titulo}»: ${textoCorto(dia, hoy)}, ${rangoCorto(inicio, fin)}.`);
    }
  };

  const aplicarAlcance = (siempre) => {
    const { base, desde, dia, inicio, fin } = alcance;
    setAlcance(null);
    conAviso(
      siempre
        ? aplicarAlRitmo(moverSiempre(base, { desde, a: dia, inicio, fin }), (b) => `«${b.titulo.trim()}»: todas las semanas, ${DIAS[diaSemana(dia)]} ${rangoCorto(inicio, fin)}.`)
        : aplicarAlRitmo({ accion: "unDia", id: base.id, dia: desde, nuevoDia: dia, inicio, fin }, (b) => `«${b.titulo.trim()}»: sólo el ${textoLargo(dia)}, ${rangoCorto(inicio, fin)}.`),
    );
  };

  /** Soltar una tarea (o una reunión) en un día, a una hora o en un bloque. `hora`/`bloque` sin dar: se quedan como estaban. */
  const soltar = (d, { dia, hora: h, bloque }) => {
    if (d.tipo === "accion") {
      const a = acciones.find((x) => x.id === d.id);
      if (!a) return;
      cambiar((s) => ({ ...s, acciones: s.acciones.map((x) => (x.id === a.id ? { ...x, cuando: dia, ...(h !== undefined ? { hora: h } : {}), ...(bloque !== undefined ? { bloque } : {}) } : x)) }));
      const nombreBloque = bloque && ritmo.find((b) => b.id === bloque)?.titulo?.trim();
      return avisar(`«${a.titulo}»: ${textoCorto(dia, hoy)}${h ? `, ${horaCorta(h)}` : ""}${nombreBloque ? `, en ${nombreBloque}` : ""}.`);
    }
    const e = eventos.find((x) => x.id === d.id);
    if (!e) return;
    if (e.repite?.regla) return avisar(`«${e.titulo}» se repite: para cambiarle el día, ábrelo.`);
    const ini = h ?? (porAgendar(e) || esTodoElDia(e) ? null : e.inicio);
    const dura = e.inicio && e.fin && !esTodoElDia(e) ? minutos(e.fin) - minutos(e.inicio) : 60;
    cambiar((s) => ({ ...s, eventos: s.eventos.map((x) => (x.id === e.id ? normalizarEvento({ ...x, fecha: dia, inicio: ini ?? "00:00", fin: ini ? aHora(Math.min(minutos(ini) + dura, 23 * 60 + 59)) : "23:59" }) : x)) }));
    avisar(`«${e.titulo}»: ${textoCorto(dia, hoy)}${ini ? `, ${horaCorta(ini)}` : ""}.`);
  };

  const pasarAKairos = () => {
    const { nuevos, quitar } = deGoogle;
    cambiar((e) => ({ ...e, ritmo: [...(e.ritmo ?? RITMO_BASE).filter((x) => !quitar.includes(x.id)), ...nuevos] }));
    const ofrecer = servidor && google.length > 0 && !publicada;
    avisar(
      `Pasé ${nuevos.length} a tu semana tipo: ahora se mueven y se editan aquí.${ofrecer ? " ¿La publico en tu Google Calendar (en «Kairos · Bloques»)?" : ""}`,
      ofrecer
        ? {
            accion: "Publicar",
            alPulsar: async () => {
              await api.googleSemana(true).catch(() => null);
              await recargar?.();
            },
          }
        : {},
    );
  };

  const anadirSinFecha = ({ titulo, sombrero }) => {
    cambiar((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero, lista: "siguientes", origen: "app" }, hoy)] }));
    avisar(`Añadida a ${sombrero ? nombreDe(sombrero, sombreros) : "tus tareas"}: «${titulo}». Arrástrala a un día o a un hueco cuando quieras.`);
  };

  const navegar = (n) => (vista === "mes" && !tipo ? setMes(sumarMeses(mes, n)) : setLunes(sumarDias(lunes, 7 * n)));
  const enHoy = vista === "mes" && !tipo ? mes === `${hoy.slice(0, 8)}01` : lunes === lunesDe(hoy);
  const verVista = tipo ? "horas" : vista;
  const titulo = vista === "mes" && !tipo
    ? `${MESES[partes(mes).mes - 1]} ${partes(mes).anio}`
    : partes(dias[0]).mes === partes(dias[6]).mes
      ? `${partes(dias[0]).dia} al ${partes(dias[6]).dia} de ${MESES[partes(dias[6]).mes - 1]}`
      : `${partes(dias[0]).dia} de ${MESES[partes(dias[0]).mes - 1]} al ${partes(dias[6]).dia} de ${MESES[partes(dias[6]).mes - 1]}`;

  return (
    <div className={`plan${tipo ? " editando-tipo" : ""}`}>
      <div className="plan-cabeza">
        <div className="plan-titulo">
          <h1 className="titulo-pantalla">{tipo ? "Tu semana tipo" : "Tu plan"}</h1>
          {tipo ? (
            <p className="subtitulo">Lo que se repite cada semana. Arrastra para moverlo o estirarlo; toca un espacio vacío para crear.</p>
          ) : (
            <div className="plan-nav">
              <button type="button" className="boton fantasma icono" onClick={() => navegar(-1)} aria-label={vista === "mes" ? "Mes anterior" : "Semana anterior"}><Icon name="chevronLeft" size={18} /></button>
              <strong>{titulo}</strong>
              <button type="button" className="boton fantasma icono" onClick={() => navegar(1)} aria-label={vista === "mes" ? "Mes siguiente" : "Semana siguiente"}><Icon name="chevronRight" size={18} /></button>
              {!enHoy && <button type="button" className="boton fantasma" onClick={() => { setLunes(lunesDe(hoy)); setMes(`${hoy.slice(0, 8)}01`); }}>Hoy</button>}
            </div>
          )}
        </div>
        <div className="plan-controles">
          {!tipo && (
            <div className="segmentado" role="group" aria-label="Cómo ver tu plan">
              {Object.entries(VISTAS).map(([k, t]) => (
                <button key={k} type="button" className={k === "horas" ? "solo-ancho" : undefined} aria-pressed={vista === k} onClick={() => setVista(k)}>{t}</button>
              ))}
            </div>
          )}
          <button type="button" className={`boton${tipo ? " primario" : ""}`} aria-pressed={tipo} onClick={() => setTipo(!tipo)}>
            <Icon name={tipo ? "check" : "layers"} size={15} /> {tipo ? "Listo" : "Semana tipo"}
          </button>
        </div>
        {verVista !== "mes" && (
          <ul className="leyenda-semana" aria-label="Qué es cada cosa">
            <li><span className="ley-bloque" aria-hidden="true" /> Bloque</li>
            <li><Icon name="calendar" size={13} /> Compromiso</li>
            <li><Icon name="bell" size={13} /> Recordatorio</li>
            {!tipo && <li><span className="ley-tarea" aria-hidden="true" /> Tarea</li>}
            <li><span className="ley-libre" aria-hidden="true" /> Libre: toca o arrastra para crear</li>
          </ul>
        )}
        {!tipo && deGoogle.nuevos.length > 0 && (
          <p className="aviso-google">
            <Icon name="calendar" size={14} /> {deGoogle.nuevos.length} cosa{deGoogle.nuevos.length === 1 ? "" : "s"} fija{deGoogle.nuevos.length === 1 ? "" : "s"} de tu Google Calendar no se pueden mover aquí.
            <button type="button" className="enlace" onClick={pasarAKairos}>Pasarlas a Kairos</button>
          </p>
        )}
      </div>

      <section className={`plan-semana vista-${verVista}`} aria-labelledby={`${id}-dias`}>
        <h2 id={`${id}-dias`} className="solo-lector">{tipo ? "Tu semana tipo" : vista === "mes" ? "El mes" : "Tu semana"}</h2>
        {verVista === "mes" ? (
          <MesVista
            primero={mes}
            hoy={hoy}
            cosasDe={cosasDe}
            sombreros={sombreros}
            onSemana={(d) => { setLunes(lunesDe(d)); setVisto(d); setVista("semana"); }}
            onCrear={setCrear}
            onAbrir={(c) => (c.tipo === "tarea" ? abrir("accion", c.obj) : abrir(c.obj.fuente === "google" ? "google" : "evento", c.obj))}
            onSoltar={(d, dia) => soltar(d, { dia })}
          />
        ) : (
          <>
            <div className="semana-dias" role="group" aria-label="Día de la semana">
              {dias.map((d) => (
                <button key={d} type="button" aria-pressed={visto === d} className={d === hoy && !tipo ? "es-hoy" : undefined} onClick={() => setVisto(d)}>
                  <span>{DIAS_CORTOS[diaSemana(d)]}</span>
                  <strong>{tipo ? "" : partes(d).dia}</strong>
                </button>
              ))}
            </div>
            <div className="semana">
              {porDia.map((p) => (
                <DiaPlan key={p.dia} {...p} hoy={hoy} hora={hora} ajustes={ajustes} tipo={tipo} visto={visto === p.dia} sombreros={sombreros} onBloque={abrirBloque} onAbrir={abrir} onCrear={setCrear} onSoltar={soltar} />
              ))}
            </div>
            {verVista === "horas" && (
              <SemanaRejilla key={tipo ? "tipo" : lunes} dias={porDia} hoy={hoy} hora={hora} ajustes={ajustes} sombreros={sombreros} tipo={tipo} onBloque={abrirBloque} onAbrir={abrir} onCrear={setCrear} onMover={mover} onSoltar={soltar} />
            )}
          </>
        )}
      </section>

      <aside className="plan-lado" aria-label={tipo ? "Tu semana tipo" : "Añadir, por agendar, tus sombreros y tus proyectos"}>
        {tipo ? (
          <SemanaTipo estado={estado} sombreros={sombreros} cambiar={cambiar} avisar={avisar} servidor={servidor} recargar={recargar} abierta setAbierta={(v) => !v && setTipo(false)} />
        ) : (
          <>
            <div className="plan-anadir">
              <AnadirRapido sombreros={sombreros} paraCuando="(sin fecha)" onAnadir={anadirSinFecha} />
            </div>
            <PorAgendar eventos={eventos} sombreros={sombreros} onAbrir={(e) => abrir("evento", e)} />
            <Sombreros
              estado={estado}
              hoy={hoy}
              sombreros={sombreros}
              cambiar={cambiar}
              onHecha={onHecha}
              onAbrir={onAbrir}
              avisar={avisar}
              resumen={{ filas, hayBloques, sinSombrero, totalMin, flojos, bloquesSinSombrero, abrirSemanaTipo: () => setTipo(true) }}
            />
            <ProyectosConFecha estado={estado} hoy={hoy} sombreros={sombreros} cambiar={cambiar} onHecha={onHecha} onAbrir={onAbrir} avisar={avisar} />
          </>
        )}
      </aside>

      {asignando && (
        <AsignarBloque
          bloque={asignando.bloque}
          dia={asignando.dia}
          hoy={hoy}
          acciones={acciones}
          proyectos={estado.proyectos}
          sombreros={sombreros}
          todos={semanaDelDia(ritmo, asignando.dia).bloques}
          cambiar={cambiar}
          avisar={avisar}
          onCerrar={() => setAsignando(null)}
          onEditar={() => {
            setEditRitmo({ item: ritmo.find((x) => x.id === asignando.bloque.id) ?? asignando.bloque, dia: asignando.dia });
            setAsignando(null);
          }}
        />
      )}
      {editRitmo && (
        <EditarBloque
          item={editRitmo.item}
          sombreros={sombreros}
          dia={tipo ? null : editRitmo.dia}
          onGuardar={(datos) => {
            const err = aplicarAlRitmo({ accion: "cambiar", id: editRitmo.item.id, ...datos }, (b) => `Guardado: «${b.titulo}».`);
            if (!err) setEditRitmo(null);
            return err;
          }}
          onBorrar={() => {
            conAviso(aplicarAlRitmo({ accion: "quitar", id: editRitmo.item.id }, (b) => `Quité «${b.titulo}» de tu semana.`));
            setEditRitmo(null);
          }}
          onQuitarDia={() => {
            conAviso(aplicarAlRitmo({ accion: "unDia", id: editRitmo.item.id, dia: editRitmo.dia, quitar: true }, (b) => `«${b.titulo}»: el ${textoLargo(editRitmo.dia)} no.`));
            setEditRitmo(null);
          }}
          onCerrar={() => setEditRitmo(null)}
        />
      )}
      {crear && <CrearAqui en={crear} tipo={tipo} hoy={hoy} estado={estado} sombreros={sombreros} cambiar={cambiar} aplicarAlRitmo={aplicarAlRitmo} avisar={avisar} onCerrar={() => setCrear(null)} />}
      {alcance && <Alcance alcance={alcance} onSoloEste={() => aplicarAlcance(false)} onSiempre={() => aplicarAlcance(true)} onCerrar={() => setAlcance(null)} />}
    </div>
  );
}

/** Mover algo que se repite: ¿sólo este día o todas las semanas? */
function Alcance({ alcance, onSoloEste, onSiempre, onCerrar }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const { base, desde, dia, inicio, fin } = alcance;
  const otroDia = dia !== desde;
  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={ref} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`}>«{base.titulo.trim()}» se repite</h2>
        <p className="nota-fuente">
          Pasa a {otroDia ? `${DIAS[diaSemana(dia)]} ` : ""}{rangoCorto(inicio, fin)}. ¿Sólo esta vez o todas las semanas?
        </p>
        <div className="botones" style={{ marginTop: "var(--sp-4)", justifyContent: "flex-end" }}>
          <button type="button" className="boton fantasma" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="boton" onClick={onSoloEste}>Sólo el {textoLargo(desde)}</button>
          <button type="button" className="boton primario" onClick={onSiempre}>Todas las semanas</button>
        </div>
      </div>
    </div>
  );
}

/** Las reuniones y eventos sin día todavía: se arrastran a un hueco o a un día del calendario. */
function PorAgendar({ eventos, sombreros, onAbrir }) {
  const lista = eventosPorAgendar(eventos);
  if (!lista.length) return null;
  return (
    <section className="seccion por-agendar" aria-label="Por agendar">
      <div className="seccion-cabeza"><h2>Por agendar</h2><span className="nota">arrástralas a un hueco</span></div>
      <ul className="lista-por-agendar">
        {lista.map((e) => (
          <li key={e.id} style={estiloDe(e.sombrero, sombreros)} draggable onDragStart={(ev) => empezarArrastre(ev, { tipo: "evento", id: e.id, titulo: e.titulo })}>
            <button type="button" onClick={() => onAbrir(e)}>
              <Icon name={e.clase === "reunion" ? "users" : "calendar"} size={13} /> <span>{e.titulo}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Un día como lista (la primera versión): lo de todo el día, luego por hora los bloques (con lo suyo dentro), los compromisos, las reuniones y los huecos libres; al final, las tareas sin bloque. «+» crea algo ese día; se suelta aquí una tarea. */
function DiaPlan({ dia, hoy, hora, ajustes, tipo, visto, eventos, bloques, recordatorios, tareas, compromisos = [], conHora: piezas, sombreros, onBloque, onAbrir, onCrear, onSoltar }) {
  const [encima, setEncima] = useState(false);
  const todoElDia = eventos.filter((e) => !e.inicio || e.todoElDia || esTodoElDia(e));
  const v = ventanaDelDia(dia, ajustes);
  const libres = !tipo && dia < hoy ? [] : huecos(piezas ?? [], { desde: v.despierta, hasta: v.duerme, ahora: !tipo && dia === hoy ? hora : null, min: 60 });
  const conHora = [
    ...bloques.map((b) => ({ tipo: "bloque", inicio: b.bloque.inicio, ...b })),
    ...recordatorios.map((r) => ({ tipo: "recordatorio", inicio: r.inicio ?? "99", r })),
    ...compromisos.map((c) => ({ tipo: "compromiso", inicio: c.inicio, c })),
    ...eventos.filter((e) => e.inicio && !e.todoElDia && !esTodoElDia(e)).map((e) => ({ tipo: "evento", inicio: e.inicio, e })),
    ...libres.map((h) => ({ tipo: "libre", inicio: h.inicio, h })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const vacio = !conHora.length && !todoElDia.length && !tareas.length;
  const nombreDia = tipo ? DIAS[diaSemana(dia)] : `${DIAS_CORTOS[diaSemana(dia)]} ${partes(dia).dia}`;

  return (
    <article
      className={`dia${dia === hoy && !tipo ? " es-hoy" : ""}${visto ? " visto" : ""}${encima ? " soltando" : ""}`}
      aria-label={tipo ? DIAS[diaSemana(dia)] : `${DIAS[diaSemana(dia)]} ${partes(dia).dia}`}
      {...(tipo ? {} : zonaDeSoltar((d) => onSoltar(d, { dia }), setEncima))}
    >
      <h3>
        <span>{nombreDia}</span>
        {dia === hoy && !tipo && <span className="chip acento">Hoy</span>}
        <button type="button" className="dia-mas" onClick={() => onCrear({ dia })} aria-label={`Añadir algo el ${tipo ? DIAS[diaSemana(dia)] : textoLargo(dia)}`}><Icon name="plus" size={15} /></button>
      </h3>
      <ul className="dia-cosas">
        {todoElDia.map((e) => <Evento key={`t:${e.fuente}:${e.id}`} e={e} sombreros={sombreros} onAbrir={onAbrir} />)}
        {conHora.map((x) =>
          x.tipo === "bloque" ? (
            <li key={`b:${x.bloque.id}`} className={`pl-bloque${x.bloque.porConfirmar ? " por-confirmar" : ""}`} style={estiloDe(x.bloque.sombrero, sombreros)} {...(tipo ? {} : zonaDeSoltar((d) => onSoltar(d, { dia, bloque: x.bloque.id })))}>
              <button
                type="button"
                className="pl-bloque-cabeza"
                onClick={() => onBloque(x.bloque, dia)}
                aria-label={tipo ? `Bloque ${x.bloque.titulo.trim()}, ${rangoCorto(x.bloque.inicio, x.bloque.fin)}. Editarlo` : `Bloque ${x.bloque.titulo.trim()}, ${rangoCorto(x.bloque.inicio, x.bloque.fin)}: ${x.tareas.length} tarea${x.tareas.length === 1 ? "" : "s"}. Ponerle tareas`}
              >
                <strong>{x.bloque.titulo}</strong>
                <time>{rangoCorto(x.bloque.inicio, x.bloque.fin)}</time>
              </button>
              {(x.recordatorios.length > 0 || x.tareas.length > 0) && (
                <ul className="pl-dentro">
                  {x.recordatorios.map((r) => <Recordatorio key={`r:${r.id}`} r={r} onAbrir={onAbrir} />)}
                  {x.tareas.slice(0, EN_BLOQUE).map((a) => <Tarea key={a.id} a={a} onAbrir={onAbrir} />)}
                  {x.tareas.length > EN_BLOQUE && (
                    <li><button type="button" className="pl-mas" onClick={() => onBloque(x.bloque, dia)}>y {x.tareas.length - EN_BLOQUE} más</button></li>
                  )}
                </ul>
              )}
            </li>
          ) : x.tipo === "libre" ? (
            <li key={`l:${x.h.inicio}`} className="pl-hueco" {...(tipo ? {} : zonaDeSoltar((d) => onSoltar(d, { dia, hora: x.h.inicio, bloque: null })))}>
              <button type="button" onClick={() => onCrear({ dia, inicio: x.h.inicio, fin: aHora(Math.min(minutos(x.h.inicio) + 60, minutos(x.h.fin))), hueco: x.h })}>
                <Icon name="plus" size={12} /> <span>Libre {rangoCorto(x.h.inicio, x.h.fin)}</span>
              </button>
            </li>
          ) : x.tipo === "recordatorio" ? (
            <Recordatorio key={`r:${x.r.id}`} r={x.r} sombreros={sombreros} suelto onAbrir={onAbrir} />
          ) : x.tipo === "compromiso" ? (
            <Evento key={`k:${x.c.id}`} e={{ ...x.c, fuente: "ritmo" }} sombreros={sombreros} onAbrir={() => onAbrir("ritmo", x.c, dia)} />
          ) : (
            <Evento key={`e:${x.e.fuente}:${x.e.id}`} e={x.e} sombreros={sombreros} onAbrir={onAbrir} />
          ),
        )}
      </ul>
      {tareas.length > 0 && (
        <>
          <p className="pl-sub">Sin bloque</p>
          <ul className="dia-cosas">
            {tareas.map((a) => <Tarea key={a.id} a={a} sombreros={sombreros} onAbrir={onAbrir} />)}
          </ul>
        </>
      )}
      {vacio && <p className="pl-libre">Libre</p>}
    </article>
  );
}

function Recordatorio({ r, sombreros, suelto = false, onAbrir }) {
  const contenido = (
    <>
      <Icon name="bell" size={12} />
      {r.inicio && r.inicio !== "99" && <time>{horaCorta(r.inicio)}</time>}
      <span>{r.titulo}</span>
    </>
  );
  return (
    <li className={`pl-rec${suelto ? " suelto" : ""}`} style={suelto && sombreros ? estiloDe(r.sombrero, sombreros) : undefined}>
      {r.tipo === "accion" ? <button type="button" onClick={() => onAbrir("accion", r)}>{contenido}</button> : <span className="pl-rec-fijo">{contenido}</span>}
    </li>
  );
}

function Tarea({ a, sombreros, onAbrir }) {
  return (
    <li className="pl-tarea" style={sombreros ? estiloDe(a.sombrero, sombreros) : undefined} draggable onDragStart={(e) => empezarArrastre(e, { tipo: "accion", id: a.id, titulo: a.titulo })}>
      <button type="button" onClick={() => onAbrir("accion", a)}>
        <span className="ley-tarea" aria-hidden="true" />
        <span>{a.titulo}</span>
      </button>
    </li>
  );
}

function Evento({ e, sombreros, onAbrir }) {
  const rutina = (e.fuente === "google" && e.clase === "rutina") || e.fuente === "ritmo";
  const icono = e.clase === "especial" || !e.inicio || e.todoElDia ? "star" : e.clase === "reunion" ? "users" : "calendar";
  const arrastrable = e.fuente === "agenda" && !e.repite?.regla;
  return (
    <li
      className={`pl-evento${rutina ? " es-rutina" : ""}`}
      style={e.fuente === "google" ? (e.color ? { "--s": e.color } : undefined) : estiloDe(e.sombrero, sombreros)}
      draggable={arrastrable || undefined}
      onDragStart={arrastrable ? (ev) => empezarArrastre(ev, { tipo: "evento", id: e.id, titulo: e.titulo }) : undefined}
    >
      <button type="button" onClick={() => (e.fuente === "google" ? onAbrir("google", e) : e.fuente === "ritmo" ? onAbrir() : onAbrir("evento", e))}>
        <Icon name={icono} size={12} />
        <time>{e.horaPorDefinir ? "Hora por definir" : e.inicio && !e.todoElDia && !esTodoElDia(e) ? rangoCorto(e.inicio, e.fin) : "Todo el día"}</time>
        <span>{e.titulo}</span>
      </button>
    </li>
  );
}

/**
 * Tus sombreros en una lista fina: cada uno en una línea (prioridad, nombre, horas a la semana y cuántas tiene abiertas)
 * con su siguiente tarea debajo. Al tocarlo se abre: añadir arriba, sus proyectos y sus tareas. Las horas por sombrero
 * van en la barra de arriba y en cada fila.
 */
function Sombreros({ estado, hoy, sombreros, cambiar, onHecha, onAbrir, avisar, resumen }) {
  const id = useId();
  const { acciones, proyectos, ajustes } = estado;
  const { filas, hayBloques, sinSombrero, totalMin, flojos, bloquesSinSombrero, abrirSemanaTipo } = resumen;
  const abiertas = acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes");
  const ctx = { hoy, proyectos, sombreros };
  const [nuevas, setNuevas] = useState({});
  const [abierto, setAbierto] = useState(null);
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);
  const [nuevoSombrero, setNuevoSombrero] = useState("");
  const tiempoDe = (sid) => {
    const f = filas.find((x) => x.id === sid);
    if (!f) return "";
    return hayBloques ? (f.minutos ? textoHoras(f.minutos) : "0 h") : `${f.porcentaje} %`;
  };

  const cambiarSombreros = (cambio) => {
    try {
      const r = aplicarSombrero(ajustes.sombreros, cambio);
      cambiar((e) => ({ ...e, ajustes: { ...e.ajustes, sombreros: r.lista } }));
      return true;
    } catch (err) {
      avisar(err.message);
      return false;
    }
  };

  const quitarSombrero = (s) => {
    if ([...acciones, ...proyectos].some((x) => x.sombrero === s.id && x.estado !== "hecha" && x.estado !== "soltada" && x.estado !== "terminado")) {
      avisar(`«${s.nombre}» todavía tiene cosas abiertas: muévelas a otro sombrero antes de quitarlo.`);
      return;
    }
    if (cambiarSombreros({ accion: "quitar", id: s.id })) avisar(`Quité «${s.nombre}».`);
  };

  const anadir = (s) => {
    const titulo = String(nuevas[s.id] ?? "").trim();
    if (!titulo) return;
    cambiar((e) => ({ ...e, acciones: [...e.acciones, nuevaAccion({ titulo, sombrero: s.id, lista: "siguientes", origen: "app" }, hoy)] }));
    setNuevas((n) => ({ ...n, [s.id]: "" }));
    avisar(`Añadida a ${s.nombre}: «${titulo}».`);
  };

  const prioridadProyecto = (p, prioridad) => cambiar((e) => ({ ...e, proyectos: e.proyectos.map((x) => (x.id === p.id ? { ...x, prioridad } : x)) }));

  return (
    <section className="seccion somb-seccion" aria-labelledby={`${id}-somb`}>
      <div className="seccion-cabeza">
        <h2 id={`${id}-somb`}>Tus sombreros</h2>
        <span className="nota">{hayBloques ? "horas a la semana" : "esta semana"}</span>
      </div>
      <div className="balance balance-fino" role="img" aria-label={filas.map((f) => `${nombreDe(f.id, sombreros)} ${tiempoDe(f.id)}`).join(", ")}>
        {filas.map((f) => <span key={f.id} style={{ ...estiloDe(f.id, sombreros), width: `${hayBloques ? (totalMin ? (f.minutos / totalMin) * 100 : 0) : f.porcentaje}%` }} />)}
        {sinSombrero > 0 && <span className="sin-sombrero" style={{ width: `${(sinSombrero / totalMin) * 100}%` }} />}
      </div>

      <ul className="somb-lista">
        {sombreros.map((s, i) => {
          const suyas = abiertas.filter((a) => a.sombrero === s.id);
          const orden = ordenarPor(suyas, "prioridad", ctx);
          const piedra = orden.find((a) => a.importante && cuadrante(a, hoy) <= 2) ?? orden[0];
          const proys = proyectos.filter((p) => p.sombrero === s.id && p.estado !== "terminado");
          const sueltas = orden.filter((a) => !a.proyectoId || !proys.some((p) => p.id === a.proyectoId));
          const abiertoEste = abierto === s.id;
          const enEdicion = editando === s.id;
          const tiempo = tiempoDe(s.id);
          return (
            <li key={s.id} className={`somb${abiertoEste ? " abierto" : ""}`} style={estiloDe(s.id, sombreros)}>
              <button type="button" className="somb-fila" aria-expanded={abiertoEste} aria-controls={`${id}-c-${s.id}`} onClick={() => setAbierto(abiertoEste ? null : s.id)}>
                <span className="somb-num" aria-hidden="true">{i + 1}</span>
                <span className="somb-nombre">{s.nombre}</span>
                {tiempo && <span className="somb-horas">{tiempo}</span>}
                <span className="somb-cuenta">{suyas.length}<span className="solo-lector"> abierta{suyas.length === 1 ? "" : "s"}</span></span>
                <Icon name={abiertoEste ? "chevronUp" : "chevronDown"} size={14} />
                {!abiertoEste && piedra && <span className="somb-sig">{piedra.titulo}</span>}
              </button>

              {abiertoEste && (
                <div id={`${id}-c-${s.id}`} className="somb-cuerpo">
                  <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); anadir(s); }}>
                    <label className="solo-lector" htmlFor={`${id}-n-${s.id}`}>Añadir una tarea a {s.nombre}</label>
                    <input id={`${id}-n-${s.id}`} className="campo" autoFocus placeholder={`Añadir a ${s.nombre}…`} value={nuevas[s.id] ?? ""} onChange={(e) => setNuevas((n) => ({ ...n, [s.id]: e.target.value }))} />
                    <button type="submit" className="boton" aria-label={`Añadir a ${s.nombre}`}><Icon name="plus" size={16} /></button>
                  </form>
                  {proys.map((p) => {
                    const delProyecto = orden.filter((a) => a.proyectoId === p.id);
                    return (
                      <div key={p.id} className="proyecto">
                        <div className="proyecto-nombre">
                          <span>{p.nombre}{p.limite ? <small style={{ color: "var(--texto-3)", fontWeight: 400 }}> · hasta {p.limite}</small> : null}</span>
                          <label className="prioridad-proyecto">
                            <span className="solo-lector">Prioridad de {p.nombre}</span>
                            <select value={p.prioridad ?? "media"} onChange={(e) => prioridadProyecto(p, e.target.value)}>
                              {Object.entries(PRIORIDADES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                            </select>
                          </label>
                        </div>
                        {delProyecto.length ? (
                          <ul className="lista" style={{ marginTop: "var(--sp-1)" }}>
                            {delProyecto.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={[]} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} compacta arrastrable />)}
                          </ul>
                        ) : (
                          <p className="proyecto-siguiente" style={{ color: "var(--ambar)" }}>Sin siguiente acción. ¿Cuál es el próximo paso?</p>
                        )}
                      </div>
                    );
                  })}
                  {sueltas.length > 0 ? (
                    <ul className="lista" style={{ marginTop: "var(--sp-2)" }}>
                      {sueltas.map((a) => <Fila key={a.id} accion={a} hoy={hoy} sombreros={sombreros} proyectos={proyectos} onHecha={onHecha} onAbrir={(x) => onAbrir("accion", x)} compacta arrastrable />)}
                    </ul>
                  ) : (
                    !proys.length && <p className="nota somb-vacio">Nada abierto aquí.</p>
                  )}
                  <div className="somb-pie">
                    {s.detalle ? <span className="nota">{s.detalle}{s.fuente === "juancito-ads" ? " · se guarda en Juancito Ads" : ""}</span> : <span />}
                    <button type="button" className="enlace" aria-expanded={enEdicion} onClick={() => setEditando(enEdicion ? null : s.id)}><Icon name="pencil" size={13} /> Editar</button>
                  </div>
                  {enEdicion && (
                    <EditarSombrero
                      s={s}
                      primero={i === 0}
                      ultimo={i === sombreros.length - 1}
                      onMover={(a) => cambiarSombreros({ accion: "mover", id: s.id, a })}
                      posicion={i}
                      onGuardar={(c) => cambiarSombreros({ accion: "editar", id: s.id, ...c }) && setEditando(null)}
                      onQuitar={() => quitarSombrero(s)}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
        {sinSombrero > 0 && (
          <li className="somb somb-sin">
            <span className="somb-fila somb-fila-fija">
              <span className="somb-num" aria-hidden="true">·</span>
              <span className="somb-nombre">Sin sombrero</span>
              <span className="somb-horas">{textoHoras(sinSombrero)}</span>
            </span>
          </li>
        )}
      </ul>

      {bloquesSinSombrero > 0 ? (
        <p className="nota somb-nota">
          {bloquesSinSombrero} bloque{bloquesSinSombrero === 1 ? " no tiene" : "s no tienen"} sombrero y no cuenta{bloquesSinSombrero === 1 ? "" : "n"}. <button type="button" className="enlace" onClick={abrirSemanaTipo}>Asignarles uno</button>
        </p>
      ) : (
        flojos.length > 0 && <p className="nota somb-nota">{flojos.map((x) => nombreDe(x, sombreros)).join(" y ")} casi no tiene{flojos.length > 1 ? "n" : ""} tiempo esta semana.</p>
      )}

      {creando ? (
        <form className="anadir-rapido" onSubmit={(e) => { e.preventDefault(); if (cambiarSombreros({ accion: "crear", nombre: nuevoSombrero })) { avisar(`Sombrero nuevo: «${nuevoSombrero.trim()}».`); setNuevoSombrero(""); setCreando(false); } }}>
          <label className="solo-lector" htmlFor={`${id}-nuevo`}>Nombre del sombrero nuevo</label>
          <input id={`${id}-nuevo`} className="campo" autoFocus placeholder="Estudios, Familia…" value={nuevoSombrero} onChange={(e) => setNuevoSombrero(e.target.value)} />
          <button type="submit" className="boton primario" disabled={!nuevoSombrero.trim()}>Crear</button>
        </form>
      ) : (
        <button type="button" className="enlace somb-nuevo" onClick={() => setCreando(true)}><Icon name="plus" size={14} /> Sombrero nuevo</button>
      )}
    </section>
  );
}

function EditarSombrero({ s, primero, ultimo, posicion, onMover, onGuardar, onQuitar }) {
  const id = useId();
  const [nombre, setNombre] = useState(s.nombre);
  const [detalle, setDetalle] = useState(s.detalle);
  const [color, setColor] = useState(s.color);
  return (
    <form className="editar-sombrero" onSubmit={(e) => { e.preventDefault(); onGuardar({ nombre, detalle, color }); }}>
      <span className="etiqueta">Prioridad</span>
      <div className="botones">
        <button type="button" className="boton" disabled={primero} onClick={() => onMover(posicion)}><Icon name="arrowUp" size={16} /> Subir</button>
        <button type="button" className="boton" disabled={ultimo} onClick={() => onMover(posicion + 2)}><Icon name="arrowDown" size={16} /> Bajar</button>
      </div>
      <label className="etiqueta" htmlFor={`${id}-n`}>Nombre</label>
      <input id={`${id}-n`} className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} required />
      <label className="etiqueta" htmlFor={`${id}-d`}>De qué se trata</label>
      <input id={`${id}-d`} className="campo" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={140} />
      <span className="etiqueta">Color</span>
      <div className="colores" role="group" aria-label="Color">
        {[s.color, ...COLORES.filter((c) => c !== s.color)].map((c) => (
          <button key={c} type="button" className="color" aria-pressed={color === c} aria-label={`Color ${c}`} style={{ "--c": c }} onClick={() => setColor(c)} />
        ))}
      </div>
      <div className="botones" style={{ justifyContent: "space-between", marginTop: "var(--sp-3)" }}>
        <button type="button" className="boton fantasma" style={{ color: "var(--rojo)" }} onClick={onQuitar}><Icon name="trash" size={16} /> Quitar sombrero</button>
        <button type="submit" className="boton primario">Guardar</button>
      </div>
    </form>
  );
}
