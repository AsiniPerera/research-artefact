-- 20_orphaned_tables_dropped.sql
-- Drops two tables left over from an earlier version of the pipeline, with
-- nothing in the current codebase reading or writing either one.
--
-- extract.temp_import (34,289 rows): an older staging shape for evidence
-- items -- its sub_point_code is double precision, where the live
-- extract.evidence_item uses text. Not created or touched by
-- 03_load_data.py or any other file on disk today.
--
-- ref.provider_city (548 rows): place_id, city, method, nearest_km --
-- reads as a geocoding/nearest-city derivation step from before provider.csv
-- carried city directly. No view, foreign key, or function in score, ref,
-- extract, raw or public references either table (checked via
-- information_schema and pg_proc across all four schemas before writing
-- this file).
--
-- Not safe to re-run as written (`drop table` without `if exists` fails the
-- second time); that is intentional here; a migration dropping a table that
-- is already gone should say so loudly, not silently succeed.

begin;

drop table extract.temp_import;
drop table ref.provider_city;

-- Expect: both names absent, 0 rows.
select table_schema, table_name
  from information_schema.tables
 where (table_schema, table_name) in (('extract', 'temp_import'), ('ref', 'provider_city'));

commit;
