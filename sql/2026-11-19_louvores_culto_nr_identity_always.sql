-- "Culto nr." era identity BY DEFAULT, que aceita número informado no insert
-- (editor de tabelas, CSV, script). Uma linha assim passou à frente da
-- sequência e o insert de cultos pelo app passou a falhar com 23505
-- (duplicate key) para todas as igrejas. Corrigido em 19/11/2026 com setval.
-- ALWAYS faz o Postgres recusar número informado; o app nunca envia "Culto nr.".
-- Quem precisar mesmo forçar um número usa: insert ... overriding system value.

begin;

-- Garante que a sequência está à frente do maior número existente.
select setval(
  pg_get_serial_sequence('public."Louvores IPPN"', 'Culto nr.'),
  (select max("Culto nr.") from public."Louvores IPPN")
);

alter table public."Louvores IPPN"
  alter column "Culto nr." set generated always;

commit;
