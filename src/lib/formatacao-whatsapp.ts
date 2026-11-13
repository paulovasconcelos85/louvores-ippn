import { encontrarReferenciasBiblicas } from '@/lib/biblia-referencias';

// Envolve cada referência bíblica encontrada no texto com _itálico_ (sintaxe do WhatsApp).
export function italicizarReferenciasBiblicas(texto: string): string {
  const referencias = encontrarReferenciasBiblicas(texto);
  if (referencias.length === 0) return texto;

  let resultado = '';
  let posicao = 0;
  for (const referencia of referencias) {
    resultado += texto.slice(posicao, referencia.inicio);
    resultado += `_${texto.slice(referencia.inicio, referencia.fim)}_`;
    posicao = referencia.fim;
  }
  resultado += texto.slice(posicao);
  return resultado;
}

function formatarLinhaParaWhatsApp(linha: string): string {
  const comItalico = italicizarReferenciasBiblicas(linha);
  const ehPergunta = /\?\s*$/.test(linha.trim());
  return ehPergunta ? `*${comItalico}*` : comItalico;
}

// Formata um bloco de texto (um parágrafo por linha) para compartilhar no WhatsApp:
// linhas que terminam em "?" viram *negrito* e referências bíblicas viram _itálico_.
export function formatarTextoParaWhatsApp(texto: string): string {
  return texto
    .split('\n')
    .map((linha) => (linha.trim() ? formatarLinhaParaWhatsApp(linha) : linha))
    .join('\n');
}
