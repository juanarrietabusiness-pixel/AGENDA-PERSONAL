import { useId, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { useDialogo } from "../hooks/useDialogo.js";
import { inicioDePreparar, aplicarPreparacion, bloquesPreparados } from "../lib/preparar.js";
import { reunionesDelPeriodo, TRES } from "../lib/agenda.js";
import { semanaDelDia, seriesTraidas, textoHoras } from "../lib/semana.js";
import { estiloDe, nombreDe } from "../lib/sombreros.js";
import { sumarDias, textoLargo, textoFecha, rangoCorto, horaCorta } from "../lib/fechas.js";

/**
 * «Prepara tu día» (o el de mañana): la rutina de Juan de revisar la noche antes y hacer la lista. Escoge TUS 3 y pon
 * lo demás en el orden en que lo harás; lo que quedó, lo que vence y lo que no tiene día se suman a mano. Hoy abre con
 * eso. Ver `src/lib/preparar.js`.
 */
export default function PrepararDia({ estado, hoy, hora, sombreros, cambiar, avisar, onCerrar, diaInicial = null }) {
  const ref = useDialogo(onCerrar);
  const id = useId();
  const manana = sumarDias(hoy, 1);
  const [dia, setDia] = useState(diaInicial ?? ((hora ?? "00:00") >= "15:00" ? manana : hoy));
  return (
    <div className="capa" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={ref} className="dialogo crear-aqui preparar" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <Lista key={dia} id={id} dia={dia} setDia={setDia} hoy={hoy} manana={manana} estado={estado} sombreros={sombreros} cambiar={cambiar} avisar={avisar} onCerrar={onCerrar} />
      </div>
    </div>
  );
}

function Lista({ id, dia, setDia, hoy, manana, estado, sombreros, cambiar, avisar, onCerrar }) {
  const acciones = estado.acciones;
  const ritmo = estado.ritmo ?? [];
  const proyectos = estado.proyectos ?? [];
  const opciones = { proyectos, sombreros };
  // Lo de partida se toma una vez por día escogido: mientras preparas, la lista no salta.
  const inicio = useMemo(() => inicioDePreparar(acciones, ritmo, dia, { hoy, ...opciones }), [dia]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tres, setTres] = useState(inicio.tres);
  const [orden, setOrden] = useState(inicio.orden);
  const [quitadas, setQuitadas] = useState([]);
  const [aviso, setAviso] = useState("");
  const [verSinDia, setVerSinDia] = useState(false);
  const porId = new Map(acciones.map((a) => [a.id, a]));
  const de = (ids) => ids.map((x) => porId.get(x)).filter(Boolean);
  const ya = new Set([...tres, ...orden]);
  const original = new Set(inicio.orden);

  const subir = (lista, set, x, paso) => {
    const i = lista.indexOf(x);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= lista.length) return;
    const n = [...lista];
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };
  const estrella = (x) => {
    setAviso("");
    if (tres.includes(x)) {
      setTres(tres.filter((y) => y !== x));
      setOrden([x, ...orden.filter((y) => y !== x)]);
      return;
    }
    if (tres.length >= TRES) {
      setAviso(`Ya tienes ${TRES}: quita una de tus ${TRES} antes de poner otra.`);
      return;
    }
    setTres([...tres, x]);
    setOrden(orden.filter((y) => y !== x));
    setQuitadas(quitadas.filter((y) => y !== x));
  };
  const sumar = (x) => {
    setOrden([...orden, x]);
    setQuitadas(quitadas.filter((y) => y !== x));
  };
  const quitar = (x) => {
    setOrden(orden.filter((y) => y !== x));
    setTres(tres.filter((y) => y !== x));
    if (porId.get(x)?.cuando === dia || original.has(x)) setQuitadas([...quitadas, x]);
  };
  const listo = () => {
    cambiar((e) => ({ ...e, acciones: aplicarPreparacion(e.acciones, { dia, tres, orden, quitadas }), ajustes: { ...e.ajustes, preparado: dia } }));
    avisar(dia === hoy ? "Listo: tu día está preparado." : "Listo: mañana Hoy abre con tus 3 y en este orden.");
    onCerrar();
  };

  // Lo que ese día ya tiene: tus bloques, las reuniones y los recordatorios (para planear con eso delante).
  const traidas = seriesTraidas(ritmo);
  const externos = (estado.externos ?? []).filter((x) => !traidas.has(x.serie));
  const sd = semanaDelDia(ritmo, dia);
  const reuniones = reunionesDelPeriodo(estado.eventos ?? [], externos, { desde: dia, hasta: dia }, estado.ajustes ?? {});
  const recordatorios = [
    ...sd.recordatorios.map((r) => ({ clave: `r:${r.id}`, hora: r.inicio, titulo: r.titulo })),
    ...acciones.filter((a) => a.estado === "abierta" && a.clase === "recordatorio" && a.cuando === dia).map((a) => ({ clave: `a:${a.id}`, hora: a.hora, titulo: a.titulo })),
  ].sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99"));
  const carga = bloquesPreparados(acciones, ritmo, dia, [...tres, ...orden], opciones);

  const fila = (a, { enTres = false, i = 0, lista = null, set = null, paraSumar = false }) => (
    <li key={a.id} className="prep-fila" style={estiloDe(a.sombrero, sombreros)}>
      {lista && <span className="prep-n" aria-hidden="true">{i + 1}</span>}
      <span className="prep-titulo">
        <span>{a.titulo}</span>
        <small>
          {nombreDe(a.sombrero, sombreros)}
          {a.limite ? ` · vence ${textoFecha(a.limite, hoy)}` : ""}
          {paraSumar && a.cuando ? ` · era del ${textoFecha(a.cuando, hoy)}` : ""}
        </small>
      </span>
      <span className="prep-botones">
        <button type="button" className="editar-fila fijar" aria-pressed={enTres} aria-label={enTres ? `Quitar de tus ${TRES}: ${a.titulo}` : `Una de tus ${TRES}: ${a.titulo}`} title={enTres ? `Quitar de tus ${TRES}` : `Ponerla en tus ${TRES}`} onClick={() => estrella(a.id)}>
          <Icon name="star" size={15} />
        </button>
        {lista && (
          <>
            <button type="button" className="editar-fila" aria-label={`Subir: ${a.titulo}`} disabled={i === 0} onClick={() => subir(lista, set, a.id, -1)}><Icon name="arrowUp" size={15} /></button>
            <button type="button" className="editar-fila" aria-label={`Bajar: ${a.titulo}`} disabled={i === lista.length - 1} onClick={() => subir(lista, set, a.id, 1)}><Icon name="arrowDown" size={15} /></button>
          </>
        )}
        {paraSumar ? (
          <button type="button" className="editar-fila prep-sumar" aria-label={`Sumar al día: ${a.titulo}`} title="Sumar al día" onClick={() => sumar(a.id)}><Icon name="plus" size={16} /></button>
        ) : (
          <button type="button" className="editar-fila" aria-label={`Quitar de este día: ${a.titulo}`} title="Quitar de este día" onClick={() => quitar(a.id)}><Icon name="close" size={15} /></button>
        )}
      </span>
    </li>
  );

  const grupoSumar = (titulo, lista, abierto = true, onAlternar = null) => {
    const libres = lista.filter((a) => !ya.has(a.id));
    if (!libres.length) return null;
    return (
      <div className="prep-grupo">
        {onAlternar ? (
          <button type="button" className="boton fantasma prep-plegar" aria-expanded={abierto} onClick={onAlternar}>
            <Icon name={abierto ? "chevronUp" : "chevronDown"} size={15} /> {titulo} ({libres.length})
          </button>
        ) : (
          <h4>{titulo} <small>{libres.length}</small></h4>
        )}
        {abierto && <ul className="prep-lista">{libres.map((a) => fila(a, { enTres: false, paraSumar: true }))}</ul>}
      </div>
    );
  };
  const sinSumar = inicio.sumar.antes.length + inicio.sumar.vencen.length + inicio.sumar.sinDia.length === 0;

  return (
    <>
      <div className="crear-barra">
        <button type="button" className="boton fantasma icono" onClick={onCerrar} aria-label="Cancelar"><Icon name="close" size={20} /></button>
        <h2 id={`${id}-t`}>{dia === hoy ? "Prepara tu día" : "Prepara mañana"}</h2>
        <button type="button" className="boton primario crear-barra-ok" onClick={listo}>Listo</button>
      </div>
      <div className="crear-cuerpo">
        <div className="segmentado prep-dia" role="group" aria-label="Qué día preparas">
          <button type="button" aria-pressed={dia === hoy} onClick={() => setDia(hoy)}>Hoy</button>
          <button type="button" aria-pressed={dia === manana} onClick={() => setDia(manana)}>Mañana</button>
        </div>
        <p className="nota">{textoLargo(dia)}. Escoge tus {TRES} y ordena lo demás como lo vas a hacer: Hoy abre con esto.</p>

        {(sd.bloques.length > 0 || reuniones.length > 0 || recordatorios.length > 0) && (
          <div className="prep-contexto" aria-label="Lo que ese día ya tiene">
            {sd.bloques.map((b) => <span key={`b:${b.id}`} className="prep-chip bloque" style={estiloDe(b.sombrero, sombreros)}>{rangoCorto(b.inicio, b.fin)} {b.titulo.trim()}</span>)}
            {reuniones.map((r) => <span key={`m:${r.fuente ?? ""}:${r.id}`} className="prep-chip"><Icon name="users" size={12} /> {r.inicio && !(r.inicio === "00:00" && r.fin === "23:59") ? `${horaCorta(r.inicio)} ` : ""}{r.titulo}</span>)}
            {recordatorios.map((r) => <span key={r.clave} className="prep-chip"><Icon name="bell" size={12} /> {r.hora ? `${horaCorta(r.hora)} ` : ""}{r.titulo}</span>)}
          </div>
        )}

        <h3 className="prep-h"><Icon name="target" size={15} /> Tus {TRES}</h3>
        {tres.length ? <ul className="prep-lista prep-tres">{de(tres).map((a, i) => fila(a, { enTres: true, i, lista: tres, set: setTres }))}</ul> : <p className="vacio">Toca la <Icon name="star" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> de una tarea para ponerla aquí.</p>}
        {aviso && <p className="nota rojo-texto" role="status">{aviso}</p>}

        <h3 className="prep-h"><Icon name="list" size={15} /> Después, en este orden</h3>
        {orden.length ? <ul className="prep-lista">{de(orden).map((a, i) => fila(a, { i, lista: orden, set: setOrden }))}</ul> : <p className="vacio">Nada más ese día. Puedes sumar de abajo.</p>}

        {carga.bloques.some((x) => x.tareas.length) && (
          <ul className="prep-carga" aria-label="Cómo quedan tus bloques">
            {carga.bloques.filter((x) => x.tareas.length).map(({ bloque, tareas, ocupado, cabe, sobra }) => (
              <li key={bloque.id} style={estiloDe(bloque.sombrero, sombreros)} className={sobra > 0 ? "lleno" : undefined}>
                <span className="punto" /> {bloque.titulo.trim()} ({rangoCorto(bloque.inicio, bloque.fin)}): {tareas.length} tarea{tareas.length === 1 ? "" : "s"}, {textoHoras(ocupado)} de {textoHoras(cabe)}
                {sobra > 0 ? ` · no cabe todo (sobran ${textoHoras(sobra)})` : ""}
              </li>
            ))}
          </ul>
        )}

        {!sinSumar && <h3 className="prep-h"><Icon name="plus" size={15} /> Para sumar</h3>}
        {grupoSumar("Quedaron de antes", inicio.sumar.antes)}
        {grupoSumar("Vencen pronto", inicio.sumar.vencen)}
        {grupoSumar("Sin día", inicio.sumar.sinDia, verSinDia, () => setVerSinDia((v) => !v))}

        <div className="botones crear-pie">
          <button type="button" className="boton primario" onClick={listo}>Listo</button>
          <button type="button" className="boton fantasma" onClick={onCerrar}>Cancelar</button>
        </div>
      </div>
    </>
  );
}
