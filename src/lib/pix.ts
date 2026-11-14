// Monta o payload EMV/BR Code ("Pix Copia e Cola") a partir da chave PIX da igreja.
// Esse payload é o que vira texto pra copiar E o conteúdo codificado no QR Code —
// sem ele formatado certinho (com o checksum CRC16), nenhum app de banco reconhece.

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do BR Code.
function crc16(payload: string): string {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// O BR Code só aceita ASCII sem acento nos campos de nome/cidade.
function normalizarAscii(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

export interface DadosPix {
  chave: string;
  beneficiario: string;
  cidade?: string | null;
}

export function buildPixPayload({ chave, beneficiario, cidade }: DadosPix): string {
  const nome = normalizarAscii(beneficiario).slice(0, 25) || 'IGREJA';
  const cidadeNormalizada = normalizarAscii(cidade || '').slice(0, 15) || 'BRASIL';
  const merchantAccountInfo = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave.trim());

  const payloadSemCrc =
    tlv('00', '01') + // Payload Format Indicator
    tlv('01', '11') + // Point of Initiation Method: estático (reutilizável)
    tlv('26', merchantAccountInfo) + // Merchant Account Info - Pix
    tlv('52', '0000') + // Merchant Category Code (genérico)
    tlv('53', '986') + // Moeda: Real (BRL)
    tlv('58', 'BR') + // País
    tlv('59', nome) + // Merchant Name (beneficiário)
    tlv('60', cidadeNormalizada) + // Merchant City
    tlv('62', tlv('05', '***')) + // Additional Data: txid genérico
    '6304'; // Abre o campo do CRC, valor vem logo a seguir

  return payloadSemCrc + crc16(payloadSemCrc);
}
