import { createHash, randomBytes, randomUUID } from 'node:crypto';

type Global = Record<string, any>;
const g = globalThis as unknown as Global;
type PanelStaff = 'barra' | 'cocina';

function env(): Record<string, string | undefined> { return (g.process?.env ?? {}) as Record<string, string | undefined>; }
function seguro(): boolean { return env().VERCEL === '1' || env().NODE_ENV === 'production'; }
function nombreCookie(): string { return `${seguro() ? '__Host-' : ''}lm_staff_device`; }
function hash(valor: string): string { return createHash('sha256').update(valor).digest('hex'); }

function header(req: any, name: string): string {
  const headers = req?.headers;
  const raw = typeof headers?.get === 'function' ? headers.get(name) : headers?.[name] ?? headers?.[name.toLowerCase()];
  return String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '');
}

function cookieDispositivo(req: any): string {
  const name = nombreCookie();
  for (const part of header(req, 'cookie').split(';')) {
    const position = part.indexOf('=');
    if (position <= 0 || part.slice(0, position).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(position + 1).trim()); } catch { return ''; }
  }
  return '';
}

export function crearCookieDispositivo(secret: string): string {
  const secure = seguro() ? '; Secure' : '';
  return `${nombreCookie()}=${encodeURIComponent(secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=15552000${secure}`;
}

let pool: any;
async function base(): Promise<any> {
  if (pool) return pool;
  const connectionString = String(env().DATABASE_URL ?? env().NEON_DATABASE_URL ?? '').trim();
  if (!connectionString) throw new Error('Neon no está configurado (falta DATABASE_URL).');
  const pg: any = await import('pg');
  const Pool = pg?.default?.Pool ?? pg?.Pool;
  if (!Pool) throw new Error('No se pudo abrir la base de datos.');
  pool = new Pool({ connectionString, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000,
    ssl: connectionString.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false } });
  return pool;
}

let tablasPreparadas: Promise<void> | null = null;
async function prepararTablas(): Promise<void> {
  if (!tablasPreparadas) {
    tablasPreparadas = (async () => {
      const db = await base();
      await db.query(`create table if not exists public.staff_panel_devices (
        device_id text primary key,
        panel text not null check (panel in ('barra', 'cocina')),
        device_name text not null,
        secret_hash text not null unique,
        created_by text not null,
        created_at timestamptz not null default now(),
        last_seen timestamptz,
        revoked_at timestamptz
      )`);
      await db.query(`create table if not exists public.staff_panel_pair_codes (
        code_hash text primary key,
        panel text not null check (panel in ('barra', 'cocina')),
        device_name text not null,
        created_by text not null,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        consumed_at timestamptz
      )`);
      await db.query(`create index if not exists staff_panel_devices_panel_idx on public.staff_panel_devices(panel, revoked_at)`);
      await db.query(`create index if not exists staff_panel_pair_codes_expiry_idx on public.staff_panel_pair_codes(expires_at)`);
    })().catch((error) => { tablasPreparadas = null; throw error; });
  }
  return tablasPreparadas;
}

export async function autorizarDispositivo(req: any, panel: PanelStaff): Promise<boolean> {
  return Boolean(await idDispositivoAutorizado(req, panel));
}

export async function idDispositivoAutorizado(req: any, panel: PanelStaff): Promise<string | null> {
  const secret = cookieDispositivo(req);
  if (!secret || secret.length < 32) return null;
  await prepararTablas();
  const db = await base();
  const result = await db.query(
    `update public.staff_panel_devices set last_seen = now()
     where secret_hash = $1 and panel = $2 and revoked_at is null returning device_id`,
    [hash(secret), panel],
  );
  return result.rows?.length ? String(result.rows[0].device_id) : null;
}

export async function crearCodigoDispositivo(panel: PanelStaff, deviceName: string, createdBy: string): Promise<string> {
  await prepararTablas();
  const db = await base();
  const code = randomBytes(5).toString('hex').toUpperCase();
  const name = deviceName.trim().slice(0, 60);
  if (!name) throw new Error('Escribe un nombre para identificar la tablet.');
  await db.query('delete from public.staff_panel_pair_codes where expires_at < now() or consumed_at is not null');
  await db.query(
    `insert into public.staff_panel_pair_codes (code_hash, panel, device_name, created_by, expires_at)
     values ($1, $2, $3, $4, now() + interval '10 minutes')`,
    [hash(code), panel, name, createdBy],
  );
  return code;
}

export async function vincularDispositivo(code: string, panel: PanelStaff, createdBy: string): Promise<{ secret: string; deviceName: string } | null> {
  const normalizedCode = code.replace(/\s/g, '').toUpperCase();
  if (!/^[A-F0-9]{10}$/.test(normalizedCode)) return null;
  await prepararTablas();
  const db = await base();
  const secret = randomBytes(32).toString('base64url');
  const deviceId = randomUUID();
  const result = await db.query(
    `with used as (
       update public.staff_panel_pair_codes set consumed_at = now()
       where code_hash = $1 and panel = $2 and consumed_at is null and expires_at > now()
       returning panel, device_name
     )
     insert into public.staff_panel_devices (device_id, panel, device_name, secret_hash, created_by)
     select $3, used.panel, used.device_name, $4, $5 from used
     returning device_name`,
    [hash(normalizedCode), panel, deviceId, hash(secret), createdBy],
  );
  if (!result.rows?.length) return null;
  return { secret, deviceName: String(result.rows[0].device_name) };
}

export async function listarDispositivos(): Promise<Array<Record<string, unknown>>> {
  await prepararTablas();
  const db = await base();
  const result = await db.query(
    `select device_id as id, panel, device_name as name, created_at, last_seen
     from public.staff_panel_devices where revoked_at is null order by panel, device_name`,
  );
  return result.rows ?? [];
}

export async function revocarDispositivo(deviceId: string): Promise<boolean> {
  await prepararTablas();
  const db = await base();
  const result = await db.query(
    `update public.staff_panel_devices set revoked_at = now()
     where device_id = $1 and revoked_at is null returning device_id, panel`,
    [deviceId],
  );
  if (result.rows?.length) {
    await db.query(`create table if not exists public.cocina_push_subscriptions (
      endpoint text primary key, subscription jsonb not null,
      paneles text[] not null default array['cocina']::text[],
      created_at timestamptz not null default now(), last_seen timestamptz not null default now(),
      device_id text
    )`);
    await db.query(`alter table public.cocina_push_subscriptions add column if not exists device_id text`);
    await db.query(
      `update public.cocina_push_subscriptions set paneles = array_remove(paneles, $2)
       where device_id = $1`,
      [deviceId, String(result.rows[0].panel)],
    );
    await db.query('delete from public.cocina_push_subscriptions where device_id = $1 and cardinality(paneles) = 0', [deviceId]);
  }
  return Boolean(result.rows?.length);
}
