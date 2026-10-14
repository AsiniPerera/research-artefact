-- 09_framework_v5.sql
-- Merged from the original 09_framework_v5_migration.sql +
-- 10_framework_v5_questions.sql + 11_framework_v5_meanings.sql -- three
-- small files that only ever ran back to back, each depending on the one
-- before it, and never separately. Kept as three sections, each its own
-- transaction (its own begin/commit), in original run order; nothing in
-- any of them was reworded by merging.
--
-- Moves sub-point 5.5 to 3.5 and renames category 1, then sets the final
-- customer-question wording and research-meaning text for category 3's
-- parts. Together these are "the framework v5 migration" as a single step.

-- ============================================================
-- Section 1 -- move 5.5 to 3.5, rename category 1
-- (originally 09_framework_v5_migration.sql)
-- ============================================================

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


-- ============================================================
-- Section 2 -- final customer-question wording for all 25 sub-points
-- (originally 10_framework_v5_questions.sql; depends on section 1 above)
-- ============================================================

begin;

do $$
declare n int;
begin
  update ref.sub_point sp set customer_question = v.q
  from (values
    ('1.1', 'Is the quality of the work good?'),
    ('1.2', 'Does the result match what I asked for?'),
    ('1.3', 'Does the result last?'),
    ('2.1', 'Do they assess my needs and relevant risks first?'),
    ('2.2', 'Are they honest about what is possible?'),
    ('2.3', 'Do they explain how to care for the result?'),
    ('3.1', 'Does management respond to customer complaints?'),
    ('3.2', 'Does management address the specific concern raised?'),
    ('3.3', 'Does management take ownership of the concern?'),
    ('3.4', 'Does management follow through on improvement commitments?'),
    ('3.5', 'If something goes wrong, do they put it right?'),
    ('4.1', 'Would customers recommend the business?'),
    ('4.2', 'Do customers want to return?'),
    ('5.1', 'Are the staff friendly and respectful?'),
    ('5.2', 'Is the treatment comfortable and appropriately handled?'),
    ('5.3', 'Do staff explain things clearly?'),
    ('5.4', 'Is my appointment handled professionally?'),
    ('6.1', 'Is it worth the money?'),
    ('6.2', 'Will I pay the price I was quoted?'),
    ('6.3', 'Will they push me to buy extras?'),
    ('7.1', 'Is the premises clean?'),
    ('7.2', 'Are tools and staff hygiene practices appropriate?'),
    ('7.3', 'Are there reports of harm or unsafe practices?'),
    ('7.4', 'Are products appropriate and in good condition?'),
    ('7.5', 'Are the facilities comfortable and suitable?')
  ) as v(code, q)
  where sp.code = v.code;
  get diagnostics n = row_count;
  if n <> 25 then
    raise exception 'expected 25 sub-points updated, got % (run section 1 above first?)', n;
  end if;
end $$;

commit;

select code, customer_question from ref.sub_point order by sort_order;


-- ============================================================
-- Section 3 -- research-meaning text for 3.1, 3.4, 3.5
-- (originally 11_framework_v5_meanings.sql; depends on section 1 above)
-- ============================================================

begin;

do $$
declare n int;
begin
  update ref.sub_point sp set research_meaning = v.m
  from (values
    ('3.1', 'Reply coverage on complaints'),
    ('3.4', 'Corrective commitment, tagged with the issue, and its fulfilment'),
    ('3.5', 'Service recovery by the business, and who bore the cost')
  ) as v(code, m)
  where sp.code = v.code;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'expected 3 sub-points updated, got %', n;
  end if;
end $$;

commit;

select code, research_meaning from ref.sub_point where code in ('3.1', '3.4', '3.5') order by sort_order;
