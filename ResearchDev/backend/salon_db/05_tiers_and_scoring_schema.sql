-- Step 5: irreversibility tiers + scoring tables.  Run once in the Supabase SQL Editor (safe to re-run).
-- The four score tables were empty placeholders; they are rebuilt here with the columns the scoring needs.

-- ---------- 1. Tiers (1 = gone within a day ... 5 = permanent or a real risk of damage) ----------
update ref.sub_service s set tier = v.tier
from (values
 ('Haircut & Trim',3), ('Style Cut & Restyling',4),
 ('Global Colour & Root Touch-up',4), ('Highlights, Balayage & Ombre',5), ('Bleach & Fashion Colour',5),
 ('Rebonding',5), ('Keratin & Smoothening',4), ('Perming & Texturizing',5),
 ('Hair Spa & Deep Conditioning',2), ('Scalp Care (Dandruff & Hair Fall)',2), ('Protein, Botox & Oil Treatments',3),
 ('Wash & Blow Dry',1), ('Temporary Straightening / Curling',1), ('Event & Party Hairstyle',1), ('Hair Extensions, Wigs & Systems',4),
 ('Basic Clean-up & Express Facial',2), ('Deep Cleansing & Anti-Aging Facial',2), ('Brightening & De-Tan Facial',2), ('Advanced Hydra & Oxygen Facial',2),
 ('Targeted Acne & Pigmentation Care',4), ('De-Tan Body & Face Care',2), ('Chemical Peels',5),
 ('Eyebrow Threading, Lamination & Tint',3), ('Eyelash Extensions & Lash Lift',3), ('Microblading & Micro-pigmentation',5),
 ('Facial Threading & Waxing',3), ('Arms, Legs & Underarm Waxing',3), ('Full Body Waxing & Bikini Care',3), ('Face & Body Bleaching',3),
 ('Manicure & Pedicure',2), ('Foot Spa & Intensive Heel Care',2),
 ('Classic & Gel Nail Polish Application',3), ('Gel / Acrylic Polish Removal',3),
 ('Acrylic & Gel Nail Extensions',3), ('Extension Refill & Custom Nail Art',3),
 ('Bridal Trial & Consultation',1), ('Wedding Day Bridal Makeup & Hair',1), ('Homecoming & Engagement Makeup',1), ('Bridal Party & Photoshoot Makeup',1),
 ('Wedding Day Groom Dressing & Hair',1), ('Nilame & Traditional Kandyan Dressing',1), ('Homecoming Groom Styling',1),
 ('Saree & Kandyan Osariya Draping',1), ('Jewellery & Ornament Setting',1),
 ('Party, Birthday & Event Makeup',1), ('HD & Commercial Photoshoot Makeup',1), ('Mehendi / Henna Application',2),
 ('Beard Trim & Line Up',2), ('Clean Shave',1), ('Hot Towel Shave',1), ('Beard Colouring',3)
) as v(name, tier)
where s.name = v.name;

-- ---------- 2. Scoring tables ----------
drop view if exists score.v_ranking;
drop function if exists score.rank_providers(text, numeric[]);
drop table if exists score.commitment_outcome, score.trust_score, score.category_score, score.gate_veto_status, score.provider_safety, score.scoring_run cascade;

create table score.scoring_run (
  scoring_run_id  serial primary key,
  run_at          timestamptz not null default now(),
  reference_date  date not null,          -- "today" for the 24-month window = date of the newest review in the data
  parameters      jsonb not null
);
create table score.gate_veto_status (     -- provider-wide
  scoring_run_id     int  not null references score.scoring_run on delete cascade,
  place_id           text not null references raw.provider(place_id),
  sub_point_code     text not null references ref.sub_point(code),
  kind               text not null check (kind in ('gate', 'veto')),
  status             text not null check (status in ('badge', 'caution', 'gate applied', 'veto applied')),
  report_count       int  not null,       -- independent qualifying reports in the window
  disputed_reports   int  not null,       -- of those, how many the owner disputed in a reply (credibility not judged)
  first_report_date  date not null,
  last_report_date   date not null,
  expires_on         date not null,       -- last report + 24 months
  primary key (scoring_run_id, place_id, sub_point_code)
);
create table score.provider_safety (
  scoring_run_id        int  not null references score.scoring_run on delete cascade,
  place_id              text not null references raw.provider(place_id),
  safety_status         text not null check (safety_status in ('clear', 'caution', 'safety concern')),
  safety_reports        int  not null,
  damage_level_reports  int  not null,
  reason                text,
  primary key (scoring_run_id, place_id)
);
create table score.category_score (
  scoring_run_id    int  not null references score.scoring_run on delete cascade,
  place_id          text not null references raw.provider(place_id),
  sub_service_code  text not null references ref.sub_service(code),
  category_no       smallint not null references ref.framework_category(category_no),
  -- Category 8 (Overall Verdict) is stored here too, so the app can show it,
  -- but it is reported only: the ranking functions never read it.
  score             numeric(5,4) not null,     -- 0 to 1; 0.5 = neutral (no evidence)
  evidence_weight   numeric(9,3) not null,
  evidence_count    int not null,
  primary key (scoring_run_id, place_id, sub_service_code, category_no)
);
create table score.trust_score (
  scoring_run_id    int  not null references score.scoring_run on delete cascade,
  place_id          text not null references raw.provider(place_id),
  sub_service_code  text not null references ref.sub_service(code),
  tier              smallint not null,
  base_score        numeric(5,4) not null,     -- equal-weight mean of the 7 weighted category scores
  gate_penalty      numeric(4,2) not null,     -- 0.15 per applied gate
  trust_score       numeric(5,4) not null,     -- base_score - gate_penalty, not below 0
  range_low         numeric(5,4) not null,     -- 80% range
  range_high        numeric(5,4) not null,
  range_width       numeric(5,4) not null,
  evidence_weight   numeric(9,3) not null,
  evidence_reviews  int not null,
  badges            text,
  safety_status     text not null check (safety_status in ('clear', 'caution', 'safety concern')),
  rank_status       text not null check (rank_status in ('ranked', 'available but not ranked', 'not ranked: safety concern')),
  rank_in_service   int,                        -- null unless ranked
  primary key (scoring_run_id, place_id, sub_service_code)
);
create index trust_score_service_idx on score.trust_score (sub_service_code, rank_in_service);
create table score.commitment_outcome (         -- 3.4; filled once later reviews allow a test
  scoring_run_id  int  not null references score.scoring_run on delete cascade,
  review_id       text not null references raw.owner_reply(review_id),
  issue           text not null,
  outcome         text not null check (outcome in ('kept', 'broken', 'no clear change', 'not testable'))
);

-- ---------- 3. Ranking view (latest scoring run, default equal weights) ----------
create view score.v_ranking as
select t.sub_service_code, d.category as service_category, d.service, d.sub_service, t.tier,
       t.rank_in_service, t.rank_status, t.safety_status,
       p.place_id, p.name as provider_name, p.city,
       t.trust_score, t.range_low, t.range_high, t.base_score, t.gate_penalty, t.badges,
       t.evidence_reviews, p.google_rating, p.google_review_count
from score.trust_score t
join raw.provider p using (place_id)
join ref.dim_service d using (sub_service_code)
where t.scoring_run_id = (select max(scoring_run_id) from score.scoring_run);

-- ---------- 4. Personalised ranking: the user gives their own weight for each of the 7 weighted categories ----------
-- Category 8 (Overall Verdict) is reported only: it takes no weight and does not enter the mean.
-- Example:  select * from score.rank_providers('HR.CHEM.02');                             -- equal weights
--           select * from score.rank_providers('HR.CHEM.02', array[1,1,1,1,1,1,3]);       -- safety, hygiene & facilities counts triple
create function score.rank_providers(p_sub_service text, p_weights numeric[] default null)
returns table (rank_no bigint, place_id text, provider_name text, city text, personal_score numeric,
               range_low numeric, range_high numeric, safety_status text, rank_status text, badges text, evidence_reviews int)
language sql stable as $$
  with w as (
    -- Seven weights, one per WEIGHTED category. Framework v5's category 8
    -- (Overall Verdict) is reported only and carries no user weight, so
    -- generate_series stops at 7 and the join below drops its score rows
    -- from the mean. A shorter array is padded with 1 by the coalesce.
    select g as category_no, coalesce(p_weights[g], 1)::numeric as weight from generate_series(1, 7) g
  ), run as (select max(scoring_run_id) as id from score.scoring_run),
  s as (
    select c.place_id, sum(c.score * w.weight) / nullif(sum(w.weight), 0) as base
    from score.category_score c join w using (category_no), run
    where c.scoring_run_id = run.id and c.sub_service_code = p_sub_service
    group by c.place_id
  )
  select case when t.rank_status = 'ranked'
              then row_number() over (partition by (t.rank_status = 'ranked')
                                      order by (t.safety_status = 'clear') desc, greatest(s.base - t.gate_penalty, 0) desc, t.evidence_weight desc)
         end as rank_no,
         p.place_id, p.name, p.city, round(greatest(s.base - t.gate_penalty, 0), 4),
         t.range_low, t.range_high, t.safety_status, t.rank_status, t.badges, t.evidence_reviews
  from s
  join score.trust_score t on t.place_id = s.place_id and t.sub_service_code = p_sub_service
  join raw.provider p on p.place_id = s.place_id, run
  where t.scoring_run_id = run.id
  order by (t.rank_status = 'ranked') desc, (t.safety_status = 'clear') desc, greatest(s.base - t.gate_penalty, 0) desc, t.evidence_weight desc;
$$;
