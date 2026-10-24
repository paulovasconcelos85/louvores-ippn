  -- IPPN Manaus: músicas cantadas de 09/08 a 18/10/2026 que não foram lançadas no sistema.
  -- Objetivo: alimentar as estatísticas do repertório.
  --
  -- Regras:
  --   * Cultos que já existem (16/08, 23/08, 06/09, 13/09, 20/09, 27/09, 18/10) recebem as
  --     músicas nos espaços da liturgia. Cânticos congregacionais além do primeiro e a música
  --     da Ceia viram itens novos, e os itens seguintes descem na ordem.
  --   * Cultos que não existem (09/08, 30/08, 04/10, 11/10) são criados só com as músicas.
  --   * Um culto que já tenha qualquer música lançada é pulado: rodar duas vezes não duplica nada.
  --   * Se algum nome não for encontrado no cadastro, nada é gravado.

  begin;

  -- Cadastros novos (só o nome; a letra pode ser incluída depois pela tela de cânticos).
  -- Para não cadastrar uma delas, apague a linha e as linhas dela na lista abaixo.
  insert into canticos (nome, igreja_id)
  select novo.nome, 'a318042a-6403-40d4-a9b2-943d4372849a'::uuid
  from (values
    ('Entrega (Vineyard)'),
    ('Perdão e Graça (Vineyard)')
  ) as novo(nome)
  where not exists (
    select 1 from canticos c
    where c.igreja_id = 'a318042a-6403-40d4-a9b2-943d4372849a' and c.nome = novo.nome
  );

  create temp table musicas_lancar (
    dia date not null,
    slot text not null,
    posicao int not null,
    cantico text not null,
    tom text
  ) on commit drop;

  insert into musicas_lancar (dia, slot, posicao, cantico, tom) values
    -- 09/08 (culto novo)
    ('2026-08-09', 'Prelúdio',                 1, 'Cantarei teu amor pra sempre', 'E'),
    ('2026-08-09', 'Cânticos Congregacionais', 1, 'Nome sobre todo nome', 'A'),
    ('2026-08-09', 'Cânticos Congregacionais', 2, 'Hino 010 A criação e o seu Criador', 'D'),
    ('2026-08-09', 'Cânticos Congregacionais', 3, 'O Espírito de Deus', 'C'),
    ('2026-08-09', 'Cânticos Congregacionais', 4, 'Sala do Trono', 'C'),
    ('2026-08-09', 'Dízimos e Ofertas',        1, 'O Cordeiro e o Leão', 'D'),
    ('2026-08-09', 'Santa Ceia',               1, 'O amor de Deus (Logo eu)', 'A'),
    ('2026-08-09', 'Cântico Final',            1, 'Maravilhosa graça (Drops INA)', 'G'),

    -- 16/08
    ('2026-08-16', 'Prelúdio',                 1, 'Aclame ao Senhor', 'A'),
    ('2026-08-16', 'Cânticos Congregacionais', 1, 'Gratidão', 'E'),
    ('2026-08-16', 'Cânticos Congregacionais', 2, 'Soberano', 'Bb'),
    ('2026-08-16', 'Cânticos Congregacionais', 3, 'Rei das Nações', 'G'),
    ('2026-08-16', 'Cânticos Congregacionais', 4, 'Calmo, sereno e tranquilo', 'D'),
    ('2026-08-16', 'Cânticos Congregacionais', 5, 'Hino 159 Bondoso Amigo', 'E'),
    ('2026-08-16', 'Dízimos e Ofertas',        1, 'Até que Ele venha', 'D'),
    ('2026-08-16', 'Cântico Final',            1, 'Perdão e Graça (Vineyard)', 'F'),

    -- 23/08
    ('2026-08-23', 'Prelúdio',                 1, 'Cantai ao Senhor (Min Koinonya)', null),
    ('2026-08-23', 'Cânticos Congregacionais', 1, 'Eu e minha casa', null),
    ('2026-08-23', 'Cânticos Congregacionais', 2, 'Rompendo em fé', null),
    ('2026-08-23', 'Cânticos Congregacionais', 3, 'Hino 144 Segurança e alegria', null),
    ('2026-08-23', 'Dízimos e Ofertas',        1, 'Celebrai a Cristo', null),
    ('2026-08-23', 'Cântico Final',            1, 'Até que Ele venha', null),

    -- 30/08 (culto novo)
    ('2026-08-30', 'Prelúdio',                 1, 'Medley - Tempo de festa / Faremos menção / Arraial do povo de Deus', null),
    ('2026-08-30', 'Cânticos Congregacionais', 1, 'Estamos de pé', null),
    ('2026-08-30', 'Cânticos Congregacionais', 2, 'Hino 155 Castelo Forte', null),
    ('2026-08-30', 'Cânticos Congregacionais', 3, 'Hosana', null),
    ('2026-08-30', 'Dízimos e Ofertas',        1, 'Quero subir', null),
    ('2026-08-30', 'Cântico Final',            1, 'Salmo 108', null),

    -- 06/09
    ('2026-09-06', 'Prelúdio',                 1, 'Muitos virão te louvar', 'D'),
    ('2026-09-06', 'Cânticos Congregacionais', 1, 'Solta o cabo da nau', 'G'),
    ('2026-09-06', 'Cânticos Congregacionais', 2, 'Abra os olhos do meu coração', 'D'),
    ('2026-09-06', 'Cânticos Congregacionais', 3, 'Estamos de pé', 'G'),
    ('2026-09-06', 'Dízimos e Ofertas',        1, 'Sonda-me, usa-me', 'C'),
    ('2026-09-06', 'Santa Ceia',               1, 'Consagração', 'A'),
    ('2026-09-06', 'Cântico Final',            1, 'Jesus prevaleceu', 'E'),

    -- 13/09
    ('2026-09-13', 'Prelúdio',                 1, 'Bondade de Deus', 'G'),
    ('2026-09-13', 'Cânticos Congregacionais', 1, 'Jesus em tua presença', 'D'),
    ('2026-09-13', 'Cânticos Congregacionais', 2, 'Hino 177 Firme nas promessas', 'G'),
    ('2026-09-13', 'Cânticos Congregacionais', 3, 'Aclame ao Senhor', 'A'),
    ('2026-09-13', 'Dízimos e Ofertas',        1, 'Eu e minha casa', 'C'),
    ('2026-09-13', 'Cântico Final',            1, 'Minh''alma engrandece ao Senhor', 'Bm'),

    -- 20/09
    ('2026-09-20', 'Prelúdio',                 1, 'Eu sou grato (Tributo a Yeovah)', 'E'),
    ('2026-09-20', 'Cânticos Congregacionais', 1, 'Gratidão', 'E'),
    ('2026-09-20', 'Cânticos Congregacionais', 2, 'Renova-me', 'D'),
    ('2026-09-20', 'Cânticos Congregacionais', 3, 'Rei das Nações', 'G'),
    ('2026-09-20', 'Dízimos e Ofertas',        1, 'Hino 297 Chamada final', 'G'),
    ('2026-09-20', 'Cântico Final',            1, 'Oh quão lindo esse nome é', 'D'),

    -- 27/09
    ('2026-09-27', 'Prelúdio',                 1, 'Jesus em tua presença', 'C'),
    ('2026-09-27', 'Cânticos Congregacionais', 1, 'Tu és Santo', 'G'),
    ('2026-09-27', 'Cânticos Congregacionais', 2, 'Hino 147 Vencendo vem Jesus', 'G'),
    ('2026-09-27', 'Cânticos Congregacionais', 3, 'Aclame ao Senhor', 'A'),
    ('2026-09-27', 'Dízimos e Ofertas',        1, 'Até que Ele venha', 'D'),
    ('2026-09-27', 'Cântico Final',            1, 'Teu amor não falha', 'Am'),

    -- 04/10 (culto novo)
    ('2026-10-04', 'Prelúdio',                 1, 'A Ele a glória', 'Em'),
    ('2026-10-04', 'Cânticos Congregacionais', 1, 'Hino 026 Ao Deus grandioso', 'G'),
    ('2026-10-04', 'Cânticos Congregacionais', 2, 'Salmo 96', 'G'),
    ('2026-10-04', 'Cânticos Congregacionais', 3, 'Nada além do sangue', 'D'),
    ('2026-10-04', 'Cânticos Congregacionais', 4, 'O Espírito de Deus', 'C'),
    ('2026-10-04', 'Cânticos Congregacionais', 5, 'Sala do Trono', 'C'),
    ('2026-10-04', 'Dízimos e Ofertas',        1, 'Ajuntamento', 'C'),
    ('2026-10-04', 'Cântico Final',            1, 'Te louvarei (Perto quero estar)', 'A'),

    -- 11/10 (culto novo)
    ('2026-10-11', 'Prelúdio',                 1, 'Hino 026 Ao Deus grandioso', 'G'),
    ('2026-10-11', 'Cânticos Congregacionais', 1, 'Quebrantado', 'C'),
    ('2026-10-11', 'Cânticos Congregacionais', 2, 'É o teu povo', 'G'),
    ('2026-10-11', 'Cânticos Congregacionais', 3, 'Glória pra sempre', 'E'),
    ('2026-10-11', 'Dízimos e Ofertas',        1, 'Oferta de amor', 'G'),
    ('2026-10-11', 'Cântico Final',            1, 'Quem nos separará', 'G'),

    -- 18/10
    ('2026-10-18', 'Prelúdio',                 1, 'Entrega (Vineyard)', 'D'),
    ('2026-10-18', 'Cânticos Congregacionais', 1, 'Hino 155 Castelo Forte', 'G'),
    ('2026-10-18', 'Cânticos Congregacionais', 2, 'Abra os olhos do meu coração', 'E'),
    ('2026-10-18', 'Cânticos Congregacionais', 3, 'Estamos de pé', 'G'),
    ('2026-10-18', 'Dízimos e Ofertas',        1, 'Faz chover', 'D'),
    ('2026-10-18', 'Cântico Final',            1, 'O mover do Espírito', 'E');

  do $$
  declare
    v_igreja constant uuid := 'a318042a-6403-40d4-a9b2-943d4372849a';
    v_slots constant text[] := array['Prelúdio', 'Cânticos Congregacionais', 'Dízimos e Ofertas', 'Santa Ceia', 'Cântico Final'];
    v_faltando text;
    v_dia date;
    v_culto bigint;
    v_slot text;
    v_ancora_ordem int;
    v_ancora_id uuid;
    v_extras int;
    v_musica record;
  begin
    select string_agg(distinct m.cantico, ', ') into v_faltando
    from musicas_lancar m
    where not exists (select 1 from canticos c where c.igreja_id = v_igreja and c.nome = m.cantico);

    if v_faltando is not null then
      raise exception 'Cânticos não encontrados no cadastro da IPPN: %', v_faltando;
    end if;

    for v_dia in select distinct dia from musicas_lancar order by dia loop
      select "Culto nr." into v_culto
      from "Louvores IPPN"
      where igreja_id = v_igreja and "Dia" = v_dia
      order by "Culto nr."
      limit 1;

      if v_culto is null then
        insert into "Louvores IPPN" ("Dia", igreja_id, palavra_pastoral_autor)
        values (v_dia, v_igreja, null)
        returning "Culto nr." into v_culto;

        insert into louvor_itens (culto_id, cantico_id, tipo, ordem, tom, visibilidade)
        select v_culto, c.id::text, m.slot,
              row_number() over (order by array_position(v_slots, m.slot), m.posicao),
              m.tom::public.tom_musical, 'publico'
        from musicas_lancar m
        join canticos c on c.igreja_id = v_igreja and c.nome = m.cantico
        where m.dia = v_dia;

        raise notice '% : culto % criado', v_dia, v_culto;
        continue;
      end if;

      if exists (select 1 from louvor_itens where culto_id = v_culto and cantico_id is not null) then
        raise notice '% : culto % já tem músicas, pulado', v_dia, v_culto;
        continue;
      end if;

      foreach v_slot in array v_slots loop
        continue when not exists (select 1 from musicas_lancar where dia = v_dia and slot = v_slot);

        select count(*) - 1 into v_extras from musicas_lancar where dia = v_dia and slot = v_slot;

        if v_slot = 'Santa Ceia' then
          -- A Ceia não tem espaço na liturgia nova: entra logo depois da pregação.
          select id, ordem into v_ancora_id, v_ancora_ordem
          from louvor_itens
          where culto_id = v_culto and tipo = 'Pregação da Palavra'
          order by ordem limit 1;
          v_ancora_id := null;
          v_extras := v_extras + 1;
        else
          select id, ordem into v_ancora_id, v_ancora_ordem
          from louvor_itens
          where culto_id = v_culto and tipo = v_slot and cantico_id is null
          order by ordem limit 1;
        end if;

        if v_ancora_ordem is null then
          raise exception '% : culto % não tem o item "%" na liturgia', v_dia, v_culto, v_slot;
        end if;

        -- Desloca em dois passos para não colidir caso exista unicidade em (culto_id, ordem).
        if v_extras > 0 then
          update louvor_itens set ordem = ordem + 100000
          where culto_id = v_culto and ordem > v_ancora_ordem;
          update louvor_itens set ordem = ordem - 100000 + v_extras
          where culto_id = v_culto and ordem > 100000;
        end if;

        for v_musica in
          select m.posicao, m.tom, c.id::text as cantico_id
          from musicas_lancar m
          join canticos c on c.igreja_id = v_igreja and c.nome = m.cantico
          where m.dia = v_dia and m.slot = v_slot
          order by m.posicao
        loop
          if v_ancora_id is not null and v_musica.posicao = 1 then
            update louvor_itens
            set cantico_id = v_musica.cantico_id, tom = v_musica.tom::public.tom_musical
            where id = v_ancora_id;
          else
            insert into louvor_itens (culto_id, cantico_id, tipo, ordem, tom, visibilidade)
            values (
              v_culto, v_musica.cantico_id, v_slot,
              v_ancora_ordem + case when v_ancora_id is null then v_musica.posicao else v_musica.posicao - 1 end,
              v_musica.tom::public.tom_musical, 'publico'
            );
          end if;
        end loop;

        v_ancora_id := null;
        v_ancora_ordem := null;
      end loop;

      raise notice '% : culto % preenchido', v_dia, v_culto;
    end loop;
  end $$;

  commit;

  -- Conferência: músicas lançadas por culto, na ordem da liturgia.
  select l."Dia", l."Culto nr.", i.ordem, i.tipo, c.nome, i.tom
  from "Louvores IPPN" l
  join louvor_itens i on i.culto_id = l."Culto nr."
  left join canticos c on c.id::text = i.cantico_id
  where l.igreja_id = 'a318042a-6403-40d4-a9b2-943d4372849a'
    and l."Dia" between '2026-08-09' and '2026-10-18'
    and i.cantico_id is not null
  order by l."Dia", i.ordem;
