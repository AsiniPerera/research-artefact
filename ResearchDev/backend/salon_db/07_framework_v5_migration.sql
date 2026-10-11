-- Framework v5: sub-point 5.5 becomes 3.5; category 1 renamed.
-- Run in the Supabase SQL Editor. Everything up to COMMIT is one transaction.
begin;

do $$
declare s34 int; s55 int;
begin
  select sort_order into strict s34 from ref.sub_point where code = '3.4';
  select sort_order into strict s55 from ref.sub_point where code = '5.5';
  if s55 <= s34 then
    raise exception '5.5 (sort_order %) is not after 3.4 (sort_order %)', s55, s34;
  end if;

  -- Park 5.5 and the rows between, then bring the in-between rows back one place down.
  update ref.sub_point set sort_order = -1 where code = '5.5';
  update ref.sub_point set sort_order = sort_order + 100000 where sort_order > s34 and sort_order < s55;
  update ref.sub_point set sort_order = sort_order - 100000 + 1 where sort_order > 100000;

  insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning,
                             is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed)
  select '3.5', 3, s34 + 1, customer_question, research_meaning,
         is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed
  from ref.sub_point where code = '5.5';
end $$;

-- Re-code every base table that stores a sub-point code.
do $$
declare t record;
begin
  for t in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.column_name = 'sub_point_code'
      and c.table_schema in ('extract', 'staging', 'score')
      and tb.table_type = 'BASE TABLE'
  loop
    execute format('update %I.%I set sub_point_code = %L where sub_point_code = %L',
                   t.table_schema, t.table_name, '3.5', '5.5');
    raise notice 'updated %.%', t.table_schema, t.table_name;
  end loop;
end $$;

delete from ref.sub_point where code = '5.5';

update ref.framework_category set name = 'Quality of the Result' where category_no = 1;

-- 3.4 also records 'no clear change'. The check was declared inline, so look up its real name.
do $$
declare con text;
begin
  select conname into strict con
  from pg_constraint
  where conrelid = 'score.commitment_outcome'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%outcome%';
  execute format('alter table score.commitment_outcome drop constraint %I', con);
  alter table score.commitment_outcome add constraint commitment_outcome_outcome_check
    check (outcome in ('kept', 'broken', 'no clear change', 'not testable'));
end $$;

-- Abort the whole migration if the move did not take.
do $$
begin
  if exists (select 1 from extract.evidence_item where sub_point_code = '5.5') then
    raise exception 'extract.evidence_item still has rows coded 5.5';
  end if;
  if (select count(*) from ref.sub_point where code = '3.5') <> 1 then
    raise exception 'ref.sub_point does not have exactly one 3.5 row';
  end if;
end $$;

commit;

-- Expect 3, 3, 5, 2, 4, 3, 5 for categories 1-7.
select category_no, count(*) as sub_points
from ref.sub_point where code <> 'overall'
group by category_no order by category_no;

select count(*) as evidence_rows_3_5 from extract.evidence_item where sub_point_code = '3.5';
