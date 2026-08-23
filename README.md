# Tax for Taxi Drivers — website rebuild

Astro brochure site for Tax for Taxi Drivers (Belfast). Built by Yellowcom.

Read [`CLAUDE.md`](./CLAUDE.md) first — it's the project brief and governs structure, content sourcing, and open questions with the client.

## Project structure

```text
/
├── reference/            # Client-supplied source material: concept HTML, photography, pricing image
├── public/                # Static assets served as-is (favicon)
├── src/
│   ├── assets/images/     # Client photography, processed through Astro's image pipeline
│   ├── components/        # Reusable section components (Nav, Hero, PricingTable, ReviewCard, ...)
│   ├── content/            # Content Collections: reviews/ and insights/ (Markdown entries)
│   ├── content.config.ts # Schemas for the reviews and insights collections
│   ├── layouts/           # BaseLayout.astro — shared head, nav, footer
│   ├── pages/             # File-based routes (Home, About, Services, Reviews, Insights, Contact)
│   └── styles/global.css # Design tokens and shared base styles
└── astro.config.mjs
```

## Commands

| Command           | Action                                        |
| :----------------- | :--------------------------------------------- |
| `npm install`       | Install dependencies                           |
| `npm run dev`       | Start local dev server at `localhost:4321`     |
| `npm run build`     | Build the production site to `./dist/`         |
| `npm run preview`   | Preview the production build locally           |
| `npx astro check`   | Type-check `.astro` files and content schemas  |

## Adding content

- **A new review**: add a Markdown file to `src/content/reviews/` with `quote`, `attribution`, `rating`, and `source` frontmatter (see existing files for the shape). Set `featured: true` to make it render larger on the `/reviews` wordcloud.
- **A new Insights post**: add a Markdown file to `src/content/insights/` with `title`, `description`, and `pubDate` frontmatter. Leave `draft: true` to keep it off the listing until ready.

## Known placeholders

Anywhere real client content is still missing, the page shows a visible dashed-border notice (see `src/components/PlaceholderNote.astro`) so it can't ship unnoticed — currently the About Us copy and the office address/hours on the Contact page. See `CLAUDE.md`'s "Open questions for Jack" section for the rest.
