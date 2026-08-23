# CLAUDE.md — Tax for Taxi Drivers (Belfast) Website Rebuild

## Project summary
Rebuild the brochure site for Tax for Taxi Drivers, a Belfast firm helping taxi drivers with Self Assessment, business accounts, and Making Tax Digital returns. Built by Yellowcom (Jack, Digital Project Manager) for a client who sells trust and personal service, not just compliance.

Foundation file: `taxfortaxidrivers-concept.html` (boss's concept, single-file HTML/CSS). Use its structure and CSS variable system as the starting point — don't rebuild from scratch. Strip out anything that reads as "iconic American taxi" (yellow-cab imagery, checker-flag/checker-pattern motifs, Impact/condensed display type evoking a NYC taxi meter, the "meter" HUD widget in the hero) and replace with a modern, clean B2B-services aesthetic. Keep the yellow brand accent color, just apply it like a professional fintech/accountancy brand would, not a taxi livery.

## Client positioning
The client's differentiator is the personal, face-to-face relationship — he wants photography of real people (him, his team, clients) to carry a lot of the design weight, not stock icons or illustration. Treat photography as a primary layout element: large hero image of the client/team, photography breaking up the About and Services sections, not just decorative thumbnails.

## Design direction
- Move from "taxi novelty" to "trusted local advisor." Think: modern accountancy/professional-services site — generous whitespace, confident typography, restrained colour, real photography.
- Keep: the yellow accent, the black/paper colour system, the card and section rhythm already in the concept file.
- Drop: checker patterns, meter/dashboard HUD graphic, taxi-cab visual puns, Anton/Impact-style display font if it reads too "cab company." Reassess type pairing — favour something confident but not shouty.
- Reference for tone/copy: the client's existing site is https://taxfortaxidrivers.co.uk/home — **note: this site blocks automated fetching (robots.txt), so it cannot be scraped programmatically.** Ask Jack to manually copy across the About Us text and any preferred phrasing before content work starts, or paste key paragraphs into the chat for Claude to work from.

## Navigation (client-approved structure — this supersedes anything in the concept file)
Home / About / Services / Reviews / Insights / Contact Us

- Insights = a blog/news-style section (space for tax tips, deadline reminders, MTD updates). Build the page shell even if the client doesn't have posts yet — a simple listing template plus one placeholder post is fine for launch.
- Reviews is its own nav item, not just a homepage section (see Reviews section below).

## Pricing table (Bronze / Silver / Gold)
Replace the current 3-card cost comparison layout entirely. Client has supplied the real pricing/services grid in `Tax_for_Taxi_Drivers_Tax_Made_Easy_Services_List.png` — this goes on the **homepage**, not just a dedicated pricing page.

Build it as a proper comparison table (not cards):
- Rows = individual services (Register for Self Assessment, Register with HMRC, Income & Expenditure recording system, Prepare/Submit Self Assessment return, Prepare/supply Income & Expenditure account, Tax saving recommendations, HMRC Tax Check, Pension Forecast, Loss of Earnings calculations, Referrals to Chartered Accountant, MTD tax returns, Telephone support, HMRC investigation support).
- Columns = Bronze (£45/mo), Silver (£50/mo), Gold (£55/mo), all billed by Direct Debit.
- Ticks per plan exactly as shown in the reference image — Bronze is the base tier, Silver adds tax check/pension forecast/loss-of-earnings/referrals/MTD/phone support, Gold adds HMRC investigation cover.
- Include the "Other Services" à la carte list underneath (Consultations £50, Letters £50, References £50, Passport Verification £50, HMRC Tax Checks £50, Setup Government Gateway Account £100, State Pension Forecast £150, Loss of Earnings Calculations £150, MTD fees by arrangement).
- Responsive requirement: on mobile this needs to not collapse into an unreadable table — consider a stacked-card fallback per plan below a breakpoint, or a horizontally scrollable table with sticky first column.
- Highlight Silver as "Most popular" per the existing `.plan.feat` pattern in the concept CSS, unless the client says otherwise.

## Reviews page — wordcloud
Jack will supply a Word doc of reviews collected from an in-person whiteboard at the client's premises. Build a dedicated Reviews page (not just the homepage quote grid) as a **wordcloud-style layout**:
- Each review renders as a floating text block, varying font-size and opacity to create visual hierarchy (bigger/more opaque = presumably more impactful or just for visual variety — confirm with Jack whether sizing should be random or weighted by something, e.g. length or a manual "featured" flag).
- Fade-in animation on scroll/load per item (stagger the fade-ins rather than firing all at once — use IntersectionObserver, respect `prefers-reduced-motion`).
- Keep the existing quote-card grid as a fallback/secondary treatment if the wordcloud proves hard to read on mobile — legibility beats novelty; don't let the effect make reviews unreadable.
- Once Jack shares the Word doc, extract review text + attribution (first name/initial is fine, do not fabricate names or star ratings not present in the source).

## Content sourcing rules
- Concept file (`taxfortaxidrivers-concept.html`) governs structure/section order/CSS system unless this doc overrides it.
- Live site (taxfortaxidrivers.co.uk) governs *tone of voice and factual content* (About Us, service descriptions) — get this pasted in manually, don't assume Claude can fetch it.
- Services list image governs the pricing table exactly — don't reword or reorder line items without asking.
- Do not invent testimonials, credentials, or claims (e.g. number of years trading, number of clients) that aren't confirmed by the client.

## Tech stack
- **Astro.** Content Collections for Reviews and Insights (each review/post as a content entry rather than hardcoded markup), component-based layout (`.astro` components for Nav, Footer, PricingTable, ReviewCard, etc.), islands/partial hydration only where interactivity is actually needed (wordcloud fade-ins, any filtering on Insights).
- No WordPress/Elementor, no separate CMS/backend — content lives in the repo (Markdown/MDX for reviews and posts) unless a real need for a headless CMS shows up later.
- Static output (SSG) is the default assumption for a brochure site of this size — confirm with Jack if any page needs SSR (unlikely).

## Build notes
- Standalone Astro brochure build, produced and maintained entirely through Claude Code. Componentise rather than replicate the concept file's single-page structure — separate `.astro` components/layouts per section (Hero, Promise, Services, Pricing, Reviews, CTA, Footer) so they're reusable across Home/About/Services/Reviews/Insights/Contact.
- Reviews and Insights posts as Content Collections entries (frontmatter + body) so adding a new review or blog post later doesn't require touching layout code.
- Keep JS minimal — only hydrate the interactive bits (wordcloud animation, any nav/menu toggle) rather than shipping a framework-heavy page.
- Deployment target not yet confirmed — ask Jack where this needs to end up (Netlify/Vercel/Yellowcom infrastructure) once the build is further along.
- Photography: use clearly-marked placeholder images until real photography is supplied; flag every placeholder so Jack can swap them before launch — don't let a placeholder ship un-flagged.
- Accessibility: real colour contrast on yellow (`--yellow`/`--yellow-deep`) against text — the concept file already treats yellow as an accent behind dark text; keep checking contrast when applying it to new components (e.g. pricing "Most popular" tag, nav highlights).
- Respect `prefers-reduced-motion` for all new animation (wordcloud fade-ins, any scroll effects).

## Open questions for Jack before/while building
1. Wordcloud sizing logic — random variety, or weighted by something specific?
2. Insights section — any real posts ready, or ship with placeholder/empty state?
3. Does "Most popular" tag stay on Silver, or does the client want a different tier flagged?
4. Where does this get deployed once built — Netlify, Vercel, or Yellowcom's own infrastructure? (Affects which Astro adapter to configure.)
