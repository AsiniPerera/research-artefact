-- Reference data: taxonomy v9 (5 / 17 / 51) and framework v5 (7 + Overall / 25 + overall)
begin;
insert into ref.service_category (code, name, sort_order) values ('HR', 'Hair', 1);
insert into ref.service (code, category_code, name, sort_order) values ('HR.CUT', 'HR', 'Haircuts', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CUT.01', 'HR.CUT', 'Haircut & Trim', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CUT.02', 'HR.CUT', 'Style Cut & Restyling', 2);
insert into ref.service (code, category_code, name, sort_order) values ('HR.COL', 'HR', 'Hair Colour', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.COL.01', 'HR.COL', 'Global Colour & Root Touch-up', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.COL.02', 'HR.COL', 'Highlights, Balayage & Ombre', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.COL.03', 'HR.COL', 'Bleach & Fashion Colour', 3);
insert into ref.service (code, category_code, name, sort_order) values ('HR.CHEM', 'HR', 'Chemical Hair Treatments', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CHEM.01', 'HR.CHEM', 'Rebonding', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CHEM.02', 'HR.CHEM', 'Keratin & Smoothening', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CHEM.03', 'HR.CHEM', 'Perming & Texturizing', 3);
insert into ref.service (code, category_code, name, sort_order) values ('HR.TRT', 'HR', 'Hair & Scalp Treatments', 4);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.TRT.01', 'HR.TRT', 'Hair Spa & Deep Conditioning', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.TRT.02', 'HR.TRT', 'Scalp Care (Dandruff & Hair Fall)', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.TRT.03', 'HR.TRT', 'Protein, Botox & Oil Treatments', 3);
insert into ref.service (code, category_code, name, sort_order) values ('HR.STY', 'HR', 'Hair Styling', 5);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.01', 'HR.STY', 'Wash & Blow Dry', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.02', 'HR.STY', 'Temporary Straightening / Curling', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.03', 'HR.STY', 'Event & Party Hairstyle', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.04', 'HR.STY', 'Hair Extensions, Wigs & Systems', 4);
insert into ref.service_category (code, name, sort_order) values ('SK', 'Skin & Beauty', 2);
insert into ref.service (code, category_code, name, sort_order) values ('SK.FAC', 'SK', 'Facials', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.01', 'SK.FAC', 'Basic Clean-up & Express Facial', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.02', 'SK.FAC', 'Deep Cleansing & Anti-Aging Facial', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.03', 'SK.FAC', 'Brightening & De-Tan Facial', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.04', 'SK.FAC', 'Advanced Hydra & Oxygen Facial', 4);
insert into ref.service (code, category_code, name, sort_order) values ('SK.TRT', 'SK', 'Skin Treatments', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.TRT.01', 'SK.TRT', 'Targeted Acne & Pigmentation Care', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.TRT.02', 'SK.TRT', 'De-Tan Body & Face Care', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.TRT.03', 'SK.TRT', 'Chemical Peels', 3);
insert into ref.service (code, category_code, name, sort_order) values ('SK.BL', 'SK', 'Brows & Lashes', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.BL.01', 'SK.BL', 'Eyebrow Threading, Lamination & Tint', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.BL.02', 'SK.BL', 'Eyelash Extensions & Lash Lift', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.BL.03', 'SK.BL', 'Microblading & Micro-pigmentation', 3);
insert into ref.service (code, category_code, name, sort_order) values ('SK.HX', 'SK', 'Hair Removal & Lightening', 4);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.01', 'SK.HX', 'Facial Threading & Waxing', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.02', 'SK.HX', 'Arms, Legs & Underarm Waxing', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.03', 'SK.HX', 'Full Body Waxing & Bikini Care', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.04', 'SK.HX', 'Face & Body Bleaching', 4);
insert into ref.service_category (code, name, sort_order) values ('NL', 'Nail Care', 3);
insert into ref.service (code, category_code, name, sort_order) values ('NL.CARE', 'NL', 'Nail Care', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.CARE.01', 'NL.CARE', 'Manicure & Pedicure', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.CARE.02', 'NL.CARE', 'Foot Spa & Intensive Heel Care', 2);
insert into ref.service (code, category_code, name, sort_order) values ('NL.POL', 'NL', 'Nail Polish', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.POL.01', 'NL.POL', 'Classic & Gel Nail Polish Application', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.POL.02', 'NL.POL', 'Gel / Acrylic Polish Removal', 2);
insert into ref.service (code, category_code, name, sort_order) values ('NL.EXT', 'NL', 'Extensions & Nail Art', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.EXT.01', 'NL.EXT', 'Acrylic & Gel Nail Extensions', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.EXT.02', 'NL.EXT', 'Extension Refill & Custom Nail Art', 2);
insert into ref.service_category (code, name, sort_order) values ('BO', 'Wedding, Events & Occasions', 4);
insert into ref.service (code, category_code, name, sort_order) values ('BO.BRIDAL', 'BO', 'Bridal Services', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.01', 'BO.BRIDAL', 'Bridal Trial & Consultation', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.02', 'BO.BRIDAL', 'Wedding Day Bridal Makeup & Hair', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.03', 'BO.BRIDAL', 'Homecoming & Engagement Makeup', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.04', 'BO.BRIDAL', 'Bridal Party & Photoshoot Makeup', 4);
insert into ref.service (code, category_code, name, sort_order) values ('BO.GROOM', 'BO', 'Groom Services', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.GROOM.01', 'BO.GROOM', 'Wedding Day Groom Dressing & Hair', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.GROOM.02', 'BO.GROOM', 'Nilame & Traditional Kandyan Dressing', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.GROOM.03', 'BO.GROOM', 'Homecoming Groom Styling', 3);
insert into ref.service (code, category_code, name, sort_order) values ('BO.DRAPE', 'BO', 'Draping & Dressing', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.DRAPE.01', 'BO.DRAPE', 'Saree & Kandyan Osariya Draping', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.DRAPE.02', 'BO.DRAPE', 'Jewellery & Ornament Setting', 2);
insert into ref.service (code, category_code, name, sort_order) values ('BO.OCC', 'BO', 'Events & Occasion Services', 4);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.OCC.01', 'BO.OCC', 'Party, Birthday & Event Makeup', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.OCC.02', 'BO.OCC', 'HD & Commercial Photoshoot Makeup', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.OCC.03', 'BO.OCC', 'Mehendi / Henna Application', 3);
insert into ref.service_category (code, name, sort_order) values ('MG', 'Gents'' Grooming', 5);
insert into ref.service (code, category_code, name, sort_order) values ('MG.BEARD', 'MG', 'Beard & Shave', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.01', 'MG.BEARD', 'Beard Trim & Line Up', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.02', 'MG.BEARD', 'Clean Shave', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.03', 'MG.BEARD', 'Hot Towel Shave', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.04', 'MG.BEARD', 'Beard Colouring', 4);
-- ---------- Framework v5: 7 weighted categories + Overall Verdict ----------
-- 25 sub-points plus `overall`. Replaces the retired ten-category / 38-sub-point
-- framework.
--
-- Category 8 (Overall Verdict) is REPORTED ONLY: weight 0, is_score false. It is
-- excluded from the weighted mean and from the user's weights vector, which is
-- therefore SEVEN numbers, not eight. It is still stored and shown, because a
-- generic verdict on a salon is the commonest thing a review says - but it
-- summarises the other seven and would double-count if scored beside them.
--
-- v5 has no gates and no vetoes. The machinery stays in the schema and in
-- 06_run_scoring.py and is driven entirely off is_gate / is_veto, so marking a
-- sub-point here is all it takes to bring it back. Safety is carried by is_safety
-- on 7.1-7.3, and 3.1 is the only computed sub-point (it comes from owner replies,
-- not from review text).

insert into ref.framework_category (category_no, name, weight) values (1, 'Quality of the Result', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('1.1', 1, 1, 'Is the quality of the work good?', 'Overall verdict on a named service; technical execution quality', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('1.2', 1, 2, 'Does the result match what I asked for?', 'Request-outcome match', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('1.3', 1, 3, 'Does the result last?', 'Longevity against expectation; early fading or chipping', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (2, 'Consultation, Care & Aftercare', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('2.1', 2, 4, 'Do they assess my needs and relevant risks first?', 'Pre-service consultation; patch or strand test', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('2.2', 2, 5, 'Are they honest about what is possible?', 'Feasibility setting, risk disclosure, refusal and honest referral', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('2.3', 2, 6, 'Do they explain how to care for the result?', 'Aftercare instruction', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (3, 'Management Responsiveness & Continuous Improvement', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.1', 3, 7, 'Does management respond to customer complaints?', 'Reply coverage on complaints', true, false, false, false, false, true);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.2', 3, 8, 'Does management address the specific concern raised?', 'Reply specificity', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.3', 3, 9, 'Does management take ownership of the concern?', 'Responsibility stance and remedy', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.4', 3, 10, 'Does management follow through on improvement commitments?', 'Corrective commitment, tagged with the issue, and its fulfilment', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.5', 3, 11, 'If something goes wrong, do they put it right?', 'Service recovery by the business, and who bore the cost', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (4, 'Customer Trust & Recommendation', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('4.1', 4, 12, 'Would customers recommend the business?', 'Explicit recommendation and referral behaviour', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('4.2', 4, 13, 'Do customers want to return?', 'Return intent and self-declared repeat visits', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (5, 'Staff & Customer Service', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.1', 5, 14, 'Are the staff friendly and respectful?', 'Courtesy, respect and attentiveness', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.2', 5, 15, 'Is the treatment comfortable and appropriately handled?', 'Pain and comfort during a treatment', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.3', 5, 16, 'Do staff explain things clearly?', 'Explanation during service and language accommodation', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.4', 5, 17, 'Is my appointment handled professionally?', 'Appointment reliability and unannounced substitution', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (6, 'Value & Price Honesty', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('6.1', 6, 18, 'Is it worth the money?', 'Value judgement', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('6.2', 6, 19, 'Will I pay the price I was quoted?', 'Quote accuracy and undisclosed charges', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('6.3', 6, 20, 'Will they push me to buy extras?', 'Sales pressure', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (7, 'Safety, Hygiene & Facilities', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.1', 7, 21, 'Is the premises clean?', 'Premises cleanliness', true, false, false, true, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.2', 7, 22, 'Are tools and staff hygiene practices appropriate?', 'Tool hygiene, sterilisation practice and staff hygiene', true, false, false, true, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.3', 7, 23, 'Are there reports of harm or unsafe practices?', 'Adverse reaction, injury, delayed-onset damage, unsafe practice', true, false, false, true, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.4', 7, 24, 'Are products appropriate and in good condition?', 'Product authenticity and quality', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.5', 7, 25, 'Are the facilities comfortable and suitable?', 'Ambience and facilities', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (8, 'Overall Verdict', 0.00000);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('overall', 8, 0, 'Generic verdict on the salon', 'Overall sentiment without specific quality dimension', false, false, false, false, true, false);

-- ---------- Extraction runs ----------
-- Runs 1-3 are kept for the audit trail. All of their rows were replaced by run 4,
-- so every one of the 44,526 live evidence rows belongs to run 4.
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (1, 'rule_based', 'keyword patterns + VADER lexicon (extended)', 'final-38 (frozen 2026-10-04)', 'v9', 'Baseline first pass against the retired ten-category framework. Spot-check precision about 85% on 60 rows; recall not measured. Superseded by run 4; no rows remain.');
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (2, 'manual', 'read and labelled directly by Claude in chat', 'final-38 (frozen 2026-10-04)', 'v9', 'Covered the 157 reviews written in Sinhala, Singlish, mixed Sinhala-English or Tamil, against the retired ten-category framework. Superseded by run 4; no rows remain.');
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (3, 'rule_based', 'keyword auto-coding; 150 rows read and labelled by Claude (batch_001)', 'v4 draft (7 categories, 25 sub-points, 2026-10-08)', 'v9', 'First pass on the v4 framework, loaded from evidence_cleaned. Auto-coded rows not re-read. Superseded by run 4; no rows remain.');
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (4, 'rule_based', null, 'v4', 'v9', 'Auto-coded by Python keyword engine - 44,526 evidence items from 18,881 reviews across 454 salons. The live run.');
select setval(pg_get_serial_sequence('extract.extraction_run','run_id'), 4);
commit;
