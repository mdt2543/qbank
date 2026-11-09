-- Performance page: rename each session so it matches the title of its bank on the site
-- (the bank title without "Case N - " and " Practice Questions"). Case 11's three Intro to Office
-- Based Diagnostics sessions share one bank, so they become one session with that bank's name.
-- Sessions with no bank (Small Group, cases 3-6, review/check-off labs) keep their names.
-- Only renames case_objectives.session_title; no answers or scores change.
-- Checks each count before renaming and stops without changing anything if one is off.
-- Safe to re-run (a session already renamed is skipped). Re-running tools/case_map.py's
-- sessions SQL puts the spreadsheet names back, so run this again after it.

begin;

create temp table session_renames (case_number int, old_title text, new_title text, expected int) on commit drop;
insert into session_renames values
    (7, 'Adaptive Immunity iLab', 'Adaptive Immunity', 20),
    (7, 'Blood and Hematopoiesis iLab', 'Blood and Hematopoiesis', 10),
    (7, 'CS Cardiovascular and Respiratory Exam Lab', 'Cardiovascular and Respiratory Physical Exam', 10),
    (7, 'Cardiovascular Histology iLab', 'Cardiovascular Histology', 9),
    (7, 'Circulation Function iLab', 'Circulation Function', 24),
    (7, 'Extensor Region of the Forearm, Dorsum of the Hand, Joints of Upper Limb MM Lab', 'Extensor Forearm, Dorsum of the Hand and Upper Limb Joints', 8),
    (7, 'Heart Function iLab', 'Heart Function', 16),
    (7, 'Innate Immunity iLab', 'Innate Immunity', 21),
    (7, 'Introduction to Indirect OMT 1', 'Indirect OMT 1', 6),
    (7, 'Upper Limb Synthesis & Integration with Ultrasound MM Lab', 'Upper Limb Synthesis and Ultrasound', 10),
    (7, 'Well Child Patient Encounter', 'Well Child Visit', 22),
    (8, 'Anterior Thigh, Lumbosacral Plexus, & Posterior Abdominal Wall MM Lab', 'Anterior Thigh, Lumbosacral Plexus and Posterior Abdominal Wall', 15),
    (8, 'Communicating with an Adolescent: Consent, Confidentiality, and Sexuality iLab', 'Communicating with an Adolescent - Consent, Confidentiality, and Sexuality', 11),
    (8, 'Femoral Triangle, Medial Thigh, Hip Joint MM Lab', 'Femoral Triangle, Medial Thigh and Hip Joint', 11),
    (8, 'Prevention, Screening and Pathogenesis of Bacterial and Viral Infections iLab', 'Prevention, Screening and Pathogenesis of Bacterial and Viral Infections', 11),
    (9, 'Gluteal Region, Posterior Thigh, Hip Joint MM Lab', 'Gluteal Region, Posterior Thigh and Hip Joint', 8),
    (9, 'Introduction to Regional & Local Segmental Diagnosis: Rib Cage', 'Introduction to Regional and Local Segmental Diagnosis - Rib Cage', 7),
    (9, 'Lateral Compartment of Leg, Anterior Compartment of Leg, Knee Joint MM Lab', 'Lateral and Anterior Leg and Knee Joint', 10),
    (9, 'Natural History of Disease and Public Health Outcomes iLab', 'Natural History of Disease and Public Health Outcomes', 6),
    (9, 'Pharmacokinetics iLab', 'Pharmacokinetics', 8),
    (9, 'Popliteal Fossa, Posterior Compartment of Leg MM Lab', 'Popliteal Fossa and Posterior Leg', 9),
    (9, 'Refining Medical History iLab', 'Refining Medical History', 6),
    (9, 'Trauma Informed Patient Care iLab', 'Trauma Informed Patient Care', 7),
    (10, 'Clinical Prevention and Public Health in the Geriatric Population iLab', 'Clinical Prevention and Public Health in the Geriatric Population', 4),
    (10, 'Introduction to Regional & Local Segmental Diagnosis: Pelvis', 'Introduction to Regional and Local Segmental Diagnosis - Pelvis', 3),
    (10, 'Sole of Foot, Ankle 2 MM Lab', 'Sole of the Foot and Ankle 2', 7),
    (10, 'Sole of foot, Ankle 1 MM Lab', 'Sole of the Foot and Ankle 1', 8),
    (11, 'Blood and Urine Tests (Intro to Office Based Diagnostics) iLab', 'Intro to Office Based Diagnostics iLab', 4),
    (11, 'ECGs (Intro to Office Based Diagnostics) iLab', 'Intro to Office Based Diagnostics iLab', 12),
    (11, 'Introduction to Segmental Diagnosis: Sacrum', 'Introduction to Segmental Diagnosis - Sacrum', 5),
    (11, 'Lower Limb Synthesis & Integration with Ultrasound MM Lab', 'Lower Limb Synthesis and Integration with Ultrasound MM Lab', 8),
    (11, 'Spirometry (Intro to Office Based Diagnostics) iLab', 'Intro to Office Based Diagnostics iLab', 3);

do $$
declare r record; n int;
begin
  for r in select * from session_renames loop
    select count(*) into n from case_objectives
     where case_number = r.case_number and session_title = r.old_title;
    if n not in (0, r.expected) then
      raise exception 'Case %, "%": expected % objectives, found %. Nothing was changed.',
        r.case_number, r.old_title, r.expected, n;
    end if;
  end loop;
end $$;

update case_objectives co
   set session_title = r.new_title
  from session_renames r
 where co.case_number = r.case_number and co.session_title = r.old_title;

commit;
