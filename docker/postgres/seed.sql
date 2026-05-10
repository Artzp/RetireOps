-- RetireOps Database Seed Script
-- This script populates initial configuration data
-- @see docs/source-of-truth/ for authoritative values

SET search_path TO retireops, public;

-- =============================================================================
-- RRIF Minimum Withdrawal Rates
-- @see docs/source-of-truth/02-account-types.md - RRIF Minimum Withdrawal Percentages
-- =============================================================================
INSERT INTO rrif_rates (age, rate) VALUES
    (65, 0.0400),
    (66, 0.0417),
    (67, 0.0435),
    (68, 0.0455),
    (69, 0.0476),
    (70, 0.0500),
    (71, 0.0528),
    (72, 0.0540),
    (73, 0.0553),
    (74, 0.0567),
    (75, 0.0582),
    (76, 0.0598),
    (77, 0.0617),
    (78, 0.0636),
    (79, 0.0658),
    (80, 0.0682),
    (81, 0.0708),
    (82, 0.0738),
    (83, 0.0771),
    (84, 0.0808),
    (85, 0.0851),
    (86, 0.0899),
    (87, 0.0955),
    (88, 0.1021),
    (89, 0.1099),
    (90, 0.1192),
    (91, 0.1306),
    (92, 0.1449),
    (93, 0.1634),
    (94, 0.1879),
    (95, 0.2000)
ON CONFLICT (age) DO UPDATE SET rate = EXCLUDED.rate;

-- =============================================================================
-- Federal Tax Brackets (2024)
-- @see docs/source-of-truth/04-tax-engine.md - Federal Tax Brackets
-- =============================================================================
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'federal', '[
    {"min": 0, "max": 55867, "rate": 0.15},
    {"min": 55867, "max": 111733, "rate": 0.205},
    {"min": 111733, "max": 173205, "rate": 0.26},
    {"min": 173205, "max": 246752, "rate": 0.29},
    {"min": 246752, "max": null, "rate": 0.33}
]'::jsonb, 15705.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- =============================================================================
-- Provincial Tax Brackets (2024)
-- @see docs/source-of-truth/04-tax-engine.md - Provincial Tax Brackets
-- =============================================================================

-- Ontario
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'ON', '[
    {"min": 0, "max": 51446, "rate": 0.0505},
    {"min": 51446, "max": 102894, "rate": 0.0915},
    {"min": 102894, "max": 150000, "rate": 0.1116},
    {"min": 150000, "max": 220000, "rate": 0.1216},
    {"min": 220000, "max": null, "rate": 0.1316}
]'::jsonb, 12399.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- British Columbia
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'BC', '[
    {"min": 0, "max": 47937, "rate": 0.0506},
    {"min": 47937, "max": 95875, "rate": 0.077},
    {"min": 95875, "max": 110076, "rate": 0.105},
    {"min": 110076, "max": 133664, "rate": 0.1229},
    {"min": 133664, "max": 181232, "rate": 0.147},
    {"min": 181232, "max": null, "rate": 0.205}
]'::jsonb, 12580.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Alberta
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'AB', '[
    {"min": 0, "max": 148269, "rate": 0.10},
    {"min": 148269, "max": 177922, "rate": 0.12},
    {"min": 177922, "max": 237230, "rate": 0.13},
    {"min": 237230, "max": 355845, "rate": 0.14},
    {"min": 355845, "max": null, "rate": 0.15}
]'::jsonb, 21003.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Quebec
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'QC', '[
    {"min": 0, "max": 51780, "rate": 0.14},
    {"min": 51780, "max": 103545, "rate": 0.19},
    {"min": 103545, "max": 126000, "rate": 0.24},
    {"min": 126000, "max": null, "rate": 0.2575}
]'::jsonb, 18056.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Saskatchewan
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'SK', '[
    {"min": 0, "max": 52057, "rate": 0.105},
    {"min": 52057, "max": 148734, "rate": 0.125},
    {"min": 148734, "max": null, "rate": 0.145}
]'::jsonb, 18491.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Manitoba
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'MB', '[
    {"min": 0, "max": 47000, "rate": 0.108},
    {"min": 47000, "max": 100000, "rate": 0.1275},
    {"min": 100000, "max": null, "rate": 0.174}
]'::jsonb, 15780.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Nova Scotia
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'NS', '[
    {"min": 0, "max": 29590, "rate": 0.0879},
    {"min": 29590, "max": 59180, "rate": 0.1495},
    {"min": 59180, "max": 93000, "rate": 0.1667},
    {"min": 93000, "max": 150000, "rate": 0.175},
    {"min": 150000, "max": null, "rate": 0.21}
]'::jsonb, 8481.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- New Brunswick
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'NB', '[
    {"min": 0, "max": 49958, "rate": 0.094},
    {"min": 49958, "max": 99916, "rate": 0.14},
    {"min": 99916, "max": 185064, "rate": 0.16},
    {"min": 185064, "max": null, "rate": 0.195}
]'::jsonb, 13044.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Prince Edward Island
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'PE', '[
    {"min": 0, "max": 32656, "rate": 0.0965},
    {"min": 32656, "max": 64313, "rate": 0.1363},
    {"min": 64313, "max": 105000, "rate": 0.1665},
    {"min": 105000, "max": 140000, "rate": 0.18},
    {"min": 140000, "max": null, "rate": 0.1875}
]'::jsonb, 13500.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Newfoundland and Labrador
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'NL', '[
    {"min": 0, "max": 43198, "rate": 0.087},
    {"min": 43198, "max": 86395, "rate": 0.145},
    {"min": 86395, "max": 154244, "rate": 0.158},
    {"min": 154244, "max": 215943, "rate": 0.178},
    {"min": 215943, "max": 275870, "rate": 0.198},
    {"min": 275870, "max": 551739, "rate": 0.208},
    {"min": 551739, "max": null, "rate": 0.218}
]'::jsonb, 10818.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Northwest Territories
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'NT', '[
    {"min": 0, "max": 50597, "rate": 0.059},
    {"min": 50597, "max": 101198, "rate": 0.086},
    {"min": 101198, "max": 164525, "rate": 0.122},
    {"min": 164525, "max": null, "rate": 0.1405}
]'::jsonb, 16593.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Nunavut
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'NU', '[
    {"min": 0, "max": 53268, "rate": 0.04},
    {"min": 53268, "max": 106537, "rate": 0.07},
    {"min": 106537, "max": 173205, "rate": 0.09},
    {"min": 173205, "max": null, "rate": 0.115}
]'::jsonb, 18767.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- Yukon
INSERT INTO tax_tables (year, jurisdiction, brackets, basic_personal_amount) VALUES
(2024, 'YT', '[
    {"min": 0, "max": 55867, "rate": 0.064},
    {"min": 55867, "max": 111733, "rate": 0.09},
    {"min": 111733, "max": 173205, "rate": 0.109},
    {"min": 173205, "max": 500000, "rate": 0.128},
    {"min": 500000, "max": null, "rate": 0.15}
]'::jsonb, 15705.00)
ON CONFLICT (year, jurisdiction) DO UPDATE SET
    brackets = EXCLUDED.brackets,
    basic_personal_amount = EXCLUDED.basic_personal_amount;

-- =============================================================================
-- Benefit Rates (2024)
-- @see docs/source-of-truth/05-government-benefits.md
-- =============================================================================
INSERT INTO benefit_rates (year, benefit_type, rates) VALUES
(2024, 'cpp', '{
    "maxMonthlyAt65": 1364.60,
    "maxAnnualAt65": 16375,
    "averageMonthly": 815,
    "earlyReductionPerMonth": 0.006,
    "lateIncreasePerMonth": 0.007,
    "earliestAge": 60,
    "latestAge": 70
}'::jsonb),
(2024, 'oas', '{
    "maxMonthlyAge65To74": 713,
    "maxAnnualAge65To74": 8560,
    "maxMonthlyAge75Plus": 785,
    "maxAnnualAge75Plus": 9420,
    "deferralIncreasePerMonth": 0.006,
    "clawbackThreshold": 90997,
    "clawbackRate": 0.15,
    "age75Bonus": 0.10
}'::jsonb),
(2024, 'gis', '{
    "maxMonthlySingle": 1065,
    "maxAnnualSingle": 12780,
    "maxMonthlyMarried": 641,
    "incomeThresholdSingle": 21624,
    "incomeThresholdMarriedBoth": 28560,
    "reductionRate": 0.50
}'::jsonb)
ON CONFLICT (year, benefit_type) DO UPDATE SET rates = EXCLUDED.rates;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'RetireOps seed data loaded successfully';
END $$;
