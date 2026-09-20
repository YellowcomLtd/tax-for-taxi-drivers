import type { ImageMetadata } from 'astro';
import placeholderDesk from '../assets/images/insights/placeholder-desk.svg';
import placeholderForms from '../assets/images/insights/placeholder-forms.svg';
import placeholderCalendar from '../assets/images/insights/placeholder-calendar.svg';
import placeholderNotes from '../assets/images/insights/placeholder-notes.svg';
import placeholderLaptop from '../assets/images/insights/placeholder-laptop.svg';

export type InsightCoverKey = 'desk' | 'forms' | 'calendar' | 'notes' | 'laptop';

const covers: Record<InsightCoverKey, ImageMetadata> = {
  desk: placeholderDesk,
  forms: placeholderForms,
  calendar: placeholderCalendar,
  notes: placeholderNotes,
  laptop: placeholderLaptop,
};

/** Default cover + related services when a post does not set them in frontmatter. */
const defaults: Record<string, { cover: InsightCoverKey; relatedServices: string[] }> = {
  'self-assessment-deadlines-2026-27': {
    cover: 'calendar',
    relatedServices: ['self-assessment', 'hmrc-penalty-appeals', 'making-tax-digital'],
  },
  'making-tax-digital-for-taxi-drivers': {
    cover: 'laptop',
    relatedServices: ['making-tax-digital', 'income-expenditure-records', 'self-assessment'],
  },
  'what-happens-if-hmrc-opens-a-tax-check': {
    cover: 'forms',
    relatedServices: ['hmrc-tax-check', 'hmrc-investigations', 'self-assessment'],
  },
  'uber-bolt-deliveroo-income-and-tax': {
    cover: 'notes',
    relatedServices: ['self-assessment', 'income-expenditure-records', 'making-tax-digital'],
  },
  'five-tax-mistakes-taxi-drivers-make': {
    cover: 'desk',
    relatedServices: ['self-assessment', 'income-expenditure-records', 'hmrc-penalty-appeals'],
  },
  'state-pension-forecasts-for-self-employed-drivers': {
    cover: 'notes',
    relatedServices: ['pensions-national-insurance', 'self-assessment', 'benefit-claims'],
  },
  'using-an-income-expenditure-system': {
    cover: 'forms',
    relatedServices: ['income-expenditure-records', 'self-assessment', 'making-tax-digital'],
  },
  'what-can-taxi-drivers-claim-as-an-expense': {
    cover: 'desk',
    relatedServices: ['income-expenditure-records', 'self-assessment', 'loss-of-earnings'],
  },
  'registering-as-self-employed-first-time': {
    cover: 'calendar',
    relatedServices: ['self-assessment', 'income-expenditure-records', 'pensions-national-insurance'],
  },
  'phv-vs-hackney-carriage-tax': {
    cover: 'laptop',
    relatedServices: ['self-assessment', 'hmrc-tax-check', 'benefit-claims'],
  },
};

export function getInsightCover(postId: string, cover?: InsightCoverKey): ImageMetadata {
  const key = cover ?? defaults[postId]?.cover ?? 'desk';
  return covers[key];
}

export function getInsightRelatedServices(postId: string, fromFrontmatter: string[] = []): string[] {
  if (fromFrontmatter.length > 0) return fromFrontmatter;
  return defaults[postId]?.relatedServices ?? ['self-assessment', 'making-tax-digital', 'income-expenditure-records'];
}

export const PLACEHOLDER_IMAGE_ALT =
  'Illustration for a Tax for Taxi Drivers insights article';
