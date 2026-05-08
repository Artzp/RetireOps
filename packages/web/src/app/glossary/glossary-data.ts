import type { ReactNode } from 'react';

export interface GlossaryTerm {
  id: string;
  term: string;
  expansion?: string;
  oneLiner: string;
  paragraphs: string[];
  bullets?: string[];
  related?: string[];
  source: string;
}

export interface GlossaryFAQ {
  id: string;
  question: string;
  answer: ReactNode;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'acb',
    term: 'ACB',
    expansion: 'Adjusted Cost Base',
    oneLiner:
      'The original cost of an investment, used to figure out the capital gain when you sell it.',
    paragraphs: [
      'For a non-registered (taxable) investment, the Canada Revenue Agency taxes the gain — what you sold it for minus what you paid for it. The "what you paid" side of that subtraction is the adjusted cost base, or ACB.',
      'In RetireOps, the ACB you enter for each non-registered account lets the projection estimate capital-gains tax when you draw from that account. If you don\'t know your ACB, your broker\'s "book cost" is usually a good substitute. Leaving it blank is fine — the projection will treat the entire withdrawal as a gain, which is the conservative (higher tax) assumption.',
    ],
    bullets: [
      'Only matters for non-registered (taxable) accounts — not RRSPs, TFSAs, RRIFs, LIRAs, or LIFs.',
      '50% of the gain above ACB is taxable as a capital gain (66.67% on the portion above $250,000 in a year, effective 2024).',
      'Reinvested distributions and reinvested dividends increase your ACB.',
    ],
    related: ['rrsp', 'tfsa'],
    source: 'docs/source-of-truth/02-account-types.md (NREG-006, lines 206–310)',
  },
  {
    id: 'cpp',
    term: 'CPP',
    expansion: 'Canada Pension Plan',
    oneLiner:
      "A monthly government benefit you earn through your working years. (In Quebec it's called QPP.)",
    paragraphs: [
      'The Canada Pension Plan (and the Quebec Pension Plan) pays a monthly retirement benefit based on how much and how long you contributed during your career. You can start it any time between age 60 and 70.',
      'The "standard" age is 65. Starting earlier permanently reduces your benefit by 0.6% per month (7.2% per year), and starting later permanently increases it by 0.7% per month (8.4% per year). Starting at 60 cuts it 36%; starting at 70 raises it 42%.',
      "In the wizard, enter your estimated annual CPP at age 65 — Service Canada's online statement shows this number. The projection adjusts it automatically for the start age you choose.",
    ],
    bullets: [
      'Indexed to inflation each January.',
      'Taxable as ordinary income.',
      'Survivor benefits are available to a surviving spouse, capped at the CPP maximum when combined with their own CPP.',
    ],
    related: ['oas', 'gis'],
    source: 'docs/source-of-truth/05-government-benefits.md (CPP, lines 9–112)',
  },
  {
    id: 'dpsp',
    term: 'DPSP',
    expansion: 'Deferred Profit Sharing Plan',
    oneLiner:
      'An employer-funded retirement account where contributions come from company profits.',
    paragraphs: [
      'Some Canadian employers offer a DPSP instead of (or alongside) a group RRSP. The employer contributes a share of profits each year — employees cannot contribute themselves. Money inside grows tax-deferred just like an RRSP.',
      'When you leave the employer, you can transfer the vested DPSP balance directly to your RRSP, RRIF, or another DPSP without using contribution room. Cash withdrawals are 100% taxable as ordinary income.',
    ],
    bullets: [
      'Employer-only contributions; employees never put their own money in.',
      "Vesting can take up to 2 years — until vested, the funds aren't yours if you leave.",
      'Transfers to an RRSP at separation are tax-free and do not consume contribution room.',
    ],
    related: ['rrsp'],
    source: 'CRA — Deferred Profit Sharing Plans (T4084)',
  },
  {
    id: 'eligible-dividends',
    term: 'Eligible dividends',
    oneLiner:
      'Dividends from large public Canadian corporations, taxed at a lower rate than ordinary income.',
    paragraphs: [
      'When a Canadian public company (or a CCPC paying out of its general-rate income pool) declares a dividend, it can be designated "eligible". For tax, the amount is grossed up by 38% on your return, and you receive an enhanced dividend tax credit (federal + provincial) that offsets most of the tax on the gross-up.',
      'The net effect: the cash dividend is taxed more lightly than the same dollar of interest or RRSP withdrawal would be — though it still counts toward income for the OAS clawback. RetireOps tracks eligible dividends separately on non-registered accounts so the projection applies the right gross-up and credit.',
    ],
    bullets: [
      'Federal gross-up: 38%. Federal dividend tax credit: 15.0198% of the grossed-up amount.',
      'Provincial credits vary by province and stack on top of the federal credit.',
      'Includes OAS clawback in your "net income" calculation.',
    ],
    related: ['non-eligible-dividends', 'acb', 'oas'],
    source: 'CRA — Line 12000 / T5 dividends',
  },
  {
    id: 'fhsa',
    term: 'FHSA',
    expansion: 'First Home Savings Account',
    oneLiner:
      'A registered account that combines RRSP-style deductions with TFSA-style tax-free withdrawals — for buying your first home.',
    paragraphs: [
      'Introduced in 2023, the FHSA lets first-time home buyers contribute up to $8,000 per year (lifetime $40,000), deduct contributions like an RRSP, AND withdraw the funds — including growth — tax-free, as long as the withdrawal goes toward a qualifying first home.',
      "If you don't buy a home within 15 years of opening the account (or by age 71), the FHSA must be closed. You can transfer the balance to your RRSP or RRIF tax-free, with no impact on your RRSP contribution room.",
    ],
    bullets: [
      'Annual limit: $8,000 (carry-forward of unused room from open year, capped at $8,000).',
      'Lifetime cap: $40,000.',
      "Contributions are deductible like an RRSP, but you don't get the room back if you withdraw.",
      'Withdrawals for a qualifying first home (and growth) come out tax-free.',
    ],
    related: ['rrsp', 'tfsa'],
    source: 'CRA — First Home Savings Account (FHSA)',
  },
  {
    id: 'gis',
    term: 'GIS',
    expansion: 'Guaranteed Income Supplement',
    oneLiner: 'A non-taxable monthly top-up for low-income seniors who already receive OAS.',
    paragraphs: [
      "The Guaranteed Income Supplement is paid on top of OAS to seniors with very low income. It's income-tested: every dollar of other income above an exemption reduces the GIS payment by 50 cents.",
      "For most plans the projection won't pay any GIS — typical retirement income is above the threshold. It can show up briefly in late-life years if savings are exhausted, or as a meaningful slice of the plan for households with mostly TFSA + government-benefit income.",
    ],
    bullets: [
      'Eligibility: age 65+, currently receiving OAS, residing in Canada.',
      'Single threshold (2024): roughly $21,624 of other income before GIS reaches zero.',
      'TFSA withdrawals do NOT count as income for the GIS test.',
      'GIS payments are not taxable.',
    ],
    related: ['oas', 'tfsa'],
    source: 'docs/source-of-truth/05-government-benefits.md (GIS, lines 209–250)',
  },
  {
    id: 'lif',
    term: 'LIF',
    expansion: 'Life Income Fund',
    oneLiner:
      'The decumulation account a LIRA converts into so you can draw locked-in pension money.',
    paragraphs: [
      "You can't withdraw directly from a LIRA. To start drawing your locked-in pension money you first move the LIRA into a LIF, which has a regulated minimum AND maximum withdrawal each year.",
      'The minimum is the same age-based percentage as a RRIF (4.00% at 65, 5.40% at 72, etc.). The maximum is set by your governing pension jurisdiction — most provinces use a formula based on a benchmark interest rate and your years to age 90, which roughly caps annual withdrawals at 6–7% of the balance.',
    ],
    bullets: [
      'Withdrawals are 100% taxable as ordinary income.',
      'Growth inside the LIF is tax-deferred.',
      'Some jurisdictions allow a one-time partial unlocking when you first convert.',
    ],
    related: ['lira', 'rrif'],
    source: 'docs/source-of-truth/02-account-types.md (LIF, lines 524–559)',
  },
  {
    id: 'lira',
    term: 'LIRA',
    expansion: 'Locked-In Retirement Account',
    oneLiner: 'A locked RRSP that holds money you transferred out of an employer pension plan.',
    paragraphs: [
      "When you leave an employer with a defined-benefit or defined-contribution pension, your commuted value can transfer into a LIRA. The \"locked-in\" part is the catch: you can't contribute to it, can't withdraw from it directly, and can't convert it to a regular RRSP.",
      'To start drawing income from a LIRA, you convert it to a LIF (or in some provinces an annuity). The earliest conversion age is usually 55, and the latest is December 31 of the year you turn 71 — same deadline as RRSP-to-RRIF conversion.',
    ],
    bullets: [
      "Rules vary by the pension's governing province — federal, ON, BC, AB and others have small differences.",
      'Growth inside the LIRA is tax-deferred — you only pay tax on withdrawals from the LIF (or annuity) it converts to.',
    ],
    related: ['lif', 'rrsp'],
    source: 'docs/source-of-truth/02-account-types.md (LIRA, lines 495–521)',
  },
  {
    id: 'nominal-vs-real',
    term: 'Nominal vs Real Dollars',
    oneLiner:
      '"Nominal" means future dollars; "real" means today\'s purchasing power. Inflation is the difference.',
    paragraphs: [
      "A projected $100,000 in 2050 is a nominal amount — it's the literal dollar figure you'd see on the screen of a future bank app. But $100,000 in 2050 won't buy what $100,000 buys today, because prices rise. Real dollars strip inflation back out so you can compare future numbers to today's grocery bill.",
      'In RetireOps, every projection table and chart can be toggled between Nominal CAD (the raw future amount) and Real CAD / today\'s dollars. Use real dollars when you want a gut feel for "how comfortable will I actually be?" and nominal when you want to see what your statement will literally say.',
    ],
    bullets: [
      'Relationship: real_return ≈ nominal_return − inflation_rate.',
      'A 5% nominal return with 2.5% inflation is roughly a 2.5% real return.',
      'The toggle is purely a display setting — the underlying projection math is identical either way.',
    ],
    related: ['rrsp', 'rrif'],
    source: 'docs/source-of-truth/06-investment-engine.md (lines 8–25, 38–52)',
  },
  {
    id: 'non-eligible-dividends',
    term: 'Non-eligible dividends',
    oneLiner:
      'Dividends from a Canadian-controlled private corporation (CCPC), taxed more heavily than eligible dividends.',
    paragraphs: [
      'Most dividends paid out of a small business or CCPC\'s small-business-rate income are non-eligible (or "ordinary"). The federal gross-up is 15% (vs 38% for eligible) and the dividend tax credit is smaller, so the after-tax pickup is less generous.',
      "If you own shares in a private company or a CCPC's investment account, your T5 will distinguish the eligible vs non-eligible portions. RetireOps lets you enter both kinds separately on a non-registered account so the right credit is applied.",
    ],
    bullets: [
      'Federal gross-up: 15%. Federal dividend tax credit: 9.0301% of the grossed-up amount.',
      'Effective tax rate is higher than for eligible dividends but still lower than interest income.',
      'Counts toward income for the OAS clawback.',
    ],
    related: ['eligible-dividends', 'acb', 'oas'],
    source: 'CRA — Line 12010 / T5 other-than-eligible dividends',
  },
  {
    id: 'oas',
    term: 'OAS',
    expansion: 'Old Age Security',
    oneLiner: 'A monthly government pension paid to most seniors in Canada starting at 65.',
    paragraphs: [
      "OAS is funded out of general tax revenue, not contributions. You qualify for the full amount if you've lived in Canada at least 40 years after age 18; less than that gives you a partial benefit (10 years is the minimum).",
      'You can defer OAS up to age 70 to get a permanent 0.6% / month boost (7.2% per year, up to 36% at 70). At age 75 the payment automatically increases by 10%.',
      'High-income retirees face the OAS clawback (also called the "recovery tax"): for net income above about $90,997 (2024), 15 cents of every extra dollar reduces your OAS payment, until it disappears entirely around $148,000.',
    ],
    bullets: [
      'OAS is taxable as ordinary income.',
      'Indexed to inflation quarterly (Jan / Apr / Jul / Oct).',
      "TFSA withdrawals don't count toward the clawback. RRSP/RRIF withdrawals do.",
    ],
    related: ['cpp', 'gis', 'tfsa'],
    source: 'docs/source-of-truth/05-government-benefits.md (OAS, lines 115–206)',
  },
  {
    id: 'rrif',
    term: 'RRIF',
    expansion: 'Registered Retirement Income Fund',
    oneLiner:
      'The decumulation version of an RRSP. You convert by 71 and start taking minimum withdrawals.',
    paragraphs: [
      'A RRIF is what an RRSP becomes when you start drawing from it. By December 31 of the year you turn 71 you must convert, and starting the year after that the government requires a minimum withdrawal each year.',
      "The minimum is a percentage of your January 1 balance that scales up with age — 4.00% at 65, 5.28% at 71, 5.82% at 75, 8.51% at 85, and 20% at 95+. There's no maximum: you can always withdraw more than the minimum. If your spouse is younger, you can elect to use their age in the formula to keep the minimum lower.",
    ],
    bullets: [
      'Withdrawals are 100% taxable as ordinary income.',
      'Growth inside the RRIF is tax-deferred.',
      'Withdrawing more than the minimum triggers withholding tax in the same brackets as RRSP withdrawals (10/20/30%).',
    ],
    related: ['rrsp', 'lif'],
    source: 'docs/source-of-truth/02-account-types.md (RRIF, lines 94–151)',
  },
  {
    id: 'rrsp',
    term: 'RRSP',
    expansion: 'Registered Retirement Savings Plan',
    oneLiner: 'A tax-deferred savings account: deduct now, pay tax when you withdraw.',
    paragraphs: [
      'RRSP contributions reduce your taxable income for the year you make them, and the investments inside grow without annual tax. You pay tax later, when you withdraw — usually in retirement, at a (hopefully) lower marginal rate than you paid when contributing.',
      "You must convert your RRSP into a RRIF (or buy an annuity) by December 31 of the year you turn 71. After that, the RRIF's minimum withdrawal rules take over.",
      "Spousal RRSPs let one spouse contribute to the other's account while still claiming the deduction — useful for income splitting if one spouse will have a lower retirement income. The CRA's 3-year attribution rule means very recent contributions can be taxed back to the contributing spouse if withdrawn early.",
    ],
    bullets: [
      "Contribution room: 18% of last year's earned income, up to $32,490 (2025).",
      "Withdrawals are fully taxable; you can't replace the room you withdraw.",
      'Convert to a RRIF by Dec 31 of the year you turn 71.',
    ],
    related: ['rrif', 'tfsa'],
    source: 'docs/source-of-truth/02-account-types.md (RRSP, lines 9–91)',
  },
  {
    id: 'tfsa',
    term: 'TFSA',
    expansion: 'Tax-Free Savings Account',
    oneLiner: 'A flexible account where investments grow and come out completely tax-free.',
    paragraphs: [
      "You contribute to a TFSA with after-tax money — there's no deduction. In return, the investments inside grow tax-free, withdrawals are tax-free, and the amount you withdraw is added back to your contribution room the following year.",
      "TFSA income doesn't show up on your tax return at all, which means it doesn't count toward the OAS clawback or the GIS income test. That makes TFSAs especially useful late in retirement when other income (RRIF withdrawals, CPP, OAS) is already pushing you into clawback territory.",
    ],
    bullets: [
      "Annual limit (2025): $7,000. Cumulative room since 2009: $102,000 if you've never contributed.",
      'No tax on growth, no tax on withdrawals, no impact on OAS or GIS.',
      'Withdrawn amounts come back as room next calendar year — not the same year.',
    ],
    related: ['rrsp', 'oas', 'gis'],
    source: 'docs/source-of-truth/02-account-types.md (TFSA, lines 155–199)',
  },
];

export const GLOSSARY_FAQ_DATA: Array<{ id: string; question: string; paragraphs: string[] }> = [
  {
    id: 'rrsp-vs-tfsa',
    question: 'RRSP vs TFSA — which should I use?',
    paragraphs: [
      "The simplest rule: contribute to an RRSP if you'll be in a lower tax bracket in retirement than you are today, and a TFSA if you'll be in the same or higher bracket — or if you're not sure. The deduction the RRSP gives you today only pays off if your withdrawal rate is lower than your contribution rate.",
      "Most Canadians use both. RRSPs work best for high earners with peak-earning-year contributions; TFSAs are flexible, never tax your withdrawals, and don't affect OAS or GIS. The wizard's Accounts step lets you enter both — see the glossary entries above for the rules.",
    ],
  },
  {
    id: 'rrsp-to-rrif',
    question: 'When does my RRSP convert to a RRIF?',
    paragraphs: [
      "You must convert your RRSP into a RRIF (or buy an annuity, or cash it out) by December 31 of the year you turn 71. Most people do this through their broker — it's a paperwork move, not a sale of assets.",
      "Starting in the year AFTER conversion, the government requires a minimum withdrawal based on your age (or your younger spouse's age, if you elect). RetireOps applies this automatically once your wizard age crosses the threshold.",
    ],
  },
  {
    id: 'real-vs-nominal',
    question: 'What does "real" vs "nominal" mean in my projection?',
    paragraphs: [
      "Nominal is the literal future-dollar amount. Real is that amount adjusted back to today's purchasing power. Inflation is the difference between them.",
      'If you see the toggle on a results chart, switch to "real" when you want to compare your future spending to today\'s lifestyle, and "nominal" when you want to see what the actual dollar number on a future bank statement would be.',
    ],
  },
  {
    id: 'lira-to-lif',
    question: 'How does my LIRA become a LIF?',
    paragraphs: [
      "You can't withdraw from a LIRA directly. When you're ready to start using the money — typically between 55 and 71 — you ask your broker to convert it. The LIRA balance moves into a new LIF account, and you start drawing income with regulated minimum and maximum amounts each year.",
      'The latest you can keep it in a LIRA is December 31 of the year you turn 71, the same deadline as RRSP-to-RRIF.',
    ],
  },
  {
    id: 'oas-clawback',
    question: 'What is the OAS clawback?',
    paragraphs: [
      'Officially the "OAS Recovery Tax", the clawback reduces your OAS payments when your net income passes a threshold (~$90,997 in 2024). For every dollar above that, you lose 15 cents of OAS, until the benefit disappears entirely around $148,000.',
      "TFSA withdrawals don't count toward this calculation, but RRSP/RRIF withdrawals, CPP, OAS itself, dividends, and 50% of capital gains all do. One reason TFSAs are valuable late in retirement is that they let you spend without dragging your OAS down.",
    ],
  },
];
