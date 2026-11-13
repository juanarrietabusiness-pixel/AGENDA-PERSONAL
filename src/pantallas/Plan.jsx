import { useEffect, useId, useState } from "react";
import Icon from "../componentes/Icon.jsx";
import { lunesDe, sumarDias, sumarMeses, DIAS, DIAS_CORTOS, MESES, partes, diaSemana, horaCorta, rangoCorto, textoCorto, textoLargo, minutos, aHora } from "../lib/fechas.js";
import { eventosDelDia } from "../lib/hoy.js";
import { sombrerosDe, estiloDe, nombreDe, balance, descuidados } from "../lib/sombreros.js";
import { ordenarPor, claseDeGoogle, esTodoElDia, eventosPorAgendar, normalizarEvento, porAgendar, marcasDeDias } from "../lib/agenda.js";
import { RITMO_BASE, aplicarRitmo } from "../lib/ritmo.js";
import SemanaTipo from "../componentes/SemanaTipo.jsx";
import AsignarBloque from "../componentes/AsignarBloque.jsx";
import EditarBloque from "../componentes/EditarBloque.jsx";
import ProyectosConFecha from "../componentes/ProyectosConFecha.jsx";
import SemanaRejilla from "../componentes/SemanaRejilla.jsx";
import MesVista from "../componentes/MesVista.jsx";
import CrearAqui from "../componentes/CrearAqui.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { useMedia } from "../hooks/useMedia.js";
import { piezasDelDia, huecos, ventanaDelDia, duracionCercana, esRutinario } from "../lib/rejilla.js";
import { seriesTraidas, horasPorSombrero, semanaDelDia, diaEnBloques, minutosSinSombrero, porRevisar, textoHoras, moverSiempre } from "../lib/semana.js";
import { zonaDeSoltar, empezarArrastre } from "../lib/arrastre.js";

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
const leerLado = () => {
  try {
    return { abierto: true, fijo: true, ...JSON.parse(localStorage.getItem("plan-lado") ?? "{}") };
  } catch {
    return { abierto: true, fijo: true };
  }
};

export default function Plan({ estado, hoy, hora, cambiar, onHecha, onAbrir, avisar, servidor = false, recargar, irA = null }) {
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
  // El panel de la derecha (sombreros, por agendar, proyectos): abierto o cerrado, y fijo al lado o flotando encima.
  const [lado, setLadoE] = useState(leerLado);
  const setLado = (cambio) =>
    setLadoE((l) => {
      const n = { ...l, ...cambio };
      try {
        localStorage.setItem("plan-lado", JSON.stringify(n));
      } catch {
        /* sólo esta visita */
      }
      return n;
    });
  const flotante = lado.abierto && !lado.fijo;
  useEffect(() => {
    if (!flotante) return undefined;
    const alTeclear = (e) => e.key === "Escape" && setLado({ abierto: false });
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flotante]);

  // Desde el mes chico del menú: ir a ese día (su semana, o su mes en la vista Mes).
  useEffect(() => {
    if (!irA?.dia) return;
    setLunes(lunesDe(irA.dia));
    setMes(`${irA.dia.slice(0, 8)}01`);
    setVisto(irA.dia);
    setTipo(false);
  }, [irA]);

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
    const base = diaEnBloques(ritmo, d, tareas, { soloAsignadas: true });
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

  // Lo especial y las reuniones que no se repiten: un puntito en los días de la semana (teléfono) y «Lo que viene».
  const marcas = marcasDeDias(estado, dias[0] < hoy ? dias[0] : hoy, sumarDias(hoy, 45));
  // «Lo que viene» lleva además los recordatorios de una sola vez: es lo que hay que recordar.
  const viene = marcasDeDias(estado, hoy, sumarDias(hoy, 45), { recordatorios: true });
  // En el teléfono, lo que viene y lo pendiente van ARRIBA (lo principal) y tu día, en pequeño, debajo (decisión de Juan).
  const telefono = useMedia("(max-width: 899px)");
  const abrirMarca = (m) =>
    m.de === "accion" ? onAbrir("accion", acciones.find((a) => a.id === m.obj.id) ?? m.obj) : m.de === "google" ? onAbrir("google", m.obj) : abrir("evento", m.obj);

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



  const navegar = (n) => (vista === "mes" && !tipo ? setMes(sumarMeses(mes, n)) : setLunes(sumarDias(lunes, 7 * n)));
  const enHoy = vista === "mes" && !tipo ? mes === `${hoy.slice(0, 8)}01` : lunes === lunesDe(hoy);
  const verVista = tipo ? "horas" : vista;
  const titulo = vista === "mes" && !tipo
    ? `${MESES[partes(mes).mes - 1]} ${partes(mes).anio}`
    : partes(dias[0]).mes === partes(dias[6]).mes
      ? `${partes(dias[0]).dia} al ${partes(dias[6]).dia} de ${MESES[partes(dias[6]).mes - 1]}`
      : `${partes(dias[0]).dia} de ${MESES[partes(dias[0]).mes - 1]} al ${partes(dias[6]).dia} de ${MESES[partes(dias[6]).mes - 1]}`;

  // Lo primero del panel: lo que viene, añadir, por agendar y las tareas sin día. En el teléfono sube encima de tu día.
  const primeroArriba = telefono && !tipo && verVista !== "mes";
  const primero = (
    <>
      <LoQueViene marcas={viene} hoy={hoy} sombreros={sombreros} onAbrir={abrirMarca} onDia={(d) => { setLunes(lunesDe(d)); setVisto(d); }} onMes={() => { setMes(`${hoy.slice(0, 8)}01`); setVista("mes"); }} />
      <button type="button" className="boton plan-nuevo" onClick={() => setCrear({ dia: visto >= hoy ? visto : hoy, queInicial: "evento" })}>
        <Icon name="plus" size={16} /> Añadir un evento o un recordatorio
      </button>
      <PorAgendar eventos={eventos} sombreros={sombreros} onAbrir={(e) => abrir("evento", e)} />
      <SinDia acciones={acciones} hoy={hoy} proyectos={estado.proyectos} sombreros={sombreros} onAbrir={(a) => onAbrir("accion", a)} />
    </>
  );

  return (
    <div className={`plan${tipo ? " editando-tipo" : ""}${lado.abierto ? (lado.fijo ? "" : " lado-flotante") : " lado-cerrado"}`}>
      <div className="plan-cabeza">
        {tipo ? (
          <div className="plan-titulo">
            <h1 className="titulo-plan">Tu semana tipo</h1>
            <span className="nota">Lo que se repite cada semana: arrastra para moverlo o estirarlo; toca un espacio vacío para crear.</span>
          </div>
        ) : (
          <div className="plan-nav">
            <h1 className="solo-lector">Tu plan</h1>
            <button type="button" className="boton fantasma" onClick={() => { setLunes(lunesDe(hoy)); setMes(`${hoy.slice(0, 8)}01`); setVisto(hoy); }} disabled={enHoy}>Hoy</button>
            <button type="button" className="boton fantasma icono" onClick={() => navegar(-1)} aria-label={vista === "mes" ? "Mes anterior" : "Semana anterior"}><Icon name="chevronLeft" size={18} /></button>
            <button type="button" className="boton fantasma icono" onClick={() => navegar(1)} aria-label={vista === "mes" ? "Mes siguiente" : "Semana siguiente"}><Icon name="chevronRight" size={18} /></button>
            <strong className="plan-rango">{titulo}</strong>
          </div>
        )}
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
          <button type="button" className="boton fantasma solo-ancho-flex boton-lado" aria-pressed={lado.abierto} aria-controls={`${id}-lado`} onClick={() => setLado({ abierto: !lado.abierto })} aria-label={lado.abierto ? "Cerrar el panel" : "Abrir el panel: lo que viene, por agendar y proyectos"} title={lado.abierto ? "Cerrar el panel" : "Lo que viene, por agendar, tareas sin día y proyectos"}>
            <Icon name="layers" size={17} /> Panel
          </button>
        </div>
        {tipo && (
          <ul className="leyenda-semana" aria-label="Qué es cada cosa">
            <li><span className="ley-bloque" aria-hidden="true" /> Bloque</li>
            <li><Icon name="calendar" size={13} /> Compromiso</li>
            <li><Icon name="bell" size={13} /> Recordatorio</li>
          </ul>
        )}
      </div>

      {primeroArriba && <div className="plan-primero">{primero}</div>}

      <section className={`plan-semana vista-${verVista}`} aria-labelledby={`${id}-dias`}>
        <h2 id={`${id}-dias`} className={primeroArriba ? "plan-tu-dia" : "solo-lector"}>{tipo ? "Tu semana tipo" : vista === "mes" ? "El mes" : primeroArriba ? "Tu día" : "Tu semana"}</h2>
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
                <button key={d} type="button" aria-pressed={visto === d} className={d === hoy && !tipo ? "es-hoy" : undefined} onClick={() => setVisto(d)} aria-label={`${textoLargo(d)}${!tipo && marcas[d] ? `: ${marcas[d].map((m) => m.titulo).join(", ")}` : ""}`}>
                  <span>{DIAS_CORTOS[diaSemana(d)]}</span>
                  <strong>{tipo ? "" : partes(d).dia}</strong>
                  {!tipo && marcas[d] && (
                    <span className="mini-puntos" aria-hidden="true">
                      {marcas[d].slice(0, 3).map((m, i) => <span key={i} className="mini-punto" style={m.color ? { "--s": m.color } : estiloDe(m.sombrero, sombreros)} />)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="semana">
              {porDia.map((p) => (
                <DiaPlan key={p.dia} {...p} hoy={hoy} hora={hora} ajustes={ajustes} tipo={tipo} elegido={irA?.dia === p.dia} visto={visto === p.dia} sombreros={sombreros} onBloque={abrirBloque} onAbrir={abrir} onCrear={setCrear} onSoltar={soltar} />
              ))}
            </div>
            {verVista === "horas" && (
              <SemanaRejilla key={tipo ? "tipo" : lunes} dias={porDia} hoy={hoy} hora={hora} elegido={irA?.dia ?? null} ajustes={ajustes} sombreros={sombreros} tipo={tipo} onBloque={abrirBloque} onAbrir={abrir} onCrear={setCrear} onMover={mover} onSoltar={soltar} />
            )}
          </>
        )}
      </section>

      <aside className="plan-lado" id={`${id}-lado`} aria-label={tipo ? "Tu semana tipo" : "Lo que viene, por agendar, tareas sin día y proyectos"}>
        <div className="lado-barra">
          <button type="button" className="boton fantasma icono" aria-pressed={lado.fijo} onClick={() => setLado({ fijo: !lado.fijo })} aria-label={lado.fijo ? "Soltar el panel: que flote encima del calendario" : "Fijar el panel al lado del calendario"} title={lado.fijo ? "Fijado al lado. Pulsa para que flote encima" : "Flotando. Pulsa para fijarlo al lado"}>
            <Icon name="mapPin" size={16} />
          </button>
          <button type="button" className="boton fantasma icono" onClick={() => setLado({ abierto: false })} aria-label="Cerrar el panel"><Icon name="close" size={16} /></button>
        </div>
        {tipo ? (
          <SemanaTipo estado={estado} sombreros={sombreros} cambiar={cambiar} avisar={avisar} servidor={servidor} recargar={recargar} abierta setAbierta={(v) => !v && setTipo(false)} />
        ) : (
          <>
            {!primeroArriba && primero}
            <ProyectosConFecha estado={estado} hoy={hoy} sombreros={sombreros} cambiar={cambiar} onHecha={onHecha} onAbrir={onAbrir} avisar={avisar} />
            <HorasSombreros sombreros={sombreros} resumen={{ filas, hayBloques, sinSombrero, totalMin, flojos, bloquesSinSombrero, abrirSemanaTipo: () => setTipo(true) }} />
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
      {crear && <CrearAqui en={crear} queInicial={crear.queInicial} tipo={tipo} hoy={hoy} estado={estado} sombreros={sombreros} cambiar={cambiar} aplicarAlRitmo={aplicarAlRitmo} avisar={avisar} onCerrar={() => setCrear(null)} />}
      {alcance && <Alcance alcance={alcance} onSoloEste={() => aplicarAlcance(false)} onSiempre={() => aplicarAlcance(true)} onCerrar={() => setAlcance(null)} />}
    </div>
  );
}

/**
 * Lo que viene en las próximas semanas (lo especial, las reuniones y los compromisos que no se repiten), por día: para
 * verlo de un vistazo, también en el teléfono. Tocar el día lleva a su semana; tocar algo, lo abre.
 */
function LoQueViene({ marcas, hoy, sombreros, onAbrir, onDia, onMes }) {
  const [todo, setTodo] = useState(false);
  const dias = Object.keys(marcas).filter((d) => d >= hoy).sort();
  const visibles = todo ? dias : dias.slice(0, 5);
  return (
    <section className="seccion lo-que-viene" aria-label="Lo que viene">
      <div className="seccion-cabeza">
        <h2>Lo que viene</h2>
        <button type="button" className="enlace nota" onClick={onMes}>Ver el mes</button>
      </div>
      {dias.length ? (
        <ul className="lista-viene">
          {visibles.map((d) => (
            <li key={d}>
              <button type="button" className="viene-dia" onClick={() => onDia(d)}>{d === hoy ? "Hoy" : textoCorto(d, hoy)}</button>
              <ul>
                {marcas[d].map((m, i) => (
                  <li key={i} style={m.color ? { "--s": m.color } : estiloDe(m.sombrero, sombreros)}>
                    <button type="button" onClick={() => onAbrir(m)}>
                      <Icon name={m.tipo === "especial" ? "star" : m.tipo === "reunion" ? "users" : m.tipo === "recordatorio" ? "bell" : "calendar"} size={13} />
                      {m.hora && <time>{horaCorta(m.hora)}</time>}
                      <span>{m.titulo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="vacio">Nada especial en las próximas semanas.</p>
      )}
      {dias.length > 5 && (
        <button type="button" className="enlace nota" onClick={() => setTodo(!todo)}>{todo ? "Ver menos" : `Ver ${dias.length - 5} días más`}</button>
      )}
    </section>
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
function DiaPlan({ dia, hoy, hora, ajustes, tipo, visto, elegido = false, eventos, bloques, recordatorios, tareas, compromisos = [], conHora: piezas, sombreros, onBloque, onAbrir, onCrear, onSoltar }) {
  const [encima, setEncima] = useState(false);
  // Arriba: lo de todo el día y lo especial (también el que tiene hora, que además sale en su hora).
  const todoElDia = eventos.filter((e) => !e.inicio || e.todoElDia || esTodoElDia(e) || e.clase === "especial");
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
      className={`dia${dia === hoy && !tipo ? " es-hoy" : ""}${visto ? " visto" : ""}${elegido && !tipo ? " elegido" : ""}${encima ? " soltando" : ""}`}
      aria-label={tipo ? DIAS[diaSemana(dia)] : `${DIAS[diaSemana(dia)]} ${partes(dia).dia}`}
      {...(tipo ? {} : zonaDeSoltar((d) => onSoltar(d, { dia }), setEncima))}
    >
      <h3>
        <span>{nombreDia}</span>
        {dia === hoy && !tipo && <span className="chip acento">Hoy</span>}
        <button type="button" className="dia-mas" onClick={() => onCrear({ dia })} aria-label={`Añadir algo el ${tipo ? DIAS[diaSemana(dia)] : textoLargo(dia)}`}><Icon name="plus" size={15} /></button>
      </h3>
      {todoElDia.length > 0 && (
        <ul className="dia-cosas dia-arriba" aria-label="Lo especial y lo de todo el día">
          {[...todoElDia].sort((a, b) => (b.clase === "especial") - (a.clase === "especial")).map((e) => <Evento key={`t:${e.fuente}:${e.id}`} e={e} sombreros={sombreros} onAbrir={onAbrir} />)}
        </ul>
      )}
      {tareas.length > 0 && (
        <ul className="dia-tareas" aria-label="Tareas del día">
          {tareas.map((a) => <Tarea key={a.id} a={a} sombreros={sombreros} onAbrir={onAbrir} />)}
        </ul>
      )}
      <ul className="dia-cosas">
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
  // Gris sólo la rutina (lo que se repite cada semana); lo de una vez en color; lo especial, con su estrella y relleno.
  const rutina = e.fuente === "ritmo" || esRutinario(e);
  const especial = e.clase === "especial";
  const icono = especial || !e.inicio || e.todoElDia ? "star" : e.clase === "reunion" || e.conPersonas ? "users" : "calendar";
  const arrastrable = e.fuente === "agenda" && !e.repite?.regla;
  return (
    <li
      className={`pl-evento${rutina ? " es-rutina" : " es-evento"}${especial ? " es-especial" : ""}`}
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

/** Las tareas que todavía no tienen día: se arrastran a un día, a un hueco o a un bloque de la semana. Todas, en Tareas. */
function SinDia({ acciones, hoy, proyectos, sombreros, onAbrir }) {
  const lista = ordenarPor(
    acciones.filter((a) => a.estado === "abierta" && a.lista === "siguientes" && (a.clase ?? "tarea") === "tarea" && !a.cuando && !a.limite),
    "prioridad",
    { hoy, proyectos, sombreros },
  );
  if (!lista.length) return null;
  return (
    <section className="seccion por-agendar" aria-label="Tareas sin día">
      <div className="seccion-cabeza"><h2>Tareas sin día</h2><span className="nota">arrástralas a la semana</span></div>
      <ul className="lista-por-agendar">
        {lista.slice(0, 8).map((a) => (
          <li key={a.id} style={estiloDe(a.sombrero, sombreros)} draggable onDragStart={(ev) => empezarArrastre(ev, { tipo: "accion", id: a.id, titulo: a.titulo })}>
            <button type="button" onClick={() => onAbrir(a)}>
              <span className="ley-tarea" aria-hidden="true" /> <span>{a.titulo}</span>
            </button>
          </li>
        ))}
      </ul>
      <a className="enlace nota" href="#tareas">{lista.length > 8 ? `Ver las ${lista.length} en Tareas` : "Ver todas en Tareas"}</a>
    </section>
  );
}

/** Las horas de la semana por sombrero (de tus bloques y tu rutina), en una barra fina con su leyenda. */
function HorasSombreros({ sombreros, resumen }) {
  const { filas, hayBloques, sinSombrero, totalMin, flojos, bloquesSinSombrero, abrirSemanaTipo } = resumen;
  const tiempo = (f) => (hayBloques ? (f.minutos ? textoHoras(f.minutos) : "0 h") : `${f.porcentaje} %`);
  return (
    <section className="seccion horas-sombreros" aria-label="Horas por sombrero">
      <div className="seccion-cabeza"><h2>Horas por sombrero</h2><span className="nota">{hayBloques ? "a la semana" : "esta semana"}</span></div>
      <div className="balance balance-fino" role="img" aria-label={filas.map((f) => `${nombreDe(f.id, sombreros)} ${tiempo(f)}`).join(", ")}>
        {filas.map((f) => <span key={f.id} style={{ ...estiloDe(f.id, sombreros), width: `${hayBloques ? (totalMin ? (f.minutos / totalMin) * 100 : 0) : f.porcentaje}%` }} />)}
        {sinSombrero > 0 && <span className="sin-sombrero" style={{ width: `${(sinSombrero / totalMin) * 100}%` }} />}
      </div>
      <ul className="horas-lista">
        {filas.map((f) => (
          <li key={f.id} style={estiloDe(f.id, sombreros)}><span className="punto" /> {nombreDe(f.id, sombreros)} <span>{tiempo(f)}</span></li>
        ))}
        {sinSombrero > 0 && <li><span className="punto" style={{ background: "var(--texto-3)" }} /> Sin sombrero <span>{textoHoras(sinSombrero)}</span></li>}
      </ul>
      {bloquesSinSombrero > 0 ? (
        <p className="nota somb-nota">{bloquesSinSombrero} bloque{bloquesSinSombrero === 1 ? " no tiene" : "s no tienen"} sombrero. <button type="button" className="enlace" onClick={abrirSemanaTipo}>Asignarles uno</button></p>
      ) : (
        flojos.length > 0 && <p className="nota somb-nota">{flojos.map((x) => nombreDe(x, sombreros)).join(" y ")} casi no tiene{flojos.length > 1 ? "n" : ""} tiempo esta semana.</p>
      )}
    </section>
  );
}
