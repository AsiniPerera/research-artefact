-- Framework v5: research meaning for 3.1, 3.4 and 3.5, as in section 3 of the specification.
-- Run after 09_framework_v5_migration.sql.
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
