import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import { estiloDe } from "../lib/sombreros.js";
import { DIAS, DIAS_CORTOS, partes, diaSemana, minutos, horaCorta, rangoCorto } from "../lib/fechas.js";
import { carriles, huecos, rangoDeLaRejilla, ventanaDelDia } from "../lib/rejilla.js";
import { textoHoras } from "../lib/semana.js";

const DENTRO_MAX = 4; // tareas que se ven dentro de un bloque

/**
 * La semana como un calendario con horas (en la computadora): cada cosa del alto de lo que dura, lo que se cruza lado a
 * lado, y los HUECOS LIBRES, que se tocan para poner ahí una tarea o un pendiente. Arriba de cada día, cuánto le queda
 * libre; en «Del día», lo de todo el día y las tareas sin hora. Toca un bloque para ponerle tareas.
 */
export default function SemanaRejilla({ dias, hoy, hora, ajustes, sombreros, onBloque, onAbrir, onHueco }) {
  const cuerpo = useRef(null);
  const { desde, hasta } = rangoDeLaRejilla(dias, ajustes);
  const total = (hasta - desde) * 60;
  const pos = (h) => `${((minutos(h) - desde * 60) / total) * 100}%`;
  const alto = (a, b) => `${(Math.max(minutos(b) - minutos(a), 15) / total) * 100}%`;
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i);

  // Al abrir, se ve desde un poco antes de ahora (o desde que despierta).
  useEffect(() => {
    const c = cuerpo.current;
    if (!c) return;
    const desdeHora = dias.some((d) => d.dia === hoy) && hora ? Math.max(desde, Math.floor(minutos(hora) / 60) - 1) : desde;
    c.scrollTop = ((desdeHora - desde) / (hasta - desde)) * c.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirPieza = (p, dia) => {
    if (p.tipo === "bloque") onBloque(p.obj, dia);
    else if (p.tipo === "evento") onAbrir(p.obj.fuente === "google" ? "google" : "evento", p.obj);
    else if (p.tipo === "tarea" || p.obj.tipo === "accion") onAbrir("accion", p.obj);
  };

  return (
    <div className="rejilla" role="group" aria-label="Tu semana, con horas">
      <div className="rejilla-fila rejilla-cabeza">
        <span />
        {dias.map(({ dia, conHora }) => {
          const v = ventanaDelDia(dia, ajustes);
          const libre = huecos(conHora, { desde: v.despierta, hasta: v.duerme }).reduce((t, h) => t + h.minutos, 0);
          return (
            <div key={dia} className={`rejilla-dia${dia === hoy ? " es-hoy" : ""}`}>
              <strong>{DIAS_CORTOS[diaSemana(dia)]} {partes(dia).dia}</strong>
              <small>{libre ? `libre ${textoHoras(libre)}` : "sin huecos"}</small>
            </div>
          );
        })}
      </div>

      <div className="rejilla-fila rejilla-deldia">
        <span className="rejilla-etq">Del día</span>
        {dias.map(({ dia, delDia }) => (
          <ul key={dia} className="rejilla-deldia-lista">
            {delDia.slice(0, 3).map((p) => (
              <li key={p.clave} style={p.obj?.fuente === "google" && p.color ? { "--s": p.color } : estiloDe(p.sombrero, sombreros)}>
                <button type="button" className={`rejilla-chip ${p.tipo}`} onClick={() => abrirPieza(p, dia)} title={p.titulo}>
                  {p.tipo === "tarea" ? <span className="ley-tarea" aria-hidden="true" /> : <Icon name={p.tipo === "recordatorio" ? "bell" : "star"} size={11} />}
                  <span>{p.obj?.horaPorDefinir ? `${p.titulo} (hora por definir)` : p.titulo}</span>
                </button>
              </li>
            ))}
            {delDia.length > 3 && <li className="rejilla-mas">y {delDia.length - 3} más</li>}
          </ul>
        ))}
      </div>

      <div className="rejilla-cuerpo" ref={cuerpo}>
        <div className="rejilla-lienzo" style={{ "--horas": hasta - desde }}>
          <div className="rejilla-horas" aria-hidden="true">
            {horas.map((h) => (
              <span key={h} style={{ top: pos(`${String(h).padStart(2, "0")}:00`) }}>{horaCorta(`${String(h).padStart(2, "0")}:00`)}</span>
            ))}
          </div>
          {dias.map(({ dia, conHora }) => {
            const v = ventanaDelDia(dia, ajustes);
            const libres = dia < hoy ? [] : huecos(conHora, { desde: v.despierta, hasta: v.duerme, ahora: dia === hoy ? hora : null });
            const lados = carriles(conHora.filter((p) => p.tipo !== "recordatorio"));
            return (
              <div key={dia} className={`rejilla-col${dia === hoy ? " es-hoy" : ""}`} aria-label={`${DIAS[diaSemana(dia)]} ${partes(dia).dia}`} role="group">
                {libres.map((h) => (
                  <button key={`l:${h.inicio}`} type="button" className="rejilla-hueco" style={{ top: pos(h.inicio), height: alto(h.inicio, h.fin) }} onClick={() => onHueco({ dia, ...h })} aria-label={`Libre el ${DIAS[diaSemana(dia)]} de ${rangoCorto(h.inicio, h.fin)}: añadir algo aquí`}>
                    <span>Libre · {textoHoras(h.minutos)}</span>
                  </button>
                ))}
                {conHora.map((p) => {
                  const l = lados.get(p.clave) ?? { carril: 0, de: 1 };
                  const corta = minutos(p.fin) - minutos(p.inicio) < 45;
                  const estilo = {
                    ...(p.obj?.fuente === "google" && p.color ? { "--s": p.color } : estiloDe(p.sombrero, sombreros)),
                    top: pos(p.inicio),
                    height: alto(p.inicio, p.fin),
                    left: `calc(${(l.carril / l.de) * 100}% + 2px)`,
                    width: `calc(${100 / l.de}% - 4px)`,
                  };
                  if (p.tipo === "recordatorio") {
                    return (
                      <div key={p.clave} className="rejilla-rec" style={{ ...estilo, left: "2px", width: "calc(100% - 4px)", height: "auto" }} title={`${horaCorta(p.inicio)} ${p.titulo}`}>
                        <Icon name="bell" size={10} /> <span>{horaCorta(p.inicio)} {p.titulo}</span>
                      </div>
                    );
                  }
                  if (p.tipo === "bloque") {
                    return (
                      <div key={p.clave} className={`rejilla-pieza bloque${corta ? " corta" : ""}`} style={estilo}>
                        <button type="button" className="rejilla-pieza-cabeza" onClick={() => abrirPieza(p, dia)} aria-label={`Bloque ${p.titulo}, ${rangoCorto(p.inicio, p.fin)}: ${p.tareas.length} tarea${p.tareas.length === 1 ? "" : "s"}. Ponerle tareas`}>
                          <strong>{p.titulo}</strong> <time>{rangoCorto(p.inicio, p.fin)}</time>
                        </button>
                        {!corta && (p.tareas.length > 0 || p.recordatorios.length > 0) && (
                          <ul>
                            {p.recordatorios.map((r) => <li key={`r:${r.id}`} className="dentro-rec"><Icon name="bell" size={10} /> {horaCorta(r.inicio)} {r.titulo}</li>)}
                            {p.tareas.slice(0, DENTRO_MAX).map((a) => (
                              <li key={a.id}><button type="button" onClick={() => onAbrir("accion", a)}><span className="ley-tarea" aria-hidden="true" /> {a.titulo}</button></li>
                            ))}
                            {p.tareas.length > DENTRO_MAX && <li className="rejilla-mas">y {p.tareas.length - DENTRO_MAX} más</li>}
                          </ul>
                        )}
                      </div>
                    );
                  }
                  return (
                    <button key={p.clave} type="button" className={`rejilla-pieza ${p.tipo}${corta ? " corta" : ""}`} style={estilo} onClick={() => abrirPieza(p, dia)} title={`${rangoCorto(p.inicio, p.fin)} ${p.titulo}`}>
                      <strong>{p.tipo === "tarea" && <span className="ley-tarea" aria-hidden="true" />}{p.obj?.clase === "reunion" && <Icon name="users" size={10} />} {p.titulo}</strong>
                      <time>{rangoCorto(p.inicio, p.fin)}</time>
                    </button>
                  );
                })}
                {dia === hoy && hora && minutos(hora) >= desde * 60 && minutos(hora) <= hasta * 60 && <div className="rejilla-ahora" style={{ top: pos(hora) }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
