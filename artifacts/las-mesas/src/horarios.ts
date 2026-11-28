export interface TramoHorario { inicio: string; fin: string }
export interface HorarioFestivo { fecha: string; nombre: string; cerrado: boolean; tramos: TramoHorario[] }
export interface ConfiguracionHorario { semanal: TramoHorario[][]; festivos: HorarioFestivo[] }

export const CLAVES_DIAS = ['contacto.dia.lunes','contacto.dia.martes','contacto.dia.miercoles','contacto.dia.jueves','contacto.dia.viernes','contacto.dia.sabado','contacto.dia.domingo'] as const;
export const HORARIO_PREDETERMINADO: ConfiguracionHorario = { semanal: [
  [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '18:00', fin: '23:00' }],
  [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '18:00', fin: '23:00' }],
  [{ inicio: '12:00', fin: '15:00' }, { inicio: '18:00', fin: '23:00' }], [{ inicio: '12:00', fin: '17:00' }],
], festivos: [] };

export function normalizarHorario(valor: unknown): ConfiguracionHorario {
  if (!valor || typeof valor !== 'object') return HORARIO_PREDETERMINADO;
  const objeto = valor as Partial<ConfiguracionHorario>;
  const semanal = Array.isArray(objeto.semanal) && objeto.semanal.length === 7
    ? objeto.semanal.map((dia) => Array.isArray(dia) ? dia.slice(0, 4).map((tramo) => ({ inicio: String(tramo?.inicio ?? ''), fin: String(tramo?.fin ?? '') })).filter((tramo) => /^\d{2}:\d{2}$/.test(tramo.inicio) && /^\d{2}:\d{2}$/.test(tramo.fin)) : [])
    : HORARIO_PREDETERMINADO.semanal;
  const festivos = Array.isArray(objeto.festivos) ? objeto.festivos.slice(0, 100).flatMap((festivo) => {
    if (!festivo || !/^\d{4}-\d{2}-\d{2}$/.test(festivo.fecha) || !String(festivo.nombre ?? '').trim()) return [];
    const tramos = Array.isArray(festivo.tramos) ? festivo.tramos.slice(0, 4).map((tramo) => ({ inicio: String(tramo?.inicio ?? ''), fin: String(tramo?.fin ?? '') })).filter((tramo) => /^\d{2}:\d{2}$/.test(tramo.inicio) && /^\d{2}:\d{2}$/.test(tramo.fin)) : [];
    return [{ fecha: festivo.fecha, nombre: String(festivo.nombre).trim().slice(0, 80), cerrado: Boolean(festivo.cerrado), tramos }];
  }) : [];
  return { semanal, festivos };
}

export function textoTramos(tramos: TramoHorario[], cerrado = false): string { return cerrado || !tramos.length ? 'Cerrado' : tramos.map(({ inicio, fin }) => `${inicio}–${fin}`).join(' · '); }
export type EstadoHorario = { abierto: true; cierre: string; dia: number } | { abierto: false; apertura: string; dia: number; hoy: boolean };

function partesCanarias(fecha: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Atlantic/Canary', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(fecha);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { dia: ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[value.weekday] ?? 0, minutos: Number(value.hour) * 60 + Number(value.minute), fecha: `${value.year}-${value.month}-${value.day}`, year: Number(value.year), month: Number(value.month), dayOfMonth: Number(value.day) };
}
function tramosDelDia(config: ConfiguracionHorario, dia: number, fecha: string) { const festivo = config.festivos.find((item) => item.fecha === fecha); return festivo ? (festivo.cerrado ? [] : festivo.tramos) : (config.semanal[dia] ?? []); }
export function obtenerEstadoHorario(fechaActual: Date, config: ConfiguracionHorario): EstadoHorario {
  const hoy = partesCanarias(fechaActual);
  for (const tramo of tramosDelDia(config, hoy.dia, hoy.fecha)) {
    const inicio = Number(tramo.inicio.slice(0, 2)) * 60 + Number(tramo.inicio.slice(3, 5));
    const fin = Number(tramo.fin.slice(0, 2)) * 60 + Number(tramo.fin.slice(3, 5));
    if (hoy.minutos >= inicio && hoy.minutos < fin) return { abierto: true, cierre: tramo.fin, dia: hoy.dia };
  }
  for (let offset = 0; offset < 370; offset += 1) {
    const date = new Date(Date.UTC(hoy.year, hoy.month - 1, hoy.dayOfMonth + offset, 12));
    const fecha = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    const dia = (date.getUTCDay() + 6) % 7;
    const siguiente = tramosDelDia(config, dia, fecha).find((tramo) => offset > 0 || Number(tramo.inicio.slice(0, 2)) * 60 + Number(tramo.inicio.slice(3, 5)) > hoy.minutos);
    if (siguiente) return { abierto: false, apertura: siguiente.inicio, dia, hoy: offset === 0 };
  }
  return { abierto: false, apertura: '', dia: 0, hoy: false };
}
export function horarioDeHoy(fechaActual: Date, config: ConfiguracionHorario) {
  const { dia, fecha } = partesCanarias(fechaActual);
  return { dia, tramos: tramosDelDia(config, dia, fecha) };
}

export function fechaCanarias(fecha: Date): string { return partesCanarias(fecha).fecha; }
