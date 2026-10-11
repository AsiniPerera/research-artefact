-- Framework v5: final customer-question wording for the 25 sub-points.
-- research_meaning is not touched. Run after 09_framework_v5_migration.sql.
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
    raise exception 'expected 25 sub-points updated, got % (run 09_framework_v5_migration.sql first?)', n;
  end if;
end $$;

commit;

select code, customer_question from ref.sub_point order by sort_order;
