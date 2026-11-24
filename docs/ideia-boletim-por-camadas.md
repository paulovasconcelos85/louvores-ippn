# Ideia: boletim por camadas

Anotações de uma conversa de 24/11/2026 sobre melhorar a elaboração do boletim.
Nada disso foi implementado ainda.

## O problema

A tela de cultos trata o boletim como algo que se cria do zero toda semana
("Novo Boletim"), mas na prática quase tudo se repete. O que muda semanalmente é
a liturgia, os cânticos, a palavra pastoral e alguns avisos.

## Proposta: separar o conteúdo pelo tempo que dura

| Camada | Exemplos | Quando muda |
|---|---|---|
| Fixo da igreja | cabeçalho, horários, pastores, contatos, missão | quase nunca |
| Do período | notícias do mês, avisos com validade, campanhas | mensal ou com data de validade |
| Do culto | liturgia, cânticos, pregador, palavra pastoral, avisos da semana, pedidos de oração | toda semana |

O boletim publicado é a soma das três camadas. A tela de cultos foca só na
terceira; as outras aparecem como leitura, com um link "editar conteúdo fixo".

O banco já está no meio do caminho:

- `boletim_secoes.culto_id` é opcional (a seção pode ser de um culto ou da igreja toda);
- `noticias_mensais` já é conteúdo por mês;
- `modelos_liturgia` / `modelo_culto_padrao` já guardam o modelo de liturgia.

### Nome do botão

"Nova liturgia" engana um pouco, porque avisos e pedidos de oração também são da
semana. Sugestão: **"Preparar domingo"** ou **"Novo culto"**.

## Decisões

- **Sem rascunho.** Fica como hoje: a igreja cria o novo culto e, pela data dele, o
  boletim público já mostra a nova data e a nova liturgia (a página mostra o
  próximo culto ou o último). O resto continua igual.
- **Conteúdo fixo e do período é referência, não cópia.** Se alguém corrige o
  telefone da secretaria, o boletim atual muda na hora. Em boletins antigos o
  conteúdo fixo aparece na versão atual, o que é aceitável.
- **O que precisa ficar salvo do passado:** liturgia, cânticos e palavra pastoral
  (ficam presos ao culto, como hoje) e também as notícias e avisos da época.

## Avisos com validade

- Aviso ligado a um evento vale **até a data do evento** e depois sai sozinho.
  - Evento de vários dias: usar a data de **término**.
  - Evento no mesmo domingo, à tarde ou à noite: continua naquele boletim. A
    regra é "some quando a data do evento for anterior à data do culto", não
    "anterior a hoje".
- Aviso sem evento ("traga alimentos para a cesta"): por padrão vale só aquele
  culto, com a opção de escolher uma data de validade manualmente.
- Possível atalho: botão "anunciar no boletim" no próprio evento, com título, data
  e imagem já preenchidos.

## Histórico sem copiar nada

Se cada aviso ou notícia tiver um período de exibição, o boletim antigo se
reconstrói sozinho: mostra o que estava valendo na data daquele culto.

**Regra principal: aviso vencido não é apagado, só sai de cena.** Se alguém
apagar, ele some também dos boletins antigos. O botão de remover passa a ser
"encerrar aviso" (põe a data de fim em hoje). Apagar de verdade fica só para
quem cadastrou algo errado.

| Conteúdo | Como fica no histórico |
|---|---|
| Liturgia, cânticos, palavra pastoral | presos ao culto, como hoje |
| Avisos e notícias | aparecem pelo período de validade, então o histórico vem automático |
| Notícias do mês | aparecem pelo mês de referência |
| Conteúdo fixo da igreja | sempre o atual |

Imperfeição aceita: editar o texto de um aviso hoje muda também os boletins
antigos em que ele aparecia.

## Notícias do mês: como funciona hoje

- O filtro é pelo **mês do boletim**, não pela data de hoje
  (`buildNoticiasMensaisSection` em `src/app/api/boletins-home/route.ts`, filtra
  `mes_referencia`/`ano_referencia` e `ativo = true`).
- Boletim antigo de outubro mostra as notícias de outubro, então o histórico já
  funciona. Culto de 1º de dezembro cadastrado em novembro já mostra as de dezembro.

Duas limitações:

1. **Notícia apagada some também do histórico.** O excluir em
   `EditorBoletimDoDiaModal.tsx` faz `delete` de verdade. A coluna `ativo` já
   existe, mas a busca do boletim filtra `ativo = true`, o que esconderia a
   notícia desativada até nos meses antigos. Precisa ajustar essa regra.
2. **Campanha de vários meses** precisa ser cadastrada de novo a cada mês, e uma
   notícia lançada no dia 28 fica só três dias no ar.

Sugestão: tratar a notícia do mês como mais um caso do modelo de período dos
avisos. Por padrão vai do dia 1 ao último dia do mês, com a opção de estender até
outra data. Avisos e notícias passam a seguir a mesma regra e a mesma lógica de
histórico.

## Outras ideias

1. **Começar da semana anterior:** o culto novo já vem com a liturgia do domingo
   passado; só se trocam cânticos, leitura e pregador.
2. **Puxar da agenda de eventos:** já existe a seção "Próximos Eventos", montada
   sozinha com os próximos eventos da igreja (commit `3d6e832`).
3. **Lista de pendências** antes de publicar: "Faltam: pregador, 2 cânticos,
   leitura bíblica".
4. **Modelos por tipo de culto** (EBD, culto da noite, Santa Ceia).

## Ordem sugerida

1. Começar da semana anterior + avisos com validade (pela data do evento).
2. Parar de apagar avisos e notícias de verdade; ajustar o filtro por período.
3. Notícia do mês com opção de estender.
4. Separação visual em camadas e renomear o botão.
