"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/verity';
const COMPANY_SLUG = 'demo-co';
const COMPANY_NAME = 'Demo Co';
const outputSchema = {
    type: 'object',
    required: [
        'summary',
        'callOutcome',
        'customerSentiment',
        'score',
        'whatWasDone',
        'whatWentWell',
        'areasForImprovement',
        'redFlags',
        'complianceIssues',
        'objections',
    ],
    properties: {
        summary: {
            type: 'string',
            description: 'Concise 2-4 sentence overview of the call.',
        },
        callOutcome: {
            type: 'string',
            enum: ['advanced', 'stalled', 'closed_won', 'closed_lost', 'no_outcome'],
            description: 'Where the deal landed by the end of the call.',
        },
        customerSentiment: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative'],
            description: "The customer's overall sentiment during the call.",
        },
        score: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Overall call-quality score weighing execution against red flags and compliance issues.',
        },
        whatWasDone: {
            type: 'array',
            description: 'Factual, chronological account of the stages/actions the rep covered. No judgement.',
            items: {
                type: 'object',
                required: ['stage', 'description'],
                properties: {
                    stage: {
                        type: 'string',
                        description: 'e.g. rapport, discovery, demo, objection_handling, pricing, next_steps',
                    },
                    description: { type: 'string' },
                },
            },
        },
        whatWentWell: {
            type: 'array',
            description: 'Specific strengths in the rep’s execution.',
            items: {
                type: 'object',
                required: ['point', 'evidence'],
                properties: {
                    point: { type: 'string' },
                    evidence: {
                        type: 'string',
                        description: 'Short quote or moment from the transcript.',
                    },
                },
            },
        },
        areasForImprovement: {
            type: 'array',
            description: 'Coaching opportunities where the rep could have done better.',
            items: {
                type: 'object',
                required: ['point', 'suggestion'],
                properties: {
                    point: { type: 'string' },
                    suggestion: {
                        type: 'string',
                        description: 'Concrete, actionable coaching suggestion.',
                    },
                    evidence: { type: 'string' },
                },
            },
        },
        redFlags: {
            type: 'array',
            description: 'Risks to the deal or relationship: disengaged customer, unaddressed dealbreaker objections, over-discounting, talking over the customer, inaccurate product claims, unhandled competitor threats.',
            items: {
                type: 'object',
                required: ['issue', 'severity'],
                properties: {
                    issue: { type: 'string' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    evidence: { type: 'string' },
                },
            },
        },
        objections: {
            type: 'array',
            description: 'Every objection the prospect raised, with how the rep handled it.',
            items: {
                type: 'object',
                required: ['type', 'repHandling', 'repResponseSummary', 'transcriptExcerpt'],
                properties: {
                    type: {
                        type: 'string',
                        description: 'Short snake_case label for the objection, e.g. pricing, brand_recognition, timing, competitor, no_budget, needs_approval',
                    },
                    repHandling: {
                        type: 'string',
                        enum: ['successful', 'partial', 'unsuccessful', 'ignored'],
                        description: 'How the rep handled the objection.',
                    },
                    repResponseSummary: {
                        type: 'string',
                        description: "1-2 sentence summary of the rep's response.",
                    },
                    transcriptExcerpt: {
                        type: 'string',
                        description: 'Verbatim 2-3 lines from the transcript covering the objection and response.',
                    },
                },
            },
        },
        complianceIssues: {
            type: 'array',
            description: 'Statements or behaviors that may violate regulation or company policy.',
            items: {
                type: 'object',
                required: ['issue', 'category', 'severity'],
                properties: {
                    issue: { type: 'string' },
                    category: {
                        type: 'string',
                        enum: [
                            'misrepresentation',
                            'missing_disclosure',
                            'recording_consent',
                            'data_privacy',
                            'unauthorized_promise',
                            'other',
                        ],
                    },
                    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    evidence: { type: 'string' },
                },
            },
        },
    },
};
const callAnalysisPrompt = `You are a senior sales-call quality assurance analyst and coach. You will be given the transcript of a sales call between a sales representative ("rep") and a prospect or customer. Analyze the call objectively and produce a structured evaluation.

Focus on five dimensions:
1. What was done — a factual, chronological account of the stages and actions the rep covered (rapport building, discovery, product demo, objection handling, pricing, next steps). Do not judge here; just describe what happened.
2. What went well — specific strengths in the rep's execution. For each, cite a short quote or moment from the transcript as evidence.
3. Areas for improvement — coaching opportunities where the rep could have done better. For each, give a concrete, actionable suggestion and cite evidence where possible.
4. Red flags — anything that puts the deal or relationship at risk: a disengaged customer, unaddressed dealbreaker objections, over-discounting, talking over the customer, inaccurate claims about the product, or competitor threats left unhandled. Rate each severity as low, medium, or high.
5. Compliance issues — statements or behaviors that may violate regulation or company policy: misrepresentation or unverifiable claims, missing required disclosures, recording-consent problems, mishandling of personal or financial data, or promises the rep is not authorized to make. Categorize and rate the severity of each.
6. Objections — every objection the prospect raised. For each one:
   - type: a short snake_case label for the objection (e.g. pricing, brand_recognition, timing, competitor, no_budget, needs_approval). Reuse the same label for the same kind of objection.
   - repHandling: classify how the rep handled it — "successful" if the rep addressed it convincingly and the prospect accepted, "partial" if the rep addressed it but the prospect remained skeptical, "unsuccessful" if the rep failed to address it well, "ignored" if the rep did not address it at all.
   - repResponseSummary: a 1-2 sentence summary of how the rep responded.
   - transcriptExcerpt: a verbatim 2-3 line excerpt from the transcript covering the objection and the rep's response.

Also provide:
- summary: a concise 2-4 sentence overview of the call.
- callOutcome: whether the deal advanced, stalled, closed (won or lost), or had no clear outcome.
- customerSentiment: the customer's overall sentiment.
- score: an overall call-quality score from 0 to 100, weighing execution against the red flags and compliance issues you found.

Rules:
- Base every observation strictly on the transcript. Do not invent details.
- If a dimension has no items, return an empty array for it.
- Use direct, short quotes from the transcript as evidence wherever possible.

Your response MUST conform exactly to this JSON schema:
{{schema}}

Transcript:
{{transcript}}`;
const formSchema = {
    type: 'object',
    required: [
        'dealSize',
        'productsDiscussed',
        'customerObjections',
        'commitmentsMade',
        'nextSteps',
        'decisionMaker',
        'expectedCloseDate',
    ],
    properties: {
        dealSize: {
            type: 'number',
            description: 'Deal value the rep recorded, in account currency.',
        },
        productsDiscussed: {
            type: 'array',
            items: { type: 'string' },
            description: 'Products or plans the rep noted as discussed.',
        },
        customerObjections: {
            type: 'array',
            items: { type: 'string' },
            description: 'Objections the rep logged from the customer.',
        },
        commitmentsMade: {
            type: 'array',
            items: { type: 'string' },
            description: 'Commitments or promises the rep recorded making.',
        },
        nextSteps: {
            type: 'string',
            description: 'Next steps the rep wrote down.',
        },
        decisionMaker: {
            type: 'string',
            description: 'Who the rep identified as the decision maker.',
        },
        expectedCloseDate: {
            type: 'string',
            description: 'Expected close date the rep recorded (ISO date if present).',
        },
    },
};
async function main() {
    await mongoose_1.default.connect(MONGODB_URI);
    console.log(`Connected to ${MONGODB_URI}`);
    const Company = mongoose_1.default.model('Company', new mongoose_1.default.Schema({ _id: { type: String, default: () => (0, node_crypto_1.randomUUID)() } }, { strict: false, timestamps: true }));
    const EvaluationTemplate = mongoose_1.default.model('EvaluationTemplate', new mongoose_1.default.Schema({ _id: { type: String, default: () => (0, node_crypto_1.randomUUID)() } }, { strict: false, timestamps: true }));
    let company = await Company.findOne({ slug: COMPANY_SLUG }).exec();
    if (!company) {
        company = await Company.create({
            name: COMPANY_NAME,
            slug: COMPANY_SLUG,
            plan: 'starter',
            isActive: true,
        });
        console.log(`Created company ${company._id.toString()} (${COMPANY_SLUG})`);
    }
    else {
        console.log(`Using existing company ${company._id.toString()} (${COMPANY_SLUG})`);
    }
    await EvaluationTemplate.updateMany({ companyId: company._id, isActive: true }, { isActive: false }).exec();
    const template = await EvaluationTemplate.create({
        companyId: company._id,
        isActive: true,
        callAnalysisPrompt,
        outputSchema,
        formSchema,
    });
    console.log(`Created active template ${template._id.toString()}`);
    console.log('\nSeed complete:');
    console.log(`  companyId  = ${company._id.toString()}`);
    console.log(`  templateId = ${template._id.toString()}`);
    await mongoose_1.default.disconnect();
}
main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-template.js.map