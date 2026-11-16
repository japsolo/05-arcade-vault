-- SPEC 06: catálogo de juegos y leaderboard.

-- ===== Tablas =====

create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan', 'magenta', 'green', 'yellow')),
  playable   boolean not null default false,
  sort_order int not null
);

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games (id),
  name       text not null check (name ~ '^[A-Z0-9_]{1,10}$'),
  score      int not null check (score between 1 and 9999999),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index scores_created_at_idx on public.scores (created_at desc);

-- ===== RLS =====

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated
  using (true);

create policy "scores_select_public" on public.scores
  for select to anon, authenticated
  using (true);

-- Sin auth: cualquiera puede insertar, pero solo datos válidos en juegos jugables.
create policy "scores_insert_valid" on public.scores
  for insert to anon, authenticated
  with check (
    name ~ '^[A-Z0-9_]{1,10}$'
    and score between 1 and 9999999
    and exists (
      select 1 from public.games g
      where g.id = scores.game_id and g.playable
    )
  );

-- Defensa extra: nadie modifica el catálogo ni edita o borra puntuaciones desde la API.
revoke insert, update, delete, truncate on public.games from anon, authenticated;
revoke update, delete, truncate on public.scores from anon, authenticated;

-- ===== Vistas =====

-- Mejor marca de cada nombre por juego. Empate: gana la más antigua.
create view public.leaderboard
with (security_invoker = true) as
select
  game_id,
  name,
  score,
  created_at,
  (row_number() over (partition by game_id order by score desc, created_at asc))::int as rank
from (
  select distinct on (game_id, name) game_id, name, score, created_at
  from public.scores
  order by game_id, name, score desc, created_at asc
) best;

-- Estadísticas por juego (todas las partidas guardadas).
create view public.game_stats
with (security_invoker = true) as
select
  g.id as game_id,
  max(s.score) as best,
  count(s.id)::int as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

-- ===== Aviso pendiente de la SPEC 04 =====

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ===== Seed del catálogo =====

insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.',
   'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
   'ARCADE', 'cover-bricks', 'cyan', false, 1),
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que el techo te aplaste.',
   'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
   'PUZZLE', 'cover-tetro', 'magenta', false, 2),
  ('serpentina', 'SERPENTINA', 'Crece sin morder tu propia cola.',
   'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
   'ARCADE', 'cover-snake', 'green', false, 3),
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.',
   'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
   'ARCADE', 'cover-glot', 'yellow', false, 4),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.',
   'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
   'SHOOTER', 'cover-invaders', 'green', false, 5),
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.',
   'Tu nave triangular flota en vacío absoluto. Rota, acelera y dispara para partir las rocas en fragmentos cada vez más pequeños. Tienes 3 vidas, y si recoges el power-up 3x tendrás triple disparo durante unos segundos.',
   'SHOOTER', 'cover-rocas', 'yellow', true, 6),
  ('ranaria', 'RANARIA', 'Cruza la autopista de pixeles.',
   'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
   'ARCADE', 'cover-rana', 'green', false, 7),
  ('duelo-pixel', 'DUELO PIXEL', 'Dos paletas. Una pelota. Reflejos máximos.',
   'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
   'VERSUS', 'cover-duelo', 'cyan', false, 8);
