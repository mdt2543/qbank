// Starting versions of the CTAC reference notes, one per patient. The owner edits and saves each
// on /ctac/reference; once saved, the database copy (ctac_reference_notes, same id) is used.
// Real birthdays, ages as of the 11/17/2026 sign-off; every other history detail is made up and
// kept unremarkable on purpose.

import type { Section } from "@/lib/ctac";

export type NoteTexts = Record<Section, string>;

const STILL: NoteTexts = {
  subjective: `A.T. Still is a 198 y/o male presenting today for AWV.
DOB: 08/06/1828
CC: AWV

HPI
Last seen 1 year ago for AWV, normal screenings and labs at that time.
Reports he is in good overall health since his last visit.
Denies new complaints/concerns today.

PMHx
Medical Hx – Denies chronic medical conditions. Denies significant medical events such as MI or CVA.
Surgeries – Denies Hx surgery
Hospitalizations – Denies Hx hospitalizations.
Injuries – Denies Hx fractures or significant injuries.

Health Maintenance
Immunizations – Childhood series complete; Tdap in 2022; shingles and pneumococcal vaccines complete; due for annual flu vaccine and COVID booster.
Screenings – Lipid panel and A1c 1 year ago, normal; colonoscopy and AAA screening previously completed, normal.

Medications
Rx – none
OTC – none
Supplements – none

Allergies
Food – no food allergies
Environmental – no seasonal or environmental allergies
Medications – NKDA

FHx
Siblings – 2 brothers, alive and well; 1 sister with HTN, controlled with medication
Children – 3 sons and 2 daughters, alive and well
M – Hypothyroidism, controlled with medication
F – HTN, controlled with medication
MGM – Deceased at age 80, cause unknown to patient / MGF – Deceased of MI at age 72
PGM – Type 2 DM, alive / PGF – Deceased of natural causes at age 87

SHx
Living Situation - Lives with his wife in Kirksville, Missouri; feels safe at home
Occupation - Works as a physician and teaches osteopathic medicine
Nutrition/Diet – 3 meals daily, mostly home-cooked, vegetables most days
Exercise – Walks 30 minutes daily
Caffeine – 1 cup of coffee daily
Tobacco/Vaping – Denies, never smoker
Alcohol – Denies alcohol use
Drugs – Denies recreational drug use

ROS
General – Denies fever, fatigue, weakness
Integument – Denies change in hair, skin, nails
H – Denies headache, injury, dizziness
E – Denies vision loss, blurry vision, diplopia
E – Denies pain, hearing loss, tinnitus
N – Denies itching, epistaxis, sinus problems
T – Denies sore throat, sore tongue, dry mouth
N – Denies pain, stiffness, swelling
CV – Denies palpitations, murmur, HTN
PV – Denies swelling of legs, calves, feet
Pulm – Denies cough, wheezing, SOB
C/B – Denies discomfort, lumps, nipple discharge
GI – Denies reflux, diarrhea, constipation
GU – Denies dysuria, hematuria, kidney stones
Sexual – Denies STI, genital sores, change in libido
MSK – Denies pain, stiffness, joint pain
Neuro – Denies syncope, seizures, numbness of extremities
Endo – Denies increased thirst, hunger, sweating
Heme – Denies easy bruising, easy bleeding, anemia
Psych – Denies nervousness, change in mood, change in memory`,
  objective: `VITALS
BP – 120/80
T – 98.4 °F
P – 72
R – 14
SpO2 – 99% on RA

PHYSICAL EXAM
General – Seated, appears comfortable and nontoxic, NAD
Integument – Skin warm and dry, nails w/o pitting, no brittle hair
H – NCAT w/o lesions
E – PERRL, EOMI, no lesions or discharge, fundoscopic exam performed, optic nerve visualized
E – Tragus nontender, EAC w/o lesion or discharge, TM gray and pale w/o perforation
N – Nares patent b/l, no epistaxis or discharge, mucosa pink
T – Pharynx w/o erythema, uvula midline, tonsils w/o exudate, oral mucosa pink and moist
N – Soft and supple, trachea midline, thyroid symmetrical w/o nodules, no adenopathy
CV – HRRR w/o m/r/g, DP and RAD pulses +2/4 b/l
Lungs – CTAB w/o w/r/r/s
Osteopathic/MSK – No identifiable cervical, lumbar, or thoracic lesions`,
  assessment: `A.T. Still is a 198 y/o male presenting today for AWV in good overall health, no acute concerns.

1. AWV, Male
2. Need for Vaccination
3. Need for Preventative Health Screening`,
  plan: `1. Doing well, continue current diet and daily walking; encouraged at least 150 minutes of moderate exercise per week. RTC in 1 year for AWV or PRN w/ new concerns.
2. Influenza vaccine and COVID booster given today; educated on common side effects.
3. Ordered CBC, CMP, lipid panel, and A1c. Will call pt w/ results.`,
  signoff: `John F. Kennedy, OMS-I, 12/24/2026 at 11:59pm`,
};

const RODRIGO: NoteTexts = {
  subjective: `Olivia Rodrigo is a 23 y/o female presenting today for AWV.
DOB: 02/20/2003
CC: AWV

HPI
Last seen 1 year ago for AWV, normal screenings and labs at that time.
Reports she is in good overall health since her last visit.
Denies new complaints/concerns today.

PMHx
Medical Hx – Denies chronic medical conditions. Denies significant medical events such as MI or CVA.
Surgeries – Denies Hx surgery
Hospitalizations – Denies Hx hospitalizations.
Injuries – Denies Hx fractures or significant injuries.

OB/Gyn Hx
Menarche – Age 12
Menses – Regular, every 28 days, lasting 5 days; FDLMP 11/03/2026
Hx Pregnancy– Denies, GOPO

Health Maintenance
Immunizations – Childhood series complete; HPV series complete; Tdap in 2021; due for annual flu vaccine and COVID booster.
Screenings – Pap smear at age 21, normal; lipid panel 1 year ago, normal.

Medications
Rx – none
OTC – none
Supplements – none

Allergies
Food – no food allergies
Environmental – no seasonal or environmental allergies
Medications – NKDA

FHx
Siblings – None
Children – None
M – Alive and well, no known medical conditions
F – Alive and well, no known medical conditions
MGM / MGF – Alive and well
PGM / PGF – Alive and well

SHx
Living Situation - Lives in Los Angeles, California; feels safe at home
Occupation - Works as a singer-songwriter
Nutrition/Diet – 3 meals daily, balanced, fruits and vegetables most days
Exercise – Runs 30 minutes 4 days a week
Caffeine – 1 cup of tea daily
Tobacco/Vaping – Denies, never smoker
Alcohol – Denies alcohol use
Drugs – Denies recreational drug use

ROS
General – Denies fever, fatigue, weakness
Integument – Denies change in hair, skin, nails
H – Denies headache, injury, dizziness
E – Denies vision loss, blurry vision, diplopia
E – Denies pain, hearing loss, tinnitus
N – Denies itching, epistaxis, sinus problems
T – Denies sore throat, sore tongue, dry mouth
N – Denies pain, stiffness, swelling
CV – Denies palpitations, murmur, HTN
PV – Denies swelling of legs, calves, feet
Pulm – Denies cough, wheezing, SOB
C/B – Denies discomfort, lumps, nipple discharge
GI – Denies reflux, diarrhea, constipation
GU – Denies dysuria, hematuria, kidney stones
Sexual – Denies STI, genital sores, change in libido
MSK – Denies pain, stiffness, joint pain
Neuro – Denies syncope, seizures, numbness of extremities
Endo – Denies increased thirst, hunger, sweating
Heme – Denies easy bruising, easy bleeding, anemia
Psych – Denies nervousness, change in mood, change in memory`,
  objective: `VITALS
BP – 112/70
T – 98.2 °F
P – 68
R – 14
SpO2 – 99% on RA

PHYSICAL EXAM
General – Seated, appears comfortable and nontoxic, NAD
Integument – Skin warm and dry, nails w/o pitting, no brittle hair
H – NCAT w/o lesions
E – PERRL, EOMI, no lesions or discharge, fundoscopic exam performed, optic nerve visualized
E – Tragus nontender, EAC w/o lesion or discharge, TM gray and pale w/o perforation
N – Nares patent b/l, no epistaxis or discharge, mucosa pink
T – Pharynx w/o erythema, uvula midline, tonsils w/o exudate, oral mucosa pink and moist
N – Soft and supple, trachea midline, thyroid symmetrical w/o nodules, no adenopathy
CV – HRRR w/o m/r/g, DP and RAD pulses +2/4 b/l
Lungs – CTAB w/o w/r/r/s
Osteopathic/MSK – No identifiable cervical, lumbar, or thoracic lesions`,
  assessment: `Olivia Rodrigo is a 23 y/o female presenting today for AWV in good overall health, no acute concerns.

1. AWV, Female
2. Need for Vaccination
3. Need for Preventative Health Screening`,
  plan: `1. Doing well, continue current diet and running; encouraged at least 150 minutes of moderate exercise per week. RTC in 1 year for AWV or PRN w/ new concerns.
2. Influenza vaccine and COVID booster given today; educated on common side effects.
3. Ordered CBC, CMP, and lipid panel. Will call pt w/ results. Repeat Pap smear at age 24.`,
  signoff: `John F. Kennedy, OMS-I, 12/24/2026 at 11:59pm`,
};

export type ReferenceNote = { id: string; label: string; sex: "female" | "male"; texts: NoteTexts };

// "well-visit" keeps the first note's id so a copy already saved under it still loads.
export const REFERENCE_NOTES: ReferenceNote[] = [
  { id: "well-visit", label: "A.T. Still (male)", sex: "male", texts: STILL },
  { id: "well-visit-female", label: "Olivia Rodrigo (female)", sex: "female", texts: RODRIGO },
];
