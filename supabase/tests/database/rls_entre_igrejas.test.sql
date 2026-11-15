-- Testes de segurança entre igrejas (RLS, grants, triggers e storage).
--
-- Rodar: supabase start && supabase test db
--
-- Cria duas igrejas fictícias e um elenco de usuários, e verifica o que cada
-- um consegue ler e alterar. Cada verificação roda como aquele usuário e é
-- desfeita logo em seguida (pg_temp.rodar), então uma não afeta a outra.
-- Tudo acontece numa transação que termina em rollback.

begin;

create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(80);

-- ---------------------------------------------------------------------------
-- Elenco
-- ---------------------------------------------------------------------------

create temp table u (quem text primary key, uid uuid, pessoa uuid, acesso uuid);
insert into u values
  ('pastor_a',   '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001'),
  ('super_a',    '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-000000000002'),
  ('lider_a',    '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-c000-000000000003'),
  ('membro_a',   '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-b000-000000000004', '00000000-0000-4000-c000-000000000004'),
  ('pastor_b',   '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000005', '00000000-0000-4000-c000-000000000005'),
  ('membro_b',   '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-b000-000000000006', '00000000-0000-4000-c000-000000000006'),
  ('admin_plat', '00000000-0000-4000-a000-000000000007', null,                                   '00000000-0000-4000-c000-000000000007'),
  ('intruso',    '00000000-0000-4000-a000-000000000008', null,                                   null);

create temp table k (nome text primary key, id uuid);
insert into k values
  ('igreja_a',  '00000000-0000-4000-d000-00000000000a'),
  ('igreja_b',  '00000000-0000-4000-d000-00000000000b'),
  ('tag_lider', '00000000-0000-4000-e000-000000000001'),
  ('tag_violao','00000000-0000-4000-e000-000000000002'),
  ('tag_pastor','00000000-0000-4000-e000-000000000003'),
  ('escala_a',  '00000000-0000-4000-f000-00000000000a'),
  ('escala_b',  '00000000-0000-4000-f000-00000000000b'),
  ('ef_a',      '00000000-0000-4000-f100-00000000000a'),
  ('ef_b',      '00000000-0000-4000-f100-00000000000b'),
  ('cantico_a', '00000000-0000-4000-f200-00000000000a'),
  ('cantico_b', '00000000-0000-4000-f200-00000000000b'),
  ('cantico_global', '00000000-0000-4000-f200-000000000000');

create function pg_temp.id(p text) returns uuid language sql stable as
  $$ select coalesce((select id from k where nome = p), (select uid from u where quem = p)) $$;
create function pg_temp.pessoa(p text) returns uuid language sql stable as
  $$ select pessoa from u where quem = p $$;

insert into igrejas (id, nome, slug, ativo, visivel_publico) values
  (pg_temp.id('igreja_a'), 'Igreja Alfa', 'teste-alfa', true, true),
  (pg_temp.id('igreja_b'), 'Igreja Beta', 'teste-beta', true, false);

insert into auth.users (id, email, aud, role)
select uid, quem || '@teste.invalid', 'authenticated', 'authenticated' from u;

insert into pessoas (id, nome, usuario_id, ativo)
select pessoa, quem, uid, true from u where pessoa is not null;

insert into pessoas_igrejas (pessoa_id, igreja_id, cargo, ativo)
select pessoa,
       case when quem like '%\_a' then pg_temp.id('igreja_a') else pg_temp.id('igreja_b') end,
       case when quem like 'pastor%' then 'pastor'::cargo_tipo
            when quem = 'super_a' then 'superadmin'::cargo_tipo
            else 'membro'::cargo_tipo end,
       true
from u where pessoa is not null;

insert into usuarios_acesso (id, auth_user_id, pessoa_id, igreja_id, email, nome, ativo)
select acesso, uid, pessoa,
       case when quem like '%\_a' then pg_temp.id('igreja_a')
            when quem like '%\_b' then pg_temp.id('igreja_b') end,
       quem || '@teste.invalid', quem, true
from u where acesso is not null;

insert into usuarios_igrejas (usuario_id, igreja_id, cargo, ativo)
select ua.id, ua.igreja_id, pi.cargo, true
from usuarios_acesso ua join pessoas_igrejas pi on pi.pessoa_id = ua.pessoa_id
where ua.id in (select acesso from u);

insert into plataforma_admins (auth_user_id) values (pg_temp.id('admin_plat'));

-- Catálogo de tags (na prática compartilhado entre igrejas).
insert into tags_funcoes (id, nome, categoria, igreja_id, ativo) values
  (pg_temp.id('tag_lider'),  'Líder de Louvor', 'louvor_lideranca',   pg_temp.id('igreja_a'), true),
  (pg_temp.id('tag_violao'), 'Violão',          'louvor_instrumento', pg_temp.id('igreja_a'), true),
  (pg_temp.id('tag_pastor'), 'Pastor',          'lideranca_pastor',   pg_temp.id('igreja_a'), true);

insert into usuarios_tags (pessoa_id, usuario_id, tag_id, igreja_id)
values (pg_temp.pessoa('lider_a'), (select acesso from u where quem = 'lider_a'), pg_temp.id('tag_lider'), pg_temp.id('igreja_a'));

insert into "Louvores IPPN" ("Culto nr.", "Dia", igreja_id) values
  (900001, date '2026-01-04', pg_temp.id('igreja_a')),
  (900002, date '2026-01-04', pg_temp.id('igreja_b'));

insert into louvor_itens (culto_id, tipo, ordem) values
  (900001, 'Cântico', 1),
  (900002, 'Cântico', 1);

insert into canticos (id, nome, igreja_id) values
  (pg_temp.id('cantico_a'), 'Cântico Alfa', pg_temp.id('igreja_a')),
  (pg_temp.id('cantico_b'), 'Cântico Beta', pg_temp.id('igreja_b')),
  (pg_temp.id('cantico_global'), 'Cântico sem igreja', null);

insert into escalas (id, titulo, data, hora_inicio, igreja_id) values
  (pg_temp.id('escala_a'), 'Escala Alfa', date '2026-01-04', '10:00', pg_temp.id('igreja_a')),
  (pg_temp.id('escala_b'), 'Escala Beta', date '2026-01-04', '10:00', pg_temp.id('igreja_b'));

insert into escalas_funcoes (id, escala_id, tag_id, pessoa_id) values
  (pg_temp.id('ef_a'), pg_temp.id('escala_a'), pg_temp.id('tag_violao'), pg_temp.pessoa('membro_a')),
  (pg_temp.id('ef_b'), pg_temp.id('escala_b'), pg_temp.id('tag_violao'), pg_temp.pessoa('membro_b'));

insert into notas_pastorais (membro_id, autor_id, conteudo, igreja_id) values
  (pg_temp.pessoa('membro_a'), pg_temp.pessoa('pastor_a'), 'Nota sobre membro A', pg_temp.id('igreja_a')),
  (pg_temp.pessoa('membro_b'), pg_temp.pessoa('pastor_b'), 'Nota sobre membro B', pg_temp.id('igreja_b'));

insert into convites (email, nome, igreja_id) values
  ('convite-a@teste.invalid', 'Convidado A', pg_temp.id('igreja_a')),
  ('convite-b@teste.invalid', 'Convidado B', pg_temp.id('igreja_b'));

insert into fin_contas (igreja_id, nome) values
  (pg_temp.id('igreja_a'), 'Conta Alfa'),
  (pg_temp.id('igreja_b'), 'Conta Beta');

insert into storage.objects (bucket_id, name) values
  ('liturgias_thumbnails', 'culto-900001-1.png'),
  ('liturgias_thumbnails', 'culto-900002-1.png');

-- ---------------------------------------------------------------------------
-- Executa um comando como um usuário e desfaz.
-- Devolve o valor do SELECT, o número de linhas afetadas, ou 'erro <sqlstate>'.
-- ---------------------------------------------------------------------------

create function pg_temp.rodar(p_quem text, p_sql text) returns text
language plpgsql as $$
declare
  v text;
  n bigint;
begin
  begin
    if p_quem = 'anon' then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('request.jwt.claim.sub', '', true);
      execute 'set local role anon';
    else
      perform set_config('request.jwt.claims',
        json_build_object('sub', pg_temp.id(p_quem), 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', pg_temp.id(p_quem)::text, true);
      execute 'set local role authenticated';
    end if;

    if lower(ltrim(p_sql)) like 'select%' then
      execute p_sql into v;
    else
      execute p_sql;
      get diagnostics n = row_count;
      v := n::text;
    end if;

    raise exception using errcode = 'P0001', message = '__ok__' || coalesce(v, 'null');
  exception when others then
    if sqlerrm like '\_\_ok\_\_%' then
      return substr(sqlerrm, 7);
    end if;
    return 'erro ' || sqlstate;
  end;
end;
$$;

-- Atalhos com os ids fixos, para os comandos ficarem legíveis.
create function pg_temp.q(p_sql text) returns text language sql stable as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(p_sql,
    ':igreja_a', quote_literal(pg_temp.id('igreja_a'))),
    ':igreja_b', quote_literal(pg_temp.id('igreja_b'))),
    ':escala_a', quote_literal(pg_temp.id('escala_a'))),
    ':escala_b', quote_literal(pg_temp.id('escala_b'))),
    ':ef_a', quote_literal(pg_temp.id('ef_a'))),
    ':tag_violao', quote_literal(pg_temp.id('tag_violao'))),
    ':tag_lider', quote_literal(pg_temp.id('tag_lider'))),
    ':membro_b', quote_literal(pg_temp.pessoa('membro_b')))
$$;

create function pg_temp.r(p_quem text, p_sql text) returns text language sql as
  $$ select pg_temp.rodar(p_quem, pg_temp.q(p_sql)) $$;

-- ---------------------------------------------------------------------------
-- Quem é admin da plataforma
-- ---------------------------------------------------------------------------

select is(pg_temp.r('admin_plat', 'select is_global_admin()'), 'true',  'admin da plataforma é admin global');
select is(pg_temp.r('super_a',    'select is_global_admin()'), 'false', 'superadmin de UMA igreja não é admin global');
select is(pg_temp.r('pastor_a',   'select is_global_admin()'), 'false', 'pastor não é admin global');
select is(pg_temp.r('anon',       'select is_global_admin()'), 'erro 42501', 'visitante não executa funções de permissão');
select is(pg_temp.r('pastor_a',   'select count(*) from plataforma_admins'), 'erro 42501', 'ninguém lê plataforma_admins pelo navegador');

-- ---------------------------------------------------------------------------
-- Cultos ("Louvores IPPN")
-- ---------------------------------------------------------------------------

select is(pg_temp.r('membro_a', 'select count(*) from "Louvores IPPN"'), '1', 'membro vê só os cultos da própria igreja');
select is(pg_temp.r('pastor_b', 'select count(*) from "Louvores IPPN" where igreja_id = :igreja_a'), '0', 'pastor não vê cultos de outra igreja');
select is(pg_temp.r('intruso',  'select count(*) from "Louvores IPPN"'), '0', 'conta sem igreja não vê cultos');
select is(pg_temp.r('anon',     'select count(*) from "Louvores IPPN"'), '1', 'visitante vê só cultos de igreja pública');
select is(pg_temp.r('lider_a',  'update "Louvores IPPN" set imagem_url = imagem_url where igreja_id = :igreja_a'), '1', 'líder de louvor edita culto da própria igreja');
select is(pg_temp.r('lider_a',  'update "Louvores IPPN" set imagem_url = imagem_url where igreja_id = :igreja_b'), '0', 'líder de louvor não edita culto de outra igreja');
select is(pg_temp.r('super_a',  'update "Louvores IPPN" set imagem_url = imagem_url where igreja_id = :igreja_b'), '0', 'superadmin de uma igreja não edita culto de outra');
select is(pg_temp.r('membro_a', 'update "Louvores IPPN" set imagem_url = imagem_url'), '0', 'membro comum não edita culto');
select is(pg_temp.r('lider_a',  'insert into "Louvores IPPN" ("Culto nr.", "Dia", igreja_id) values (900099, current_date, :igreja_b)'), 'erro 42501', 'líder de louvor não cria culto em outra igreja');
select is(pg_temp.r('pastor_a', 'delete from "Louvores IPPN" where igreja_id = :igreja_a'), '1', 'pastor apaga culto da própria igreja');
select is(pg_temp.r('pastor_a', 'delete from "Louvores IPPN" where igreja_id = :igreja_b'), '0', 'pastor não apaga culto de outra igreja');

-- ---------------------------------------------------------------------------
-- Liturgia (louvor_itens)
-- ---------------------------------------------------------------------------

select is(pg_temp.r('anon',     'select count(*) from louvor_itens'), '0', 'visitante não lê a liturgia direto (boletim usa o servidor)');
select is(pg_temp.r('membro_b', 'select count(*) from louvor_itens'), '1', 'membro lê só a liturgia da própria igreja');
select is(pg_temp.r('lider_a',  'update louvor_itens set ordem = ordem where igreja_id = :igreja_a'), '1', 'líder de louvor edita liturgia da própria igreja');
select is(pg_temp.r('lider_a',  'update louvor_itens set ordem = ordem where igreja_id = :igreja_b'), '0', 'líder de louvor não edita liturgia de outra igreja');
select is(pg_temp.r('lider_a',  'insert into louvor_itens (culto_id, tipo, ordem) values (900002, ''Cântico'', 2)'), 'erro 42501', 'líder de louvor não insere item em culto de outra igreja');
select is(pg_temp.r('lider_a',  'insert into louvor_itens (culto_id, tipo, ordem, igreja_id) values (900002, ''Cântico'', 2, :igreja_a)'), 'erro 42501', 'mandar igreja_id falso não engana: a igreja vem do culto');
select is(pg_temp.r('membro_a', 'delete from louvor_itens'), '0', 'membro comum não apaga liturgia');

-- ---------------------------------------------------------------------------
-- Cânticos
-- ---------------------------------------------------------------------------

select is(pg_temp.r('anon',     'select count(*) from canticos'), '0', 'visitante não lê cânticos direto');
select is(pg_temp.r('membro_b', 'select count(*) from canticos'), '2', 'membro vê cânticos da igreja e os sem igreja');
select is(pg_temp.r('membro_a', 'update canticos set nome = nome where igreja_id = :igreja_b'), '0', 'ninguém edita cântico de outra igreja');
select is(pg_temp.r('membro_a', 'update canticos set nome = nome where igreja_id is null'), '0', 'cântico sem igreja não é editável pelo navegador');
select is(pg_temp.r('membro_a', 'insert into canticos (nome, igreja_id) values (''X'', :igreja_b)'), 'erro 42501', 'ninguém cria cântico em outra igreja');
select is(pg_temp.r('membro_a', 'delete from canticos where igreja_id = :igreja_a'), '0', 'membro comum não apaga cântico');
select is(pg_temp.r('lider_a',  'delete from canticos where igreja_id = :igreja_a'), '1', 'líder de louvor apaga cântico da própria igreja');

-- ---------------------------------------------------------------------------
-- Escalas e funções de escala
-- ---------------------------------------------------------------------------

select is(pg_temp.r('membro_a', 'select count(*) from escalas'), '1', 'membro vê só as escalas da própria igreja');
select is(pg_temp.r('intruso',  'select count(*) from escalas'), '0', 'conta sem igreja não vê escalas');
select is(pg_temp.r('membro_b', 'select count(*) from escalas_funcoes'), '1', 'membro vê só as funções de escala da própria igreja');
select is(pg_temp.r('lider_a',  'insert into escalas (titulo, data, hora_inicio, igreja_id) values (''X'', current_date, ''10:00'', :igreja_b)'), 'erro 42501', 'líder de louvor não cria escala em outra igreja');
select is(pg_temp.r('pastor_a', 'update escalas set titulo = titulo where igreja_id = :igreja_b'), '0', 'pastor não edita escala de outra igreja');
select is(pg_temp.r('lider_a',  'insert into escalas_funcoes (escala_id, tag_id, pessoa_id, ordem) values (:escala_a, :tag_violao, :membro_b, 1)'), '1', 'líder de louvor escala gente na própria igreja');
select is(pg_temp.r('lider_a',  'insert into escalas_funcoes (escala_id, tag_id, pessoa_id, ordem) values (:escala_b, :tag_violao, :membro_b, 1)'), 'erro 42501', 'líder de louvor não mexe na escala de outra igreja');
select is(pg_temp.r('membro_a', 'update escalas_funcoes set confirmado = true where id = :ef_a'), '1', 'músico confirma a própria presença');
select is(pg_temp.r('membro_a', 'update escalas_funcoes set escala_id = :escala_b where id = :ef_a'), 'erro 42501', 'músico não se move para outra escala');
select is(pg_temp.r('membro_a', 'update escalas_funcoes set tag_id = :tag_lider where id = :ef_a'), 'erro 42501', 'músico não troca a própria função');
select is(pg_temp.r('membro_b', 'update escalas_funcoes set confirmado = true where id = :ef_a'), '0', 'ninguém confirma presença por outra pessoa');

-- ---------------------------------------------------------------------------
-- Funções (tags) do membro no /perfil
-- ---------------------------------------------------------------------------

select is(pg_temp.r('membro_a', 'insert into usuarios_tags (pessoa_id, tag_id) values (current_person_id(), :tag_violao)'), '1', 'membro marca um instrumento no próprio perfil');
select is(pg_temp.r('membro_a', 'insert into usuarios_tags (pessoa_id, tag_id) values (current_person_id(), :tag_lider)'), 'erro 42501', 'membro não se promove a líder de louvor');
select is(pg_temp.r('membro_a', 'insert into usuarios_tags (pessoa_id, tag_id) values (current_person_id(), ' || quote_literal(pg_temp.id('tag_pastor')) || ')'), 'erro 42501', 'membro não se marca como pastor');
select is(pg_temp.r('membro_a', 'insert into usuarios_tags (pessoa_id, tag_id) values (:membro_b, :tag_violao)'), 'erro 42501', 'membro não marca funções de outra pessoa');
select is(pg_temp.r('lider_a',  'delete from usuarios_tags where tag_id = :tag_lider'), '0', 'líder não remove a própria tag de liderança pelo perfil');

-- ---------------------------------------------------------------------------
-- Pessoas, vínculos, acessos e notas pastorais
-- ---------------------------------------------------------------------------

select is(pg_temp.r('anon',       'select count(*) from pessoas'), 'erro 42501', 'visitante não lê pessoas');
select is(pg_temp.r('intruso',    'select count(*) from pessoas'), '0', 'conta sem igreja não vê pessoas');
select is(pg_temp.r('membro_a',   'select count(*) from pessoas'), '1', 'membro comum vê só a si mesmo');
select is(pg_temp.r('pastor_a',   'select count(*) from pessoas'), '4', 'pastor vê as pessoas da própria igreja');
select is(pg_temp.r('super_a',    'select count(*) from pessoas'), '4', 'superadmin de uma igreja vê só as pessoas dela');
select is(pg_temp.r('admin_plat', 'select count(*) from pessoas'), '6', 'admin da plataforma vê pessoas de todas as igrejas');
select is(pg_temp.r('pastor_a',   'update pessoas set nome = nome where id = :membro_b'), '0', 'pastor não edita pessoa de outra igreja');
select is(pg_temp.r('super_a',    'update pessoas set nome = nome where id = :membro_b'), '0', 'superadmin de uma igreja não edita pessoa de outra');
select is(pg_temp.r('admin_plat', 'update pessoas set nome = nome where id = :membro_b'), '1', 'admin da plataforma edita pessoa de qualquer igreja');
select is(pg_temp.r('membro_a',   'update pessoas set cargo = ''pastor'' where id = current_person_id()'), 'erro 42501', 'membro não muda o próprio cargo');
select is(pg_temp.r('membro_a',   'update pessoas set nome = ''Novo nome'' where id = current_person_id()'), '1', 'membro edita o próprio nome');
select is(pg_temp.r('super_a',    'select count(*) from pessoas_igrejas where igreja_id = :igreja_b'), '0', 'superadmin de uma igreja não vê vínculos de outra');
select is(pg_temp.r('pastor_a',   'insert into pessoas_igrejas (pessoa_id, igreja_id, cargo) values (:membro_b, :igreja_b, ''pastor'')'), 'erro 42501', 'pastor não vincula gente em outra igreja');
select is(pg_temp.r('membro_a',   'select count(*) from usuarios_acesso'), '1', 'membro vê só o próprio acesso');
select is(pg_temp.r('pastor_a',   'select count(*) from usuarios_acesso'), '4', 'pastor vê os acessos da própria igreja');
select is(pg_temp.r('super_a',    'update usuarios_acesso set ativo = ativo'), '0', 'só o admin da plataforma altera acessos pelo banco');
select is(pg_temp.r('pastor_a',   'select count(*) from notas_pastorais'), '1', 'pastor lê só as notas pastorais da própria igreja');
select is(pg_temp.r('super_a',    'select count(*) from notas_pastorais'), '1', 'superadmin de uma igreja lê só as notas dela');
select is(pg_temp.r('lider_a',    'select count(*) from notas_pastorais'), '0', 'líder de louvor não lê notas pastorais');
select is(pg_temp.r('membro_a',   'select count(*) from notas_pastorais'), '0', 'membro não lê notas pastorais, nem as sobre si');
select is(pg_temp.r('pastor_a',   'select count(*) from convites'), '1', 'pastor vê só os convites da própria igreja');
select is(pg_temp.r('membro_a',   'select count(*) from convites'), '0', 'membro não vê convites');
select is(pg_temp.r('admin_plat', 'select count(*) from convites'), '2', 'admin da plataforma vê convites de todas');

-- ---------------------------------------------------------------------------
-- Tesouraria: só pelo servidor
-- ---------------------------------------------------------------------------

select is(pg_temp.r('pastor_a',   'select count(*) from fin_contas'), '0', 'nem o pastor lê a Tesouraria direto pelo navegador');
select is(pg_temp.r('admin_plat', 'select count(*) from fin_lancamentos'), '0', 'nem o admin da plataforma lê lançamentos direto');

-- ---------------------------------------------------------------------------
-- Imagens de liturgia (storage)
-- ---------------------------------------------------------------------------

select is(pg_temp.r('lider_a',  'insert into storage.objects (bucket_id, name) values (''liturgias_thumbnails'', ''culto-900001-2.png'')'), '1', 'líder de louvor sobe imagem de culto da própria igreja');
select is(pg_temp.r('lider_a',  'insert into storage.objects (bucket_id, name) values (''liturgias_thumbnails'', ''culto-900002-2.png'')'), 'erro 42501', 'líder de louvor não sobe imagem em culto de outra igreja');
select is(pg_temp.r('super_a',  'insert into storage.objects (bucket_id, name) values (''liturgias_thumbnails'', ''culto-900002-3.png'')'), 'erro 42501', 'superadmin de uma igreja não sobe imagem em outra');
select is(pg_temp.r('lider_a',  'insert into storage.objects (bucket_id, name) values (''liturgias_thumbnails'', ''qualquer.png'')'), 'erro 42501', 'nome fora do padrão culto-<nr>- é recusado');
select is(pg_temp.r('membro_a', 'insert into storage.objects (bucket_id, name) values (''liturgias_thumbnails'', ''culto-900001-4.png'')'), 'erro 42501', 'membro comum não sobe imagem');
select is(pg_temp.r('super_a',  'select count(*) from storage.objects where bucket_id = ''liturgias_thumbnails'''), '1', 'a listagem mostra só imagens da própria igreja');

-- ---------------------------------------------------------------------------
-- Triggers preenchem igreja_id a partir da linha-mãe (rodam como postgres)
-- ---------------------------------------------------------------------------

insert into louvor_itens (culto_id, tipo, ordem, igreja_id)
values (900001, 'Teste trigger', 99, pg_temp.id('igreja_b'));
select is((select igreja_id from louvor_itens where tipo = 'Teste trigger'), pg_temp.id('igreja_a'),
  'louvor_itens: igreja_id vem do culto, não do que foi enviado');

insert into escalas_funcoes (escala_id, tag_id, pessoa_id, igreja_id, observacoes, ordem)
values (pg_temp.id('escala_b'), pg_temp.id('tag_violao'), pg_temp.pessoa('membro_b'), pg_temp.id('igreja_a'), 'teste trigger', 2);
select is((select igreja_id from escalas_funcoes where observacoes = 'teste trigger'), pg_temp.id('igreja_b'),
  'escalas_funcoes: igreja_id vem da escala, não do que foi enviado');

insert into usuarios_tags (pessoa_id, tag_id)
values (pg_temp.pessoa('membro_b'), pg_temp.id('tag_violao'));
select is((select igreja_id from usuarios_tags where pessoa_id = pg_temp.pessoa('membro_b') and tag_id = pg_temp.id('tag_violao')),
  pg_temp.id('igreja_b'), 'usuarios_tags: sem igreja_id, usa a igreja da pessoa');

select * from finish();
rollback;
