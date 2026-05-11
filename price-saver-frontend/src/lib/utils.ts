export function buildWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("234")
    ? digits
    : digits.startsWith("0")
    ? "234" + digits.slice(1)
    : digits;
  const url = `https://wa.me/${normalized}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}
