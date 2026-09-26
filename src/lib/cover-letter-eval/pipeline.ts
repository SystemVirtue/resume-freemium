import { parseJsonAnswer } from '@/lib/ai/client';
import { AiRequest } from '@/lib/ai/types';
import {
  Ctx, Paragraph, RuleFlag, SourceRef, CHECK_SYSTEM, SYSTEM,
  convertVariant, detectVariant, enforceBannedChars, flagParagraphOpenings,
  flagRepetition, groundingPrompt, lettersToText, normaliseModelText,
  repairParagraphPrompt,
} from '@/lib/coverLetter';

export interface Grounding {
  sources: SourceRef[];
  unsupported: string[];
  misattributed: string[];
  echoes: string[];
  scopeInflation: string[];
  employerDescriptions: string[];
  pivots: string[];
  emptyOpenings: string[];
  structureFlags: string[];
  ruleFlags: RuleFlag[];
}

/** Signature compatible with useAi().run. */
export type RunFn = (req: AiRequest, label?: string) => Promise<string | null>;

const toSourceRef = (source: any): SourceRef | null => {
  if (typeof source === 'string') return source.trim() ? { claim: '', source: source.trim() } : null;
  if (source && typeof source === 'object') {
    const evidence = String(source.source || source.quote || '').trim();
    const claim = String(source.claim || '').trim();
    return evidence || claim ? { claim, source: evidence } : null;
  }
  return null;
};

const toRuleFlag = (rule: any): RuleFlag | null => {
  if (typeof rule === 'string') return rule.trim() ? { rule: rule.trim(), fragment: '' } : null;
  if (rule && typeof rule === 'object') {
    const name = String(rule.rule || '').trim();
    const fragment = String(rule.fragment || '').trim();
    return name || fragment ? { rule: name, fragment } : null;
  }
  return null;
};

const cleanGrounding = (grounding: any, previous?: Paragraph): Grounding => {
  const list = (value: unknown, fallback: unknown[] = []) => Array.isArray(value) ? value : fallback;
  return {
    sources: list(grounding?.sources, previous?.sources).map(toSourceRef).filter(Boolean) as SourceRef[],
    unsupported: list(grounding?.unsupported, previous?.unsupported).map(String).filter(Boolean),
    misattributed: list(grounding?.misattributed, previous?.misattributed).map(String).filter(Boolean),
    echoes: list(grounding?.echoes, previous?.echoes).map(String).filter(Boolean),
    scopeInflation: list(grounding?.scopeInflation, previous?.scopeInflation).map(String).filter(Boolean),
    employerDescriptions: list(grounding?.employerDescriptions, previous?.employerDescriptions).map(String).filter(Boolean),
    pivots: list(grounding?.pivots, previous?.pivots).map(String).filter(Boolean),
    emptyOpenings: list(grounding?.emptyOpenings, previous?.emptyOpenings).map(String).filter(Boolean),
    structureFlags: list(grounding?.structureFlags, previous?.structureFlags).map(String).filter(Boolean),
    ruleFlags: list(grounding?.rules ?? grounding?.ruleFlags, previous?.ruleFlags).map(toRuleFlag).filter(Boolean) as RuleFlag[],
  };
};

export const emptyGrounding = (): Grounding => ({
  sources: [], unsupported: [], misattributed: [], echoes: [], scopeInflation: [],
  employerDescriptions: [], pivots: [], emptyOpenings: [], structureFlags: [], ruleFlags: [],
});

const dismissedFindingKeys = (paragraph: Paragraph) => new Set(paragraph.dismissedFlags || []);

export const dismissedTextFor = (paragraph: Paragraph): string[] => {
  const dismissed = dismissedFindingKeys(paragraph);
  const fragments = [
    ...(paragraph.unsupported || []).filter((value) => dismissed.has(`unsupported:${value}`)),
    ...(paragraph.misattributed || []).filter((value) => dismissed.has(`misattributed:${value}`)),
    ...(paragraph.echoes || []).filter((value) => dismissed.has(`echoes:${value}`)),
    ...(paragraph.scopeInflation || []).filter((value) => dismissed.has(`scopeInflation:${value}`)),
    ...(paragraph.employerDescriptions || []).filter((value) => dismissed.has(`employerDescriptions:${value}`)),
    ...(paragraph.pivots || []).filter((value) => dismissed.has(`pivots:${value}`)),
    ...(paragraph.emptyOpenings || []).filter((value) => dismissed.has(`emptyOpenings:${value}`)),
    ...(paragraph.structureFlags || []).filter((value) => dismissed.has(`structureFlags:${value}`)),
    ...(paragraph.ruleFlags || []).filter((value) => dismissed.has(`rules:${value.rule}|${value.fragment}`)).map((flag) => flag.fragment),
    ...(paragraph.repetition || []).filter((value) => dismissed.has(`repetition:${value}`)),
  ];
  return [...new Set(fragments.filter(Boolean))];
};

export const flaggedChecks = (paragraph: Paragraph) => {
  const dismissed = dismissedFindingKeys(paragraph);
  return [
    ...(paragraph.unsupported || []).map((value) => `unsupported:${value}`),
    ...(paragraph.misattributed || []).map((value) => `misattributed:${value}`),
    ...(paragraph.echoes || []).map((value) => `echoes:${value}`),
    ...(paragraph.scopeInflation || []).map((value) => `scopeInflation:${value}`),
    ...(paragraph.employerDescriptions || []).map((value) => `employerDescriptions:${value}`),
    ...(paragraph.pivots || []).map((value) => `pivots:${value}`),
    ...(paragraph.emptyOpenings || []).map((value) => `emptyOpenings:${value}`),
    ...(paragraph.structureFlags || []).map((value) => `structureFlags:${value}`),
    ...(paragraph.ruleFlags || []).map((value) => `rules:${value.rule}|${value.fragment}`),
    ...(paragraph.repetition || []).map((value) => `repetition:${value}`),
  ].filter((key) => !dismissed.has(key));
};

export interface Pipeline {
  enforce: (raw: string | null) => string | null;
  postProcess: (list: Paragraph[]) => Paragraph[];
  ground: (base: Paragraph[], force?: boolean) => Promise<Paragraph[]>;
  repair: (input: Paragraph[], onlyIds?: Set<string>) => Promise<Paragraph[]>;
}

/**
 * The exact drafting pipeline used by CoverLetterCrafter, as pure functions over
 * an injected AI runner. Behavior mirrors the component 1:1 (including selective
 * grounding: only stale paragraphs re-check when onlyIds is supplied).
 */
export function createPipeline(run: RunFn, ctx: Ctx): Pipeline {
  const enforce = (raw: string | null): string | null => {
    if (!raw) return null;
    let output = enforceBannedChars(normaliseModelText(raw), ctx.rules || '');
    const target = ctx.style.english || 'uk';
    const current = detectVariant(output);
    if (current && current !== target) output = convertVariant(output, target);
    return output;
  };

  const postProcess = (list: Paragraph[]): Paragraph[] => {
    const processed = list.map((paragraph) => ({ ...paragraph, text: enforce(paragraph.text) || paragraph.text }));
    const openings = flagParagraphOpenings(processed.map((paragraph) => paragraph.text));
    return processed.map((paragraph, index) => ({ ...paragraph, repetition: [...flagRepetition(paragraph.text), ...(openings[index] || [])] }));
  };

  const ground = async (base: Paragraph[], force = false): Promise<Paragraph[]> => {
    const unchecked = force ? base : base.filter((paragraph) => paragraph.checkedText !== paragraph.text);
    if (!unchecked.length) return base;
    const text = await run({ prompt: groundingPrompt(ctx, unchecked.map((paragraph) => paragraph.text), base.map((paragraph) => paragraph.text)), system: CHECK_SYSTEM, json: true }, 'checking sources');
    const parsed = text ? parseJsonAnswer<{ paragraphs: any[] }>(text) : null;
    const valid = Array.isArray(parsed?.paragraphs) && parsed.paragraphs.length === unchecked.length && parsed.paragraphs.every((result) => result && typeof result === 'object' && ['sources', 'unsupported', 'misattributed', 'echoes', 'scopeInflation', 'employerDescriptions', 'pivots', 'emptyOpenings', 'structureFlags'].every((key) => Array.isArray(result[key])) && Array.isArray(result.rules ?? result.ruleFlags));
    if (!valid) {
      const uncheckedIds = new Set(unchecked.map((paragraph) => paragraph.id));
      return base.map((paragraph) => uncheckedIds.has(paragraph.id) ? { ...paragraph, checksIncomplete: true } : paragraph);
    }
    let resultIndex = 0;
    const uncheckedIds = new Set(unchecked.map((paragraph) => paragraph.id));
    return base.map((paragraph) => {
      if (!uncheckedIds.has(paragraph.id)) return paragraph;
      const result = parsed!.paragraphs[resultIndex++];
      return { ...paragraph, ...cleanGrounding(result, paragraph), checkedText: paragraph.text, checksIncomplete: false };
    });
  };

  const repair = async (input: Paragraph[], onlyIds?: Set<string>): Promise<Paragraph[]> => {
    // Full re-grounding only when no onlyIds is supplied; selective repairs re-check just stale paragraphs.
    let current = await ground(postProcess(input), !onlyIds);
    const repairIds = onlyIds || new Set(current.filter((paragraph) => !paragraph.locked).map((paragraph) => paragraph.id));
    const attempts = new Map(current.map((paragraph) => [paragraph.id, 0]));
    const dismissedAtStart = new Map(current.map((paragraph) => [paragraph.id, dismissedTextFor(paragraph)]));
    const preservedById = new Map(current.map((paragraph) => [paragraph.id, paragraph.text]));
    for (let index = 0; index < current.length; index++) {
      let paragraph = current[index];
      while (repairIds.has(paragraph.id) && !paragraph.locked && (attempts.get(paragraph.id) || 0) < 2 && !paragraph.checksIncomplete) {
        const failures = flaggedChecks(paragraph);
        if (!failures.length) break;
        const attempt = (attempts.get(paragraph.id) || 0) + 1;
        attempts.set(paragraph.id, attempt);
        const response = await run({ prompt: repairParagraphPrompt(ctx, lettersToText(current), paragraph.text, failures, dismissedTextFor(paragraph)), system: SYSTEM, json: true }, `repair attempt ${attempt}`);
        const parsed = response ? parseJsonAnswer<{ paragraph?: string }>(response) : null;
        const replacement = parsed?.paragraph;
        if (!replacement || replacement === paragraph.text) break;
        const dismissedText = dismissedAtStart.get(paragraph.id) || [];
        if (dismissedText.some((fragment) => !replacement.includes(fragment))) {
          paragraph = { ...paragraph, checksIncomplete: true };
          current[index] = paragraph;
          break;
        }
        const repaired = { ...paragraph, text: enforce(replacement) || replacement, checkedText: undefined, checksIncomplete: false };
        const [grounded] = await ground([repaired], true);
        const updated = [...current];
        const updatedParagraph = grounded || repaired;
        const previousText = preservedById.get(paragraph.id);
        if (previousText && dismissedText.some((fragment) => !updatedParagraph.text.includes(fragment))) {
          updated[index] = { ...paragraph, checksIncomplete: true };
          current = updated;
          break;
        }
        updated[index] = updatedParagraph;
        current = postProcess(updated);
        const openingFlags = flagParagraphOpenings(current.map((item) => item.text));
        current = current.map((item, itemIndex) => {
          if (itemIndex === index) return { ...item, repetition: [...flagRepetition(item.text), ...(openingFlags[itemIndex] || [])] };
          return item;
        });
        paragraph = current[index];
      }
    }
    return current.map((paragraph) => {
      const previousText = preservedById.get(paragraph.id);
      const dismissedText = dismissedAtStart.get(paragraph.id) || [];
      if (previousText && dismissedText.length && paragraph.text !== previousText && dismissedText.some((fragment) => !paragraph.text.includes(fragment))) {
        return { ...paragraph, text: previousText, checksIncomplete: true };
      }
      return paragraph;
    });
  };

  return { enforce, postProcess, ground, repair };
}
