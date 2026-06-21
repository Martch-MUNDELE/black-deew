export type PhoneLinkOptions = {
  defaultCountryCode?: string;
};

export function getPhoneDigits(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");

  return digits || null;
}

export function normalizePhoneDigits(
  phone: string | null | undefined,
  options: PhoneLinkOptions = {}
) {
  const digits = getPhoneDigits(phone);

  if (!digits) return null;

  const defaultCountryCode = String(options.defaultCountryCode || "").replace(/\D/g, "");

  if (!defaultCountryCode) return digits;

  if (digits.startsWith(defaultCountryCode)) return digits;

  if (digits.startsWith("00")) return digits.slice(2);

  if (digits.startsWith("0")) return `${defaultCountryCode}${digits.slice(1)}`;

  return digits;
}

export function buildTelHref(
  phone: string | null | undefined,
  options: PhoneLinkOptions = {}
) {
  const digits = normalizePhoneDigits(phone, options);

  return digits ? `tel:+${digits}` : null;
}

export function buildWhatsAppHref(
  phone: string | null | undefined,
  text?: string,
  options: PhoneLinkOptions = {}
) {
  const digits = normalizePhoneDigits(phone, options);

  if (!digits) return null;

  const query = text ? `?text=${encodeURIComponent(text)}` : "";

  return `https://wa.me/${digits}${query}`;
}
