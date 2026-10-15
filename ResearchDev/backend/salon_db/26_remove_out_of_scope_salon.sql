-- 26_remove_out_of_scope_salon.sql
-- Removes one salon that is outside the study's scope, with everything that
-- hangs off it.
--
--   place_id  ChIJ7xITLwBR4joRWPLdpEsOa-8
--   name      phoenix salon dreads & tattoos   (Hokandara; a dreads and tattoo
--                                                studio, not one of the five
--                                                service families)
--
-- What it held when this was written: 1 provider row, 2 reviews, 1 evidence item,
-- 1 review assessment, 1 ref.provider_city row, 7 provider_safety rows (one per
-- scoring run), and 1 staging.review_assessment row. It was not scored for any
-- service, so no ranking changes.
--
-- Children are deleted before parents, so no foreign key is ever violated. The
-- review ids are collected into a temporary table first, because raw.review is
-- deleted late and the other tables key on review_id. Every table that can hold
-- this salon is listed, including ones that happen to be empty for it today, so
-- the file stays correct if that changes.
--
-- Run it as one transaction. The two checks at the end must read 0; if either
-- does not, run `rollback;` instead of `commit;`.
--
-- Safe to re-run: once the salon is gone every delete matches nothing.
--
-- Not changed here: the seed CSVs in data/ (provider.csv, review.csv, ...) still
-- contain this salon, so re-running 03_load_data.py would load it back; run this
-- migration again afterwards, or remove its rows from those files.

begin;

-- How much there is to remove (expect: provider 1, reviews 2).
select (select count(*) from raw.provider where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8') as provider_rows,
       (select count(*) from raw.review   where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8') as review_rows;

create temp table _gone_reviews on commit drop as
  select review_id from raw.review where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';

-- keyed on review_id
delete from score.commitment_outcome      where review_id in (select review_id from _gone_reviews);
delete from extract.gold_label            where review_id in (select review_id from _gone_reviews);
delete from extract.reply_assessment      where review_id in (select review_id from _gone_reviews);
delete from extract.review_assessment     where review_id in (select review_id from _gone_reviews);
delete from staging.reply_assessment      where review_id in (select review_id from _gone_reviews);
delete from staging.review_assessment     where review_id in (select review_id from _gone_reviews);
delete from raw.owner_reply               where review_id in (select review_id from _gone_reviews);

-- keyed on place_id (and review_id)
delete from extract.evidence_item         where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8'
                                             or review_id in (select review_id from _gone_reviews);
delete from extract.temp_import           where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8'
                                             or review_id in (select review_id from _gone_reviews);
delete from staging.evidence_item         where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8'
                                             or review_id in (select review_id from _gone_reviews);

-- scores
delete from score.category9_window        where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';
delete from score.category_score          where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';
delete from score.trust_score             where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';
delete from score.gate_veto_status        where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';
delete from score.provider_safety         where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';

-- the reviews, then the salon
delete from raw.removed_duplicate_review  where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';
delete from raw.review                    where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';
delete from ref.provider_city             where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';
delete from raw.provider                  where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8';

-- Check 1: the salon and its reviews are gone (expect 0 and 0).
select (select count(*) from raw.provider where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8') as provider_left,
       (select count(*) from raw.review   where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8') as reviews_left;

-- Check 2: nothing else still points at it (expect 0).
select (select count(*) from extract.evidence_item  where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8')
     + (select count(*) from score.provider_safety  where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8')
     + (select count(*) from score.trust_score      where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8')
     + (select count(*) from score.category_score   where place_id = 'ChIJ7xITLwBR4joRWPLdpEsOa-8') as other_rows_left;

-- Expect 548 salons remain (549 before).
select count(*) as salons_remaining from raw.provider;

commit;
