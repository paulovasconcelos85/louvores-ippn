-- Permite salvar tons menores na liturgia.
-- O enum ja aceitava os tons maiores/acidentados; estes valores completam
-- a lista usada nos formularios de canticos e liturgia.

alter type public.tom_musical add value if not exists 'Cm';
alter type public.tom_musical add value if not exists 'C#m';
alter type public.tom_musical add value if not exists 'Dm';
alter type public.tom_musical add value if not exists 'D#m';
alter type public.tom_musical add value if not exists 'Em';
alter type public.tom_musical add value if not exists 'Fm';
alter type public.tom_musical add value if not exists 'F#m';
alter type public.tom_musical add value if not exists 'Gm';
alter type public.tom_musical add value if not exists 'G#m';
alter type public.tom_musical add value if not exists 'Am';
alter type public.tom_musical add value if not exists 'A#m';
alter type public.tom_musical add value if not exists 'Bm';
