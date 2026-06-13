import { Injectable } from '@nestjs/common';

const STRICT_JSON_INSTRUCTION =
  'Respond ONLY with valid JSON. No preamble, no explanation, no markdown fences.';

/**
 * Common form-extraction instruction, shared across all companies. The
 * per-company part is the formSchema, interpolated via {{schema}}.
 */
const FORM_EXTRACTION_PROMPT = `You are a data-entry assistant. You will be given an image of a sales call form that a sales representative filled out by hand or on screen. Read the form carefully and extract its contents into structured data.

Rules:
- Extract values only from what is visibly written on the form. Do not infer or invent values.
- If a field is blank or unreadable on the form, use null for a scalar field or an empty array for a list field.
- Normalise obvious formatting (e.g. currency amounts to plain numbers) but never change the meaning.

Your response MUST conform exactly to this JSON schema:
{{schema}}`;

/**
 * Common comparison instruction, shared across all companies. Reconciles the
 * rep's self-reported form datapoints against what the transcript shows.
 */
const COMPARISON_PROMPT = `You are a sales-operations auditor. You are given (a) the structured form a sales representative filled out after a call, and (b) the transcript of that call. For each field the rep reported, determine whether it is supported by the transcript.

For every field in the rep form, produce a finding with:
- field: the field name.
- repValue: what the rep reported for that field.
- transcriptValue: what the transcript actually indicates for that field (null if the transcript says nothing about it).
- status: "match" if the rep's value agrees with the transcript, "mismatch" if it contradicts the transcript, or "partial" if it is partially correct or only partially supported.
- note: a brief explanation citing the transcript where relevant.

Then provide an overall alignmentScore from 0 to 100 reflecting how faithfully the rep's form represents what happened on the call.

Rules:
- Base every judgement strictly on the transcript. Do not invent details.
- If the transcript does not mention a field, set transcriptValue to null and status to "partial".

Your response MUST be a JSON object of exactly this shape:
{
  "alignmentScore": <number 0-100>,
  "findings": [
    { "field": <string>, "repValue": <any>, "transcriptValue": <any>, "status": "match" | "mismatch" | "partial", "note": <string> }
  ]
}

Rep form (JSON):
{{form}}

Transcript:
{{transcript}}`;

/**
 * Common objection-resolution synthesis instruction, shared across all
 * companies. Interpolates the objection type and two sample buckets pulled
 * from the company's analyzed calls.
 */
const OBJECTION_SYNTHESIS_PROMPT = `You are a senior sales coach. You will be given real examples of how sales reps on one team handled the "{{objectionType}}" objection on live calls — first examples where the rep handled it successfully, then examples where the rep handled it badly or ignored it. Each example has a short summary of the rep's response and a verbatim transcript excerpt.

Synthesize what separates the winners from the losers, then write a practical playbook the team can use on their next call.

Rules:
- Base every pattern strictly on the examples given. Do not invent techniques that do not appear in them.
- Patterns must be specific and behavioral (what the rep said or did), not generic sales advice.
- The suggested script should sound natural when spoken aloud and reflect the winning examples.
- 2 to 4 winning patterns, 2 to 4 losing patterns, 3 to 5 items each in "do" and "dont".

Your response MUST be a JSON object of exactly this shape:
{
  "winningPatterns": [ { "pattern": <short name>, "description": <1-2 sentences on what reps did and why it worked> } ],
  "losingPatterns": [ { "pattern": <short name>, "description": <1-2 sentences on what reps did and why it failed> } ],
  "playbook": {
    "do": [ <imperative coaching point> ],
    "dont": [ <imperative coaching point> ],
    "suggestedScript": <a short spoken script the rep can adapt>
  }
}

Successful examples:
{{successfulSamples}}

Unsuccessful examples:
{{unsuccessfulSamples}}`;

@Injectable()
export class PromptBuilderService {
  /**
   * Builds the call-analysis prompt: interpolates {{transcript}} and {{schema}}
   * into the per-tenant template prompt and appends the strict JSON instruction.
   */
  build(
    promptTemplate: string,
    transcript: string,
    outputSchema: Record<string, unknown>,
  ): string {
    const interpolated = promptTemplate
      .replace(/\{\{transcript\}\}/g, transcript)
      .replace(/\{\{schema\}\}/g, JSON.stringify(outputSchema, null, 2));

    return `${interpolated}\n\n${STRICT_JSON_INSTRUCTION}`;
  }

  /**
   * Builds the form-extraction prompt from the common template, interpolating
   * the per-company formSchema. The form image is passed separately to the
   * vision call, not embedded here.
   */
  buildExtraction(formSchema: Record<string, unknown>): string {
    const interpolated = FORM_EXTRACTION_PROMPT.replace(
      /\{\{schema\}\}/g,
      JSON.stringify(formSchema, null, 2),
    );

    return `${interpolated}\n\n${STRICT_JSON_INSTRUCTION}`;
  }

  /**
   * Builds the comparison prompt from the common template, interpolating the
   * rep's extracted form datapoints ({{form}}) and the transcript ({{transcript}}).
   */
  /**
   * Builds the objection-resolution synthesis prompt from the common template,
   * interpolating the objection type and the successful/unsuccessful sample
   * buckets (serialized as JSON).
   */
  buildObjectionSynthesis(
    objectionType: string,
    successfulSamples: unknown[],
    unsuccessfulSamples: unknown[],
  ): string {
    const interpolated = OBJECTION_SYNTHESIS_PROMPT.replace(
      /\{\{objectionType\}\}/g,
      objectionType,
    )
      .replace(
        /\{\{successfulSamples\}\}/g,
        JSON.stringify(successfulSamples, null, 2),
      )
      .replace(
        /\{\{unsuccessfulSamples\}\}/g,
        JSON.stringify(unsuccessfulSamples, null, 2),
      );

    return `${interpolated}\n\n${STRICT_JSON_INSTRUCTION}`;
  }

  buildComparison(
    transcript: string,
    formDatapoints: Record<string, unknown>,
  ): string {
    const interpolated = COMPARISON_PROMPT.replace(
      /\{\{form\}\}/g,
      JSON.stringify(formDatapoints, null, 2),
    ).replace(/\{\{transcript\}\}/g, transcript);

    return `${interpolated}\n\n${STRICT_JSON_INSTRUCTION}`;
  }
}
