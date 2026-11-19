-- Boletim novo (sem seções) copia as seções do boletim anterior. Algumas igrejas
-- querem o boletim só com a liturgia: com esta opção desligada nada é copiado,
-- e seções apagadas de propósito não voltam ao reabrir o boletim.

alter table public.igrejas
  add column if not exists boletim_reaproveitar_secoes boolean not null default true;

-- IPPN: boletim só com a liturgia.
update public.igrejas
   set boletim_reaproveitar_secoes = false
 where id = 'a318042a-6403-40d4-a9b2-943d4372849a';
