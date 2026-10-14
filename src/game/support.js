// Voluntary support by Pix ("Apoie o WARZIL"). The payload is exactly what the
// owner's QR code encodes (decoded and CRC-checked); public/pix-qr.png is that QR
// image, checked to decode to the same payload. No checkout, no payment tracking.
export const PIX = {
  key: 'a5da07d0-1476-46a9-a5d0-7e381b0ec7c8',
  payload:
    '00020126880014br.gov.bcb.pix0136a5da07d0-1476-46a9-a5d0-7e381b0ec7c80226Obrigado por apoiar Warzil27600016BR.COM.PAGSEGURO013641F7EF48-948B-477F-B027-239359C8BCE65204000053039865802BR5920BRUNO QUEIROZ BARATA6009Sao Paulo62290525PAGS0000000002610141116766304A4DF',
  qr: '/pix-qr.png',
};

// "Fale com o criador": the owner's WhatsApp Business.
export const CONTACT_URL = 'https://wa.me/5511924915082';

// Shown only in builds that turn it on (VITE_SUPPORT_PIX=on), so it goes public
// only after the owner has checked the payment details.
export const SUPPORT_ENABLED = import.meta.env?.VITE_SUPPORT_PIX === 'on';

// CRC16-CCITT (0xFFFF), as the Pix "BR Code" standard uses for its last field.
export function pixCrc(text) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export const pixPayloadValid = (payload) => payload.slice(-8, -4) === '6304' && pixCrc(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();

// Clipboard with a fallback for browsers without the async API (or without
// permission). Resolves true when the text was copied.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the old way
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
