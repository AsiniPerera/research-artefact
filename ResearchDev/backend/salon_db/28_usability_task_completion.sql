-- 28_usability_task_completion.sql
-- Records which of the five evaluation tasks (T-1 to T-5) a participant was
-- able to finish unaided, so the evaluation chapter can report
-- "participants completing all five tasks unaided" and "the task completed by
-- the fewest participants" from the data rather than from an inference.
--
-- 27_usability_survey.sql stored the ten SUS items (q4-q13) and the five
-- task-specific Likert items (q14-q18). Those record how a participant FELT
-- about a feature -- "Setting my priority levels was clear and easy" -- not
-- whether they actually completed the task. Reading a Likert score of 4 or 5
-- as "completed" is an assumption the data does not carry, and it would be the
-- weakest line in the evaluation. Asking directly is one checkbox per task.
--
-- Nullable, with no default. A response submitted before this migration
-- genuinely has no answer, and null says exactly that instead of claiming a
-- false. The chat survey sends all five on every submission, so rows written
-- after this migration are never null.
--
-- The five columns are deliberately separate booleans rather than one array or
-- a count: Table 5.6 needs a per-task figure, and a per-task column is what
-- `count(*) filter (where ...)` reads directly.
--
-- Safe to re-run: the guard below makes a second run a no-op.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usability_responses'
      and column_name = 'task1_completed'
  ) then
    alter table public.usability_responses
      add column task1_completed boolean,
      add column task2_completed boolean,
      add column task3_completed boolean,
      add column task4_completed boolean,
      add column task5_completed boolean;
  end if;
end $$;

comment on column public.usability_responses.task1_completed is
  'T-1 Find businesses that offer a specific beauty service the participant chose';
comment on column public.usability_responses.task2_completed is
  'T-2 Tell the platform which qualities matter most to them';
comment on column public.usability_responses.task3_completed is
  'T-3 Identify which business is placed first, and say why';
comment on column public.usability_responses.task4_completed is
  'T-4 Find what customers have said about one quality of that business';
comment on column public.usability_responses.task5_completed is
  'T-5 Find how that business responds to complaints, and whether a staff member is named';

-- Expect: five rows, data_type boolean, is_nullable YES.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'usability_responses'
   and column_name like 'task%\_completed'
 order by column_name;

commit;

-- For Table 5.6, after responses are collected:
--
--   select count(*) as participants,
--          count(*) filter (where task1_completed and task2_completed
--                             and task3_completed and task4_completed
--                             and task5_completed) as all_five_unaided,
--          count(*) filter (where task1_completed) as t1_find_service,
--          count(*) filter (where task2_completed) as t2_set_priorities,
--          count(*) filter (where task3_completed) as t3_explain_first,
--          count(*) filter (where task4_completed) as t4_read_evidence,
--          count(*) filter (where task5_completed) as t5_complaints_staff
--     from public.usability_responses;
--
-- Rows written before this migration are null on all five and are excluded by
-- every `filter (where ...)` above, so report the completion figures against
-- `count(*) filter (where task1_completed is not null)` rather than against
-- every stored response.
