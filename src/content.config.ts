import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const reviews = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reviews' }),
  schema: z.object({
    quote: z.string(),
    attribution: z.string(),
    rating: z.number().min(1).max(5).default(5),
    date: z.coerce.date().optional(),
    source: z.enum(['concept-site', 'whiteboard']).default('concept-site'),
    featured: z.boolean().default(false),
  }),
});

const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
    placeholder: z.boolean().default(false),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    shortTitle: z.string(),
    description: z.string(),
    icon: z.string(),
    order: z.number(),
    /** Show on homepage / services index card grid */
    card: z.boolean().default(true),
    cardText: z.string(),
    heroLead: z.string(),
    planNote: z.string().optional(),
    relatedServices: z.array(z.string()).default([]),
    relatedInsights: z.array(z.string()).default([]),
    faqs: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      )
      .default([]),
  }),
});

export const collections = { reviews, insights, services };
