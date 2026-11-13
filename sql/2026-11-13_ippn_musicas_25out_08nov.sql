  -- IPPN Manaus: músicas cantadas de 25/10 a 08/11/2026 que não foram lançadas no sistema.
  -- Objetivo: alimentar as estatísticas do repertório.
  --
  -- Regras:
  --   * Cultos que já existem recebem as músicas nos espaços da liturgia. Cânticos
  --     congregacionais além do primeiro e a música da Ceia viram itens novos, e os
  --     itens seguintes descem na ordem.
  --   * Cultos que não existem são criados só com as músicas.
  --   * Um culto que já tenha qualquer música lançada é pulado: rodar duas vezes não duplica nada.
  --   * Se algum nome não for encontrado no cadastro, nada é gravado.

  begin;

  -- Cadastros novos (só o nome; a letra pode ser incluída depois pela tela de cânticos).
  -- Lista completa dos nomes usados abaixo: os que já existirem no cadastro são ignorados
  -- automaticamente (where not exists), então não duplica nada.
  insert into canticos (nome, igreja_id)
  select novo.nome, 'a318042a-6403-40d4-a9b2-943d4372849a'::uuid
  from (values
    ('Alfa e Ômega'),
    ('Tu és soberano'),
    ('Grande é o Senhor'),
    ('Aclame ao Senhor'),
    ('Autoridade e Poder (Marcos Góes)'),
    ('Hino 042 O grande amor de Deus'),
    ('Calmo, sereno e tranquilo'),
    ('Hino 177 Firme nas promessas'),
    ('Jesus em tua presença'),
    ('Mil motivos para agradecer'),
    ('Isaías 53 (Projeto Sola)'),
    ('Por que ele vive'),
    ('Consagração / Louvor ao Senhor (Aline Barros)'),
    ('Hino 144 Segurança e alegria'),
    ('Senhor te quero (Vineyard)'),
    ('Nome sobre todo nome'),
    ('Rei das Nações'),
    ('Rio de vida (Kleber Lucas)'),
    ('Redenção (Projeto Sola)')
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
    -- 25/10
    ('2026-10-25', 'Prelúdio',                 1, 'Alfa e Ômega', 'D'),
    ('2026-10-25', 'Cânticos Congregacionais', 1, 'Tu és soberano', 'D'),
    ('2026-10-25', 'Cânticos Congregacionais', 2, 'Grande é o Senhor', 'A'),
    ('2026-10-25', 'Cânticos Congregacionais', 3, 'Aclame ao Senhor', 'A'),
    ('2026-10-25', 'Dízimos e Ofertas',        1, 'Autoridade e Poder (Marcos Góes)', 'D'),
    ('2026-10-25', 'Cântico Final',            1, 'Hino 042 O grande amor de Deus', 'F'),

    -- 01/11
    ('2026-11-01', 'Prelúdio',                 1, 'Calmo, sereno e tranquilo', 'D'),
    ('2026-11-01', 'Cânticos Congregacionais', 1, 'Hino 177 Firme nas promessas', 'G'),
    ('2026-11-01', 'Cânticos Congregacionais', 2, 'Jesus em tua presença', 'C'),
    ('2026-11-01', 'Cânticos Congregacionais', 3, 'Aclame ao Senhor', 'A'),
    ('2026-11-01', 'Dízimos e Ofertas',        1, 'Mil motivos para agradecer', 'Eb'),
    ('2026-11-01', 'Santa Ceia',               1, 'Isaías 53 (Projeto Sola)', 'D'),
    ('2026-11-01', 'Cântico Final',            1, 'Por que ele vive', 'G'),

    -- 08/11
    ('2026-11-08', 'Prelúdio',                 1, 'Consagração / Louvor ao Senhor (Aline Barros)', 'A'),
    ('2026-11-08', 'Cânticos Congregacionais', 1, 'Hino 144 Segurança e alegria', 'E'),
    ('2026-11-08', 'Cânticos Congregacionais', 2, 'Senhor te quero (Vineyard)', 'G'),
    ('2026-11-08', 'Cânticos Congregacionais', 3, 'Nome sobre todo nome', 'A'),
    ('2026-11-08', 'Cânticos Congregacionais', 4, 'Rei das Nações', 'Am'),
    ('2026-11-08', 'Dízimos e Ofertas',        1, 'Rio de vida (Kleber Lucas)', 'G'),
    ('2026-11-08', 'Cântico Final',            1, 'Redenção (Projeto Sola)', 'D');

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
    and l."Dia" between '2026-10-25' and '2026-11-08'
    and i.cantico_id is not null
  order by l."Dia", i.ordem;
