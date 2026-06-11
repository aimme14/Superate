import { useState } from "react";
import { Calculator, Trophy, Zap } from "lucide-react";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav";

// ─── ESTRUCTURA REAL DEL EXAMEN ───────────────────────────────────────────────

const SESION_1 = [
  { id: "mat_s1",  area: "matematicas", nombre: "Matemáticas",          emoji: "📐", color: "blue",   preguntas: 25 },
  { id: "lc_s1",  area: "lectura",     nombre: "Lectura Crítica",       emoji: "📖", color: "green",  preguntas: 41 },
  { id: "cn_s1",  area: "ciencias",    nombre: "Ciencias Naturales",    emoji: "🔬", color: "teal",   preguntas: 29 },
  { id: "soc_s1", area: "sociales",    nombre: "Sociales y Ciudadanas", emoji: "🌎", color: "orange", preguntas: 25 },
] as const;

const SESION_2 = [
  { id: "mat_s2",  area: "matematicas", nombre: "Matemáticas",          emoji: "📐", color: "blue",   preguntas: 25 },
  { id: "cn_s2",  area: "ciencias",    nombre: "Ciencias Naturales",    emoji: "🔬", color: "teal",   preguntas: 29 },
  { id: "soc_s2", area: "sociales",    nombre: "Sociales y Ciudadanas", emoji: "🌎", color: "orange", preguntas: 25 },
  { id: "ing_s2", area: "ingles",      nombre: "Inglés",                emoji: "🌐", color: "purple", preguntas: 55 },
] as const;

const TOTALES: Record<string, number> = {
  matematicas: 50, lectura: 41, ciencias: 58, sociales: 50, ingles: 55,
};

const PESOS: Record<string, number> = {
  matematicas: 3, lectura: 3, ciencias: 3, sociales: 3, ingles: 1,
};

const AREAS_ORDEN = ["matematicas", "lectura", "ciencias", "sociales", "ingles"] as const;
type AreaId = typeof AREAS_ORDEN[number];

type Bloque = "mat_s1" | "lc_s1" | "cn_s1" | "soc_s1" | "mat_s2" | "cn_s2" | "soc_s2" | "ing_s2";
type BloqueState = Record<Bloque, number>;

const BLOQUE_INICIAL: BloqueState = {
  mat_s1: 0, lc_s1: 0, cn_s1: 0, soc_s1: 0,
  mat_s2: 0, cn_s2: 0, soc_s2: 0, ing_s2: 0,
};

const BLOQUE_MAX: Record<Bloque, number> = {
  mat_s1: 25, lc_s1: 41, cn_s1: 29, soc_s1: 25,
  mat_s2: 25, cn_s2: 29, soc_s2: 25, ing_s2: 55,
};

const BLOQUE_AREA: Record<Bloque, AreaId> = {
  mat_s1: "matematicas", lc_s1: "lectura",  cn_s1: "ciencias", soc_s1: "sociales",
  mat_s2: "matematicas", cn_s2: "ciencias", soc_s2: "sociales", ing_s2: "ingles",
};

function totalPorArea(b: BloqueState, area: AreaId): number {
  return (Object.keys(b) as Bloque[])
    .filter((k) => BLOQUE_AREA[k] === area)
    .reduce((s, k) => s + b[k], 0);
}

function puntajeArea(b: BloqueState, area: AreaId): number {
  return Math.round(Math.min(100, (totalPorArea(b, area) / TOTALES[area]) * 100));
}

function calcularGlobal(b: BloqueState): number {
  const suma = AREAS_ORDEN.reduce((s, a) => s + puntajeArea(b, a) * PESOS[a], 0);
  return Math.round((suma / 13) * 5);
}

function getNivelArea(p: number) {
  if (p >= 66) return { nivel: "Nivel 4", color: "emerald" };
  if (p >= 51) return { nivel: "Nivel 3", color: "blue" };
  if (p >= 36) return { nivel: "Nivel 2", color: "amber" };
  return { nivel: "Nivel 1", color: "red" };
}

// ─── COLORES ──────────────────────────────────────────────────────────────────

const COLOR_TEXT: Record<string, (d: boolean) => string> = {
  blue:   (d) => d ? "text-blue-300"   : "text-blue-700",
  green:  (d) => d ? "text-green-300"  : "text-green-700",
  teal:   (d) => d ? "text-teal-300"   : "text-teal-700",
  orange: (d) => d ? "text-orange-300" : "text-orange-700",
  purple: (d) => d ? "text-purple-300" : "text-purple-700",
};

const COLOR_BG: Record<string, (d: boolean) => string> = {
  blue:   (d) => d ? "bg-blue-900/20 border-blue-800/40"    : "bg-blue-50 border-blue-200",
  green:  (d) => d ? "bg-green-900/20 border-green-800/40"  : "bg-green-50 border-green-200",
  teal:   (d) => d ? "bg-teal-900/20 border-teal-800/40"    : "bg-teal-50 border-teal-200",
  orange: (d) => d ? "bg-orange-900/20 border-orange-800/40": "bg-orange-50 border-orange-200",
  purple: (d) => d ? "bg-purple-900/20 border-purple-800/40": "bg-purple-50 border-purple-200",
};

const COLOR_HEX: Record<string, string> = {
  blue: "#3b82f6", green: "#22c55e", teal: "#14b8a6", orange: "#f97316", purple: "#a855f7",
};

const NIVEL_PILL: Record<string, (d: boolean) => string> = {
  emerald: (d) => d ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-100 text-emerald-700",
  blue:    (d) => d ? "bg-blue-900/40 text-blue-400"       : "bg-blue-100 text-blue-700",
  amber:   (d) => d ? "bg-amber-900/40 text-amber-400"     : "bg-amber-100 text-amber-700",
  red:     (d) => d ? "bg-red-900/40 text-red-400"         : "bg-red-100 text-red-700",
};

const RANGOS_REF = [
  { rango: "0–220",   label: "Bajo",     dc: "bg-red-900/30 border-red-800/50 text-red-400",              lc: "bg-red-50 border-red-200 text-red-600"                },
  { rango: "221–320", label: "Medio",    dc: "bg-blue-900/30 border-blue-800/50 text-blue-400",           lc: "bg-blue-50 border-blue-200 text-blue-700"             },
  { rango: "321–350", label: "Bueno",    dc: "bg-teal-900/30 border-teal-800/50 text-teal-400",           lc: "bg-teal-50 border-teal-200 text-teal-700"             },
  { rango: "350–380", label: "Alto",     dc: "bg-emerald-900/30 border-emerald-800/50 text-emerald-400", lc: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { rango: "381–500", label: "Muy alto", dc: "bg-purple-900/30 border-purple-800/50 text-purple-400",     lc: "bg-purple-50 border-purple-200 text-purple-700"       },
] as const;

const LG_FILA = ["lg:row-start-2", "lg:row-start-3", "lg:row-start-4", "lg:row-start-5"] as const;
const ORDER_S1  = ["order-2", "order-3", "order-4", "order-5"] as const;
const ORDER_S2  = ["order-7", "order-8", "order-9", "order-10"] as const;

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function HerramientasEstudioPage() {
  const { theme } = useThemeContext();
  const dark = theme === "dark";

  return (
    <div className={cn("min-h-screen", dark ? "bg-zinc-900" : "bg-gray-50")}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <RutaPreparacionSubNav theme={theme} />
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <Zap className={cn("h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0", dark ? "text-purple-400" : "text-purple-600")} />
            <h1 className={cn("text-[15px] sm:text-[23px] font-bold", dark ? "text-white" : "text-gray-900")}>
              Calculadora Saber 11
            </h1>
          </div>
          <p className={cn("text-sm sm:text-base", dark ? "text-gray-400" : "text-gray-600")}>
            Ingresa tus respuestas correctas por sesión y calcula tu puntaje estimado.
          </p>
        </div>
        <CalculadoraPuntaje dark={dark} />
      </div>
    </div>
  );
}

// ─── CALCULADORA ──────────────────────────────────────────────────────────────

function CalculadoraPuntaje({ dark }: { dark: boolean }) {
  const [bloques, setBloques] = useState<BloqueState>(BLOQUE_INICIAL);

  const setBloque = (b: Bloque, val: number) =>
    setBloques((prev) => ({ ...prev, [b]: Math.min(BLOQUE_MAX[b], Math.max(0, val)) }));

  const global = calcularGlobal(bloques);

  const nivelGlobal =
    global >= 300
      ? { nivel: "Muy buena",   color: "emerald", descripcion: "Excelente preparación — amplio acceso a programas de alta exigencia." }
      : global >= 266
      ? { nivel: "Buena",       color: "teal",    descripcion: "Buen desempeño — acceso a diversos programas universitarios." }
      : global >= 250
      ? { nivel: "Aceptable",   color: "blue",    descripcion: "Preparación suficiente — cumple el mínimo para la mayoría de programas." }
      : { nivel: "Por mejorar", color: "red",     descripcion: "Es importante reforzar todas las áreas antes del examen real." };

  const nivelTextColor: Record<string, string> = {
    emerald: dark ? "text-emerald-400" : "text-emerald-700",
    teal:    dark ? "text-teal-400"    : "text-teal-700",
    blue:    dark ? "text-blue-400"    : "text-blue-700",
    red:     dark ? "text-red-400"     : "text-red-600",
  };

  const nivelBg: Record<string, string> = {
    emerald: dark ? "bg-emerald-900/30 border-emerald-700/50" : "bg-emerald-50 border-emerald-200",
    teal:    dark ? "bg-teal-900/30 border-teal-700/50"       : "bg-teal-50 border-teal-200",
    blue:    dark ? "bg-blue-900/30 border-blue-700/50"       : "bg-blue-50 border-blue-200",
    red:     dark ? "bg-red-900/30 border-red-700/50"         : "bg-red-50 border-red-200",
  };

  const globalBar =
    nivelGlobal.color === "emerald" ? "linear-gradient(to right,#10b981,#34d399)" :
    nivelGlobal.color === "teal"    ? "linear-gradient(to right,#14b8a6,#2dd4bf)" :
    nivelGlobal.color === "blue"    ? "linear-gradient(to right,#3b82f6,#60a5fa)" :
                                      "linear-gradient(to right,#ef4444,#f87171)";

  const renderFila = (
    item: { id: string; area: string; nombre: string; emoji: string; color: string; preguntas: number },
    bloqueKey: Bloque
  ) => {
    const val    = bloques[bloqueKey];
    const max    = BLOQUE_MAX[bloqueKey];
    const pct    = Math.round((val / max) * 100);
    const pa     = puntajeArea(bloques, item.area as AreaId);
    const nivel  = getNivelArea(pa);
    const esMulti = ["matematicas", "ciencias", "sociales"].includes(item.area);
    const acum   = totalPorArea(bloques, item.area as AreaId);

    return (
      <div key={bloqueKey} className={cn("rounded-xl border p-3 h-full", COLOR_BG[item.color](dark))}>
        {/* Nombre + nivel + puntaje */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base flex-shrink-0">{item.emoji}</span>
            <div className="min-w-0">
              <p className={cn("text-xs font-bold leading-tight truncate", COLOR_TEXT[item.color](dark))}>
                {item.nombre}
              </p>
              <p className={cn("text-[10px]", dark ? "text-zinc-500" : "text-gray-400")}>
                {max} pregs · ×{PESOS[item.area]}
                {esMulti && (
                  <span className={cn("ml-1 font-semibold", COLOR_TEXT[item.color](dark))}>
                    · acum {acum}/{TOTALES[item.area]}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", NIVEL_PILL[nivel.color](dark))}>
              {nivel.nivel}
            </span>
            <span className={cn("text-base font-black tabular-nums w-8 text-right", COLOR_TEXT[item.color](dark))}>
              {pa}
            </span>
          </div>
        </div>

        {/* Stepper + barra */}
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center rounded-lg border overflow-hidden flex-shrink-0",
            dark ? "border-zinc-600 bg-zinc-800" : "border-gray-300 bg-white")}>
            <button type="button" onClick={() => setBloque(bloqueKey, val - 1)}
              className={cn("px-2 py-1 text-sm font-bold leading-none select-none transition-colors",
                dark ? "text-zinc-300 hover:bg-zinc-700" : "text-gray-600 hover:bg-gray-100")}>−</button>
            <input
              type="number" min={0} max={max} value={val}
              onChange={(e) => setBloque(bloqueKey, Number(e.target.value))}
              className={cn("w-9 text-center text-xs font-black outline-none bg-transparent py-1 tabular-nums",
                dark ? "text-white" : "text-gray-900")}
            />
            <button type="button" onClick={() => setBloque(bloqueKey, val + 1)}
              className={cn("px-2 py-1 text-sm font-bold leading-none select-none transition-colors",
                dark ? "text-zinc-300 hover:bg-zinc-700" : "text-gray-600 hover:bg-gray-100")}>+</button>
          </div>
          <span className={cn("text-[10px] flex-shrink-0 w-8", dark ? "text-zinc-500" : "text-gray-400")}>/{max}</span>
          <div className="flex-1 flex flex-col gap-0.5">
            <div className={cn("h-1.5 rounded-full overflow-hidden", dark ? "bg-zinc-700" : "bg-gray-200")}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: COLOR_HEX[item.color] }} />
            </div>
            <p className={cn("text-[10px] text-right tabular-nums", dark ? "text-zinc-500" : "text-gray-400")}>{pct}%</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("rounded-xl border", dark ? "border-zinc-700 bg-zinc-800/80" : "border-gray-200 bg-white")}>
      {/* Header */}
      <div className={cn("flex items-center gap-3 p-4 border-b", dark ? "border-zinc-700" : "border-gray-100")}>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
          dark ? "bg-blue-900/40" : "bg-blue-100")}>
          <Calculator className={cn("h-5 w-5", dark ? "text-blue-400" : "text-blue-600")} />
        </div>
        <div>
          <h2 className={cn("font-bold text-base", dark ? "text-white" : "text-gray-900")}>Calculadora Saber 11</h2>
          <p className={cn("text-xs", dark ? "text-gray-400" : "text-gray-500")}>
            Fórmula oficial ICFES · 278 preguntas · 2 sesiones de 4h 30min
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">

      
        {/* SESIONES + PUNTAJE GLOBAL — filas alineadas en desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-[auto_repeat(4,minmax(5.75rem,auto))] gap-x-4 gap-y-2">

          {/* SESIÓN 1 — encabezado */}
          <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 border min-h-[3.25rem] order-1",
            "lg:col-start-1 lg:row-start-1 lg:order-none",
            dark ? "border-zinc-700 bg-zinc-900/50" : "border-gray-200 bg-gray-100/80")}>
            <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">1</div>
            <div className="min-w-0">
              <p className={cn("text-xs font-bold", dark ? "text-white" : "text-gray-900")}>Sesión 1</p>
              <p className={cn("text-[10px] truncate", dark ? "text-zinc-400" : "text-gray-500")}>
                120 pregs · 4h 30min · MAT · LC · CN · SOC
              </p>
            </div>
          </div>

          {/* SESIÓN 2 — encabezado */}
          <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 border min-h-[3.25rem] order-6",
            "lg:col-start-2 lg:row-start-1 lg:order-none",
            dark ? "border-zinc-700 bg-zinc-900/50" : "border-gray-200 bg-gray-100/80")}>
            <div className="h-6 w-6 rounded-full bg-orange-600 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">2</div>
            <div className="min-w-0">
              <p className={cn("text-xs font-bold", dark ? "text-white" : "text-gray-900")}>Sesión 2</p>
              <p className={cn("text-[10px] truncate", dark ? "text-zinc-400" : "text-gray-500")}>
                134 pregs · 4h 30min · MAT · CN · SOC · ING
              </p>
            </div>
          </div>

          {/* Filas de materias — alineadas horizontalmente */}
          {SESION_1.map((item, i) => (
            <div key={item.id} className={cn("min-h-[5.75rem] lg:col-start-1 lg:order-none", LG_FILA[i], ORDER_S1[i])}>
              {renderFila(item, item.id as Bloque)}
            </div>
          ))}
          {SESION_2.map((item, i) => (
            <div key={item.id} className={cn("min-h-[5.75rem] lg:col-start-2 lg:order-none", LG_FILA[i], ORDER_S2[i])}>
              {renderFila(item, item.id as Bloque)}
            </div>
          ))}

          {/* PUNTAJE GLOBAL + RESUMEN + RANGOS — columna derecha alineada a la altura total */}
          <div className="order-11 lg:col-start-3 lg:row-start-1 lg:row-span-5 lg:order-none min-w-0">
            <div className="lg:sticky lg:top-4 flex flex-col gap-2 h-full">
              <div className={cn("rounded-xl border p-4 flex-shrink-0 flex flex-col justify-center",
                nivelBg[nivelGlobal.color])}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className={cn("h-5 w-5 flex-shrink-0", nivelTextColor[nivelGlobal.color])} />
                    <span className={cn("font-bold text-sm", dark ? "text-white" : "text-gray-900")}>Puntaje Global</span>
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0",
                    nivelTextColor[nivelGlobal.color],
                    dark ? "border-current bg-black/20" : "border-current bg-white/60")}>
                    {nivelGlobal.nivel}
                  </span>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <span className={cn("text-4xl lg:text-5xl font-black tabular-nums", nivelTextColor[nivelGlobal.color])}>{global}</span>
                  <span className={cn("text-lg font-medium mb-1", dark ? "text-zinc-500" : "text-gray-400")}>/500</span>
                </div>
                <div className={cn("h-2.5 w-full rounded-full overflow-hidden mb-2",
                  dark ? "bg-black/30" : "bg-white/60")}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(global / 500) * 100}%`, background: globalBar }} />
                </div>
                <p className={cn("text-xs leading-relaxed", dark ? "text-zinc-400" : "text-gray-500")}>{nivelGlobal.descripcion}</p>
              </div>

              {/* RESUMEN POR ÁREA */}
              <div className={cn("rounded-xl border p-3 flex-1 min-h-0 flex flex-col space-y-2",
                dark ? "border-zinc-700 bg-zinc-900/40" : "border-gray-100 bg-gray-50")}>
                <p className={cn("text-xs font-bold uppercase tracking-wide flex-shrink-0",
                  dark ? "text-zinc-300" : "text-gray-700")}>
                  📋 Resumen por área
                </p>
                <div className="space-y-1.5 flex-1 flex flex-col justify-between min-h-0">
                  {AREAS_ORDEN.map((area) => {
                    const item  = [...SESION_1, ...SESION_2].find((i) => i.area === area)!;
                    const pa    = puntajeArea(bloques, area);
                    const tot   = totalPorArea(bloques, area);
                    const max   = TOTALES[area];
                    const pct   = Math.round((tot / max) * 100);
                    const nivel = getNivelArea(pa);
                    return (
                      <div key={area} className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm w-4 text-center flex-shrink-0">{item.emoji}</span>
                        <span className={cn("text-[10px] font-medium flex-1 min-w-0 truncate",
                          dark ? "text-zinc-300" : "text-gray-700")}>{item.nombre}</span>
                        <div className={cn("w-10 h-1.5 rounded-full overflow-hidden flex-shrink-0",
                          dark ? "bg-zinc-700" : "bg-gray-200")}>
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: COLOR_HEX[item.color] }} />
                        </div>
                        <span className={cn("text-[9px] font-semibold px-1 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap",
                          NIVEL_PILL[nivel.color](dark))}>{nivel.nivel}</span>
                        <span className={cn("text-xs font-black tabular-nums w-6 text-right flex-shrink-0",
                          COLOR_TEXT[item.color](dark))}>{pa}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={cn("rounded-lg border p-3 flex-shrink-0",
                dark ? "border-zinc-700 bg-zinc-900/40" : "border-gray-200 bg-gray-50")}>
                <p className={cn("text-xs font-bold uppercase tracking-wide mb-2",
                  dark ? "text-zinc-300" : "text-gray-700")}>
                  📊 Rangos de referencia
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {RANGOS_REF.map((r) => (
                    <div key={r.rango} className={cn("rounded-lg px-1 py-1.5 text-center border min-w-0",
                      dark ? r.dc : r.lc)}>
                      <p className="text-[10px] font-black leading-tight">{r.rango}</p>
                      <p className="text-[9px] font-semibold leading-tight mt-0.5">{r.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
