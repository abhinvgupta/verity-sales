/**
 * Seeds realistic demo analytics data for the Demo Co tenant: 6 demo reps and
 * ~150 completed calls (with analyses, objections + comparisons) spread over
 * the last 90 days. Every document is flagged `demoSeed: true`.
 *
 * Run from the apps/api directory (bun auto-loads .env there):
 *   bun run scripts/seed-demo-data.ts            # seed
 *   bun run scripts/seed-demo-data.ts --clean    # remove all seeded docs
 *
 * Uses a plain mongoose connection (no Nest bootstrap) so it only needs
 * MONGODB_URI — not Redis / OpenAI / AWS.
 */
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/verity';
const COMPANY_SLUG = 'demo-co';
const DAY_MS = 86_400_000;

// Deterministic PRNG so reseeding produces the same dashboard.
let seed = 20260612;
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const sample = <T>(arr: T[], n: number): T[] =>
  [...arr].sort(() => rand() - 0.5).slice(0, n);
const between = (min: number, max: number): number =>
  min + rand() * (max - min);

/** Rep profiles: base quality, honesty (drives alignment), weekly improvement. */
const REPS = [
  { name: 'Priya Nair', base: 82, honesty: 0.92, slope: 0.4 },
  { name: 'Akshay Mehta', base: 74, honesty: 0.85, slope: 0.9 },
  { name: 'Sara Iyer', base: 71, honesty: 0.95, slope: 0.1 },
  { name: 'Rohan Das', base: 64, honesty: 0.55, slope: 0.6 },
  { name: 'Vikram Shetty', base: 58, honesty: 0.8, slope: 1.4 },
  { name: 'Neha Kulkarni', base: 49, honesty: 0.65, slope: -0.3 },
];

const GOOD_POINTS = [
  'Asked open-ended discovery questions',
  'Clearly articulated the value proposition',
  'Confirmed next steps before ending the call',
  'Handled pricing objection with ROI framing',
  'Built strong rapport in the opening minutes',
  'Summarized customer needs back accurately',
  'Involved the decision maker early',
  'Used customer-specific examples in the demo',
];

const IMPROVEMENT_POINTS = [
  'Did not confirm budget before proposing pricing',
  'Talked over the customer during objections',
  'Skipped discovery and jumped straight to demo',
  'No clear next step agreed at close',
  'Failed to ask about competing solutions',
  'Spent too long on features the customer did not need',
  'Did not involve the decision maker',
  'Weak response to integration concerns',
];

const RED_FLAGS = [
  'Customer mentioned evaluating a competitor',
  'Unaddressed dealbreaker objection on pricing',
  'Customer disengaged during the demo',
  'Over-discounting without approval',
  'Inaccurate claim about product capabilities',
  'Decision maker not identified',
];

const COMPLIANCE_ISSUES = [
  { issue: 'Recording consent not confirmed', category: 'recording_consent' },
  { issue: 'Unauthorized discount promised', category: 'unauthorized_promise' },
  { issue: 'Missing required pricing disclosure', category: 'missing_disclosure' },
  { issue: 'Unverifiable ROI claim', category: 'misrepresentation' },
  { issue: 'Customer data shared without consent', category: 'data_privacy' },
];

const OUTCOMES = ['advanced', 'stalled', 'closed_won', 'closed_lost', 'no_outcome'];
const SENTIMENTS = ['positive', 'neutral', 'negative'];

interface ObjectionVariant {
  summary: string;
  excerpt: string;
}

/**
 * Objection catalog for the Objection Intelligence tab. `rate` is the chance
 * a call contains the objection; `difficulty` lowers the success probability
 * so frequent+hard types surface as "priority". The win/lose variants feed
 * the resolution-path LLM synthesis, so they read like real call moments.
 * `integration_complexity` is deliberately rare to exercise the
 * insufficient-samples state.
 */
const OBJECTIONS: {
  type: string;
  rate: number;
  difficulty: number;
  win: ObjectionVariant[];
  lose: ObjectionVariant[];
}[] = [
  {
    type: 'pricing',
    rate: 0.55,
    difficulty: 0.1,
    win: [
      {
        summary:
          'Rep reframed the price against the cost of missed deals and quantified ROI with the prospect’s own numbers.',
        excerpt:
          'Prospect: Honestly, this is above what we budgeted.\nRep: Fair — can I show you what one recovered deal a month covers? You said average deal size is 40k.\nProspect: Okay, when you put it that way, the math works.',
      },
      {
        summary:
          'Rep anchored on the annual plan discount and tied price to the specific features the prospect said they needed.',
        excerpt:
          'Prospect: The per-seat price feels steep.\nRep: You mentioned call review eats six hours a week — the annual plan works out to less than one of those hours.\nProspect: That’s a more useful comparison, yes.',
      },
      {
        summary:
          'Rep acknowledged the concern, then split the rollout into a smaller initial tier with a clear expansion path.',
        excerpt:
          'Prospect: We can’t commit to this spend for the whole team.\nRep: Then let’s not — start with the five reps on enterprise deals and expand when the numbers prove out.\nProspect: A pilot tier we can grow into would get approved.',
      },
    ],
    lose: [
      {
        summary:
          'Rep immediately offered a discount without exploring the underlying concern, which weakened the value story.',
        excerpt:
          'Prospect: That’s more than we wanted to spend.\nRep: I can knock 20% off if you sign this quarter.\nProspect: If there’s already 20% slack in the price, what else is negotiable?',
      },
      {
        summary:
          'Rep repeated the feature list instead of addressing budget, and the prospect disengaged.',
        excerpt:
          'Prospect: The price is the issue, not the features.\nRep: But you also get the analytics module, the coaching dashboards…\nProspect: Right, but none of that changes our budget.',
      },
      {
        summary:
          'Rep deflected the pricing question to a follow-up email and never tied price to value on the call.',
        excerpt:
          'Prospect: Can you justify the cost versus what we do today?\nRep: I’ll send over a pricing one-pager after the call.\nProspect: …okay. We’ll look when we get a chance.',
      },
    ],
  },
  {
    type: 'brand_recognition',
    rate: 0.3,
    difficulty: 0.3,
    win: [
      {
        summary:
          'Rep leaned into proof instead of brand: named two comparable customers and offered a reference call.',
        excerpt:
          'Prospect: We’ve never heard of you — we were expecting Gong or Chorus.\nRep: Fair. Two teams your size, Meridian and Brightline, switched last year — happy to set up a reference call.\nProspect: A reference would actually help.',
      },
      {
        summary:
          'Rep converted the size concern into an advantage — direct access to the founding team and faster turnaround.',
        excerpt:
          'Prospect: How do we know you’ll still be around in two years?\nRep: You get our founding engineers in your Slack — when Meridian asked for SSO, it shipped in three weeks.\nProspect: That kind of attention is hard to get from the big vendors.',
      },
    ],
    lose: [
      {
        summary:
          'Rep got defensive about company size and argued with the prospect rather than offering proof.',
        excerpt:
          'Prospect: You’re a small unknown vendor.\nRep: We’re actually growing really fast, that’s not a fair characterization.\nProspect: It’s not about fair — it’s about risk for us.',
      },
      {
        summary:
          'Rep ignored the trust concern entirely and pushed for the next meeting.',
        excerpt:
          'Prospect: Nobody on our team has heard of your product.\nRep: So shall we get the technical demo scheduled for Thursday?\nProspect: Let’s hold off on scheduling anything.',
      },
    ],
  },
  {
    type: 'timing',
    rate: 0.2,
    difficulty: -0.1,
    win: [
      {
        summary:
          'Rep agreed the timing was tight and proposed starting data collection now so launch lands after the quarter closes.',
        excerpt:
          'Prospect: This quarter is chaos — we can’t take on a rollout.\nRep: Don’t roll out now. Start ingesting calls quietly this month, and your team onboards in week one of next quarter with data already there.\nProspect: Starting passive collection now actually makes sense.',
      },
      {
        summary:
          'Rep tied the start date to the prospect’s stated hiring plan, making delay the costlier option.',
        excerpt:
          'Prospect: Maybe next half, honestly.\nRep: You said five new reps start in March — coaching them from day one beats retraining them in June.\nProspect: True, ramping them right the first time matters.',
      },
    ],
    lose: [
      {
        summary:
          'Rep accepted the delay without exploring it and asked to "circle back next quarter".',
        excerpt:
          'Prospect: Now’s not a great time.\nRep: No problem, I’ll circle back next quarter.\nProspect: Sure, reach out then.',
      },
    ],
  },
  {
    type: 'competitor',
    rate: 0.18,
    difficulty: 0.15,
    win: [
      {
        summary:
          'Rep narrowed the comparison to the one capability the prospect cared about and proposed a side-by-side on their own calls.',
        excerpt:
          'Prospect: We’re also looking at Gong.\nRep: Good tool. For rep-vs-transcript verification — the thing you said burned you last audit — run both on the same ten calls and compare.\nProspect: A bake-off on our own calls is fair.',
      },
    ],
    lose: [
      {
        summary:
          'Rep disparaged the competitor, which made the prospect defend their shortlist.',
        excerpt:
          'Prospect: How do you compare to Chorus?\nRep: Honestly their analysis is pretty shallow, most teams regret it.\nProspect: Our sister company uses Chorus and likes it, so…',
      },
      {
        summary:
          'Rep gave a generic "we’re different" answer with no specifics tied to the prospect’s needs.',
        excerpt:
          'Prospect: What makes you different from the others we’re seeing?\nRep: We really focus on the customer and our AI is next-level.\nProspect: That’s what every vendor this week has said.',
      },
    ],
  },
  {
    type: 'no_budget',
    rate: 0.12,
    difficulty: 0.25,
    win: [
      {
        summary:
          'Rep helped the prospect find an existing budget line (QA tooling) the purchase could legitimately sit under.',
        excerpt:
          'Prospect: There’s simply no budget line for this.\nRep: Where does call QA spend sit today — the enablement budget? This usually replaces part of that line, not adds to it.\nProspect: Under enablement… that could actually work.',
      },
    ],
    lose: [
      {
        summary:
          'Rep pushed the close anyway, and the prospect ended the conversation.',
        excerpt:
          'Prospect: We have zero budget until the new fiscal year.\nRep: Could you sign now with a deferred start, though? Quarter end is coming.\nProspect: That’s not how our finance team works. We should stop here.',
      },
    ],
  },
  {
    type: 'needs_approval',
    rate: 0.15,
    difficulty: -0.05,
    win: [
      {
        summary:
          'Rep turned the approval step into a joint plan — built the business case with the champion and got invited to the VP meeting.',
        excerpt:
          'Prospect: I’d need my VP to sign off.\nRep: What does she care about most — risk, cost, or rep ramp time? Let’s build the one-pager around that and I’ll join you for the questions I should answer.\nProspect: Bring the compliance angle, that’s her hot button.',
      },
    ],
    lose: [
      {
        summary:
          'Rep left the approval entirely to the prospect with no materials or follow-up plan.',
        excerpt:
          'Prospect: I’ll have to run this up the chain.\nRep: Great, let me know how it goes!\nProspect: Will do… (no next step was set)',
      },
    ],
  },
  {
    type: 'integration_complexity',
    rate: 0.06,
    difficulty: 0.2,
    win: [
      {
        summary:
          'Rep walked through the existing dialer integration and offered a sandbox to de-risk the setup.',
        excerpt:
          'Prospect: Our stack is a mess — integrations always blow up.\nRep: You’re on RingCentral, right? That connector is native — I can spin up a sandbox against a test workspace today.\nProspect: If we can verify in a sandbox first, that removes most of my worry.',
      },
    ],
    lose: [
      {
        summary:
          'Rep hand-waved the integration effort without specifics, and the concern remained open.',
        excerpt:
          'Prospect: How painful is setup with our phone system?\nRep: It’s usually pretty easy, our team handles it.\nProspect: “Usually” is what the last vendor said too.',
      },
    ],
  },
];

/**
 * Handling outcome weighted by call quality and objection difficulty —
 * better calls handle objections better, harder objections fail more.
 */
function pickHandling(
  score: number,
  difficulty: number,
): 'successful' | 'partial' | 'unsuccessful' | 'ignored' {
  const pSuccess = Math.max(0.05, Math.min(0.9, score / 100 - difficulty));
  const r = rand();
  if (r < pSuccess) return 'successful';
  if (r < pSuccess + 0.2) return 'partial';
  if (r < pSuccess + 0.38) return 'unsuccessful';
  return 'ignored';
}

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);

  const uuidId = { _id: { type: String, default: () => randomUUID() } };
  const opts = { strict: false as const, timestamps: true };
  const Company = mongoose.model('Company', new mongoose.Schema(uuidId, opts));
  const User = mongoose.model('User', new mongoose.Schema(uuidId, opts));
  const Call = mongoose.model('Call', new mongoose.Schema(uuidId, opts));
  const CallAnalysis = mongoose.model(
    'CallAnalysis',
    new mongoose.Schema(uuidId, opts),
  );
  const ComparisonResult = mongoose.model(
    'ComparisonResult',
    new mongoose.Schema(uuidId, opts),
  );

  if (process.argv.includes('--clean')) {
    for (const M of [User, Call, CallAnalysis, ComparisonResult]) {
      const res = await M.deleteMany({ demoSeed: true });
      console.log(`Removed ${res.deletedCount} from ${M.collection.name}`);
    }
    await mongoose.disconnect();
    return;
  }

  const company = await Company.findOne({ slug: COMPANY_SLUG }).exec();
  if (!company) {
    throw new Error(`Company '${COMPANY_SLUG}' not found — seed it first.`);
  }
  const companyId = company._id;

  const existing = await Call.countDocuments({ demoSeed: true });
  if (existing > 0) {
    console.log(
      `Found ${existing} seeded calls already — run with --clean first to reseed.`,
    );
    await mongoose.disconnect();
    return;
  }

  const now = Date.now();
  let calls = 0;

  for (const profile of REPS) {
    const slug = profile.name.toLowerCase().replace(/\s+/g, '.');
    const rep = await User.create({
      companyId,
      name: profile.name,
      email: `${slug}@demo-seed.verity`,
      passwordHash: 'demo-seed-no-login',
      role: 'rep',
      isActive: true,
      demoSeed: true,
    });

    const callCount = Math.floor(between(18, 32));
    for (let i = 0; i < callCount; i++) {
      const daysAgo = between(0, 90);
      const createdAt = new Date(now - daysAgo * DAY_MS);
      // Score improves (or decays) toward the present along the rep's slope.
      const score = Math.round(
        Math.max(
          5,
          Math.min(
            99,
            profile.base + profile.slope * ((90 - daysAgo) / 7) + between(-14, 14),
          ),
        ),
      );

      const complianceIssues =
        rand() < 0.22
          ? sample(COMPLIANCE_ISSUES, rand() < 0.25 ? 2 : 1).map((c) => ({
              ...c,
              severity: pick(['low', 'medium', 'high']),
              evidence: 'See transcript excerpt.',
            }))
          : [];

      const objections = OBJECTIONS.filter((o) => rand() < o.rate).map((o) => {
        const repHandling = pickHandling(score, o.difficulty);
        const variant = pick(repHandling === 'successful' ? o.win : o.lose);
        return {
          type: o.type,
          repHandling,
          repResponseSummary: variant.summary,
          transcriptExcerpt: variant.excerpt,
        };
      });

      const callId = randomUUID();
      await Call.create({
        _id: callId,
        companyId,
        repId: rep._id,
        transcriptUrl: `demo-seed/${callId}/transcript.txt`,
        status: 'complete',
        createdAt,
        updatedAt: createdAt,
        demoSeed: true,
      });

      await CallAnalysis.create({
        callId,
        companyId,
        analysisStatus: 'success',
        score,
        // Denormalized copy the objection aggregations read.
        objections,
        parsedOutput: {
          summary: 'Seeded demo call for dashboard preview.',
          callOutcome: pick(OUTCOMES),
          customerSentiment: pick(SENTIMENTS),
          score,
          whatWasDone: [],
          whatWentWell: sample(GOOD_POINTS, Math.ceil(between(1, 3))).map(
            (point) => ({ point, evidence: 'See transcript excerpt.' }),
          ),
          areasForImprovement: sample(
            IMPROVEMENT_POINTS,
            Math.ceil(between(1, 3)),
          ).map((point) => ({ point, suggestion: 'Coach in next 1:1.' })),
          redFlags:
            rand() < 0.35
              ? sample(RED_FLAGS, 1).map((issue) => ({
                  issue,
                  severity: pick(['low', 'medium', 'high']),
                }))
              : [],
          complianceIssues,
          objections,
        },
        createdAt,
        updatedAt: createdAt,
        demoSeed: true,
      });

      // Alignment: honest reps report accurately; noise widens for the rest.
      const alignment = Math.round(
        Math.max(
          5,
          Math.min(99, profile.honesty * 100 + between(-18, 10)),
        ),
      );
      await ComparisonResult.create({
        callId,
        companyId,
        comparisonStatus: 'success',
        alignmentScore: alignment,
        findings: [],
        createdAt,
        updatedAt: createdAt,
        demoSeed: true,
      });
      calls++;
    }
    console.log(`Seeded ${callCount} calls for ${profile.name}`);
  }

  console.log(`\nSeed complete: ${REPS.length} reps, ${calls} calls.`);
  console.log('Remove with: bun run scripts/seed-demo-data.ts --clean');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
