-- Autoatendimento: igrejas criadas pela landing (/comecar)
-- Data: 2026-10-24
--
-- O endereço público (oikoshub/<slug>) precisa ser único. A API já confere
-- antes de inserir, mas só o índice impede duas criações simultâneas com o
-- mesmo slug (a API trata o erro 23505 como "slug em uso").

-- 1. Diagnóstico: deve voltar vazio antes de criar o índice.
select lower(slug) as slug, count(*) as total, array_agg(nome) as igrejas
from public.igrejas
where slug is not null
group by lower(slug)
having count(*) > 1;

-- 2. Normaliza slugs existentes para minúsculas sem espaços.
update public.igrejas
set slug = lower(trim(slug))
where slug is not null
  and slug <> lower(trim(slug));

-- 3. Índice único (case-insensitive).
create unique index if not exists igrejas_slug_unico
  on public.igrejas (lower(slug));
