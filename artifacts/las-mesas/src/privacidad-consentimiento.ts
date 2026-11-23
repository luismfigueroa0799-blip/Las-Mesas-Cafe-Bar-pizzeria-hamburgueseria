export const CLAVE_CONSENTIMIENTO = 'lm_privacidad_consentimiento_v1';
export const EVENTO_CONSENTIMIENTO = 'lm:privacidad-consentimiento';

export type ConsentimientoPrivacidad = {
  ruleta: boolean;
  actualizado: string;
};

export function leerConsentimiento(): ConsentimientoPrivacidad | null {
  try {
    const raw = window.localStorage.getItem(CLAVE_CONSENTIMIENTO);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentimientoPrivacidad>;
    if (typeof parsed.ruleta !== 'boolean' || typeof parsed.actualizado !== 'string') return null;
    return { ruleta: parsed.ruleta, actualizado: parsed.actualizado };
  } catch {
    return null;
  }
}

export function guardarConsentimiento(ruleta: boolean) {
  const consentimiento: ConsentimientoPrivacidad = { ruleta, actualizado: new Date().toISOString() };
  try {
    window.localStorage.setItem(CLAVE_CONSENTIMIENTO, JSON.stringify(consentimiento));
  } finally {
    window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: consentimiento }));
  }
}
