-- Cargos que o app já usa (src/lib/permissions.ts) mas que faltavam no enum:
-- 'admin' (gestão da igreja, criado pelo /comecar), 'staff' e 'musico' (tela
-- de usuários). Sem eles, inserts com esses cargos e filtros como
-- .in('cargo', ['admin', 'pastor']) falham com "invalid input value for enum".
-- ADD VALUE fica fora de begin/commit: o valor novo só pode ser usado após o commit.

alter type public.cargo_tipo add value if not exists 'admin';
alter type public.cargo_tipo add value if not exists 'staff';
alter type public.cargo_tipo add value if not exists 'musico';
