-- Drop "iLab", "Lab" and "MM Lab" from bank titles and session names.
-- Only display names change: qbanks.title (10 banks) and case_objectives.session_title
-- (27 sessions, 289 objective rows). Slugs (web addresses and picture folders) stay
-- the same, and attempts, answers and progress link by id, so no student data changes.
-- Checks every count first and stops without changing anything if one is off.
-- Safe to re-run (a name already renamed is skipped). Re-running tools/case_map.py's sessions SQL
-- puts the spreadsheet names back: run migration_033.sql and then this file again after it.

begin;

create temp table bank_renames (slug text, old_title text, new_title text) on commit drop;
insert into bank_renames values
    ('case-11-gait-mm-lab-practice-questions', 'Case 11 - Gait MM Lab Practice Questions', 'Case 11 - Gait Practice Questions'),
    ('case-11-intro-to-office-based-diagnostics-ilab-practice-questions', 'Case 11 - Intro to Office Based Diagnostics iLab Practice Questions', 'Case 11 - Intro to Office Based Diagnostics Practice Questions'),
    ('case-11-lower-limb-synthesis-and-integration-with-ultrasound-mm-lab-practice-questions', 'Case 11 - Lower Limb Synthesis and Integration with Ultrasound MM Lab Practice Questions', 'Case 11 - Lower Limb Synthesis and Integration with Ultrasound Practice Questions'),
    ('case-11-renal-structure-and-function-ilab-practice-questions', 'Case 11 - Renal Structure and Function iLab Practice Questions', 'Case 11 - Renal Structure and Function Practice Questions'),
    ('case-12-male-reproductive-structure-and-function-ilab-practice-questions', 'Case 12 - Male Reproductive Structure and Function iLab Practice Questions', 'Case 12 - Male Reproductive Structure and Function Practice Questions'),
    ('case-12-substance-use-disorders-ilab-practice-questions', 'Case 12 - Substance Use Disorders iLab Practice Questions', 'Case 12 - Substance Use Disorders Practice Questions'),
    ('case-13-contraception-and-fertility-awareness-ilab-practice-questions', 'Case 13 - Contraception and Fertility Awareness iLab Practice Questions', 'Case 13 - Contraception and Fertility Awareness Practice Questions'),
    ('case-13-female-reproductive-structure-and-function-ilab-practice-questions', 'Case 13 - Female Reproductive Structure and Function iLab Practice Questions', 'Case 13 - Female Reproductive Structure and Function Practice Questions'),
    ('case-13-introduction-to-motivational-interviewing-lab-practice-questions', 'Case 13 - Introduction to Motivational Interviewing Lab Practice Questions', 'Case 13 - Introduction to Motivational Interviewing Practice Questions'),
    ('case-6-cs-heent-neck-and-integument-exam-lab-practice-questions', 'Case 6 - CS HEENT, Neck, and Integument Exam Lab Practice Questions', 'Case 6 - CS HEENT, Neck, and Integument Exam Practice Questions');

create temp table session_renames (case_number int, old_title text, new_title text, expected int) on commit drop;
insert into session_renames values
    (3, 'Embryogenesis iLab', 'Embryogenesis', 20),
    (3, 'Large Group Post Exam Reflection iLab and Content Exam 1 Review Session', 'Large Group Post Exam Reflection and Content Exam 1 Review Session', 7),
    (3, 'Scapular Region, Posterior Compartment of Arm MM lab', 'Scapular Region, Posterior Compartment of Arm', 10),
    (3, 'Skin Upper Limb, Pectoral Region MM Lab', 'Skin Upper Limb, Pectoral Region', 9),
    (4, 'Axilla, Brachial Plexus MM Lab', 'Axilla, Brachial Plexus', 7),
    (4, 'Bone and Cartilage Structure and Function iLab', 'Bone and Cartilage Structure and Function', 13),
    (4, 'Brachial Plexus, Anterior Compartment of Arm, Cubital Fossa MM Lab', 'Brachial Plexus, Anterior Compartment of Arm, Cubital Fossa', 10),
    (4, 'CS Constructing the Subjective History Interview iLab', 'CS Constructing the Subjective History Interview', 5),
    (4, 'CS Introduction to Physical Examination Lab', 'CS Introduction to Physical Examination', 10),
    (4, 'Metabolism and Energy Generation and Utilization iLab', 'Metabolism and Energy Generation and Utilization', 10),
    (4, 'Muscle Tissue Structure and Function iLab', 'Muscle Tissue Structure and Function', 16),
    (5, 'CS Well Subjective History Lab  [SP RP]', 'CS Well Subjective History [SP RP]', 5),
    (5, 'Flexor region of the Forearm MM Lab', 'Flexor region of the Forearm', 10),
    (5, 'Gastrointestinal Structure and Function iLab', 'Gastrointestinal Structure and Function', 19),
    (6, 'CS HEENT, Neck, and Integument Exam Lab', 'CS HEENT, Neck, and Integument Exam', 9),
    (7, 'CS Midterm Review iLab', 'CS Midterm Review', 1),
    (10, 'CS Physical Exam Check off and SP Encounter Lab [SP RP]', 'CS Physical Exam Check off and SP Encounter [SP RP]', 4),
    (11, 'Gait MM Lab', 'Gait', 10),
    (11, 'Intro to Office Based Diagnostics iLab', 'Intro to Office Based Diagnostics', 19),
    (11, 'Lower Limb Synthesis and Integration with Ultrasound MM Lab', 'Lower Limb Synthesis and Integration with Ultrasound', 8),
    (11, 'Renal Structure and Function iLab', 'Renal Structure and Function', 24),
    (12, 'Male Reproductive Structure and Function iLab', 'Male Reproductive Structure and Function', 20),
    (12, 'Substance Use Disorders iLab', 'Substance Use Disorders', 12),
    (13, 'CS Professional Navigation of Patient Interactions iLab', 'CS Professional Navigation of Patient Interactions', 3),
    (13, 'Contraception and Fertility Awareness iLab', 'Contraception and Fertility Awareness', 7),
    (13, 'Female Reproductive Structure and Function iLab', 'Female Reproductive Structure and Function', 16),
    (13, 'Introduction to Motivational Interviewing Lab', 'Introduction to Motivational Interviewing', 5);

do $$
declare r record; n int;
begin
  for r in select * from bank_renames loop
    select count(*) into n from qbanks where slug = r.slug and title = r.old_title;
    if n = 0 and not exists (select 1 from qbanks where slug = r.slug and title = r.new_title) then
      raise exception 'Bank "%" not found under either name. Nothing was changed.', r.slug;
    end if;
    if exists (select 1 from qbanks where title = r.new_title and slug <> r.slug) then
      raise exception 'Another bank is already called "%". Nothing was changed.', r.new_title;
    end if;
  end loop;
  for r in select * from session_renames loop
    select count(*) into n from case_objectives
     where case_number = r.case_number and session_title = r.old_title;
    if n not in (0, r.expected) then
      raise exception 'Case %, "%": expected % objectives, found %. Nothing was changed.',
        r.case_number, r.old_title, r.expected, n;
    end if;
    if exists (select 1 from case_objectives where case_number = r.case_number and session_title = r.new_title)
       and n > 0 then
      raise exception 'Case % already has a session called "%". Nothing was changed.', r.case_number, r.new_title;
    end if;
  end loop;
end $$;

update qbanks b
   set title = r.new_title
  from bank_renames r
 where b.slug = r.slug and b.title = r.old_title;

update case_objectives co
   set session_title = r.new_title
  from session_renames r
 where co.case_number = r.case_number and co.session_title = r.old_title;

-- what is left with the words (expect no rows)
select 'bank' as kind, title from qbanks where title ~* '\m(mm\s+)?i?lab\M'
union all
select distinct 'session', session_title from case_objectives where session_title ~* '\m(mm\s+)?i?lab\M';

commit;
