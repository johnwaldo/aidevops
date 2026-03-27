# Chapter 2: AI-Powered Creative Production

## AI Image Generation

| Platform | Strength | Best for |
|----------|----------|----------|
| **Midjourney** | Artistic quality | Concept art, hero images, backgrounds. V6: text rendering, photorealism |
| **DALL-E 3** | Prompt adherence, ChatGPT integration | Marketing materials with text, editorial, social media |
| **Stable Diffusion** | Control, open source | High-volume, custom brand models. ControlNet, inpainting, img2img |
| **Adobe Firefly** | Commercial safety | Lower legal risk (Adobe Stock trained). Native in Photoshop, Illustrator, Express |

### Prompt Engineering

**Structure:** `[Subject] + [Action/Context] + [Environment] + [Style/Medium] + [Lighting] + [Camera/Technical] + [Quality]`

**Techniques:** (1) Specificity — "young professional checking iPhone 15 Pro in minimalist coffee shop, morning light" beats "person using phone" (2) Style refs — "In the style of [artist]" / "Photographed by [photographer]" (3) Camera params — body, lens, film stock, lighting (4) Negative prompts — "No text, no watermarks, no distortion" (5) Weight — Midjourney `::` syntax; SD `((word))`

```text
Product: "[Product] on [surface], [lighting], shallow DOF, commercial photography, [brand style], 8k"
Lifestyle: "[Person] [activity] in [location], candid, natural lighting, documentary style, warm tones, 35mm"
Abstract: "Abstract visualization of [concept], [color palette], [art style], flowing forms, gallery quality"
```

### Applications and Legal

- **Concept pipeline:** Generate 20-30 concepts → stakeholder review → refine → production
- **Multi-platform:** 1:1 (Instagram), 9:16 (Stories/TikTok), 16:9 (YouTube), 4:5 (Facebook). Batch via spreadsheet prompts.
- **Copyright:** Use AI as starting points, not finals; document process. Rights: Midjourney (commercial/paid), DALL-E (full), SD (license-dependent), Firefly (commercial-safe)
- **Disclosure:** Meta requires AI disclosure in political ads; emerging requirements across platforms

---

## AI Copywriting

| Platform | Strength | Best for |
|----------|----------|----------|
| **ChatGPT/GPT-4** | Versatile, multi-language | Ad concepts, headlines, landing pages, email, video scripts |
| **Claude** | 200K context, nuanced tone | Long-form sales, brand voice, complex campaigns |
| **Jasper** | Marketing templates | AIDA, PAS, SEO/Surfer integration, team collaboration |
| **Copy.ai** | Speed, 90+ templates | Quick headlines, social captions, brainstorming |

### Framework Prompts

```text
AIDA: Write [format] using AIDA. Product: [name]. Audience: [demo/psycho]. Benefits: [list].
  UVP: [differentiator]. CTA: [action]. Generate 5 variations with hook, interest, desire, action.

PAS: Create [format] using PAS. Problem: [pain]. Agitation: [consequences]. Solution: [product].
  Requirements: visceral problem, amplified agitation, natural solution, proof points.

4P's: Write [format] — Picture: aspirational outcome. Promise: specific commitment.
  Prove: evidence/social proof. Push: urgency + next step. Context: [product, audience, objectives].
```

### Platform-Specific Copy

```text
Social: Write [platform] ad for [product]. Limit: [N] chars. Hook: [interrupt/question/statement].
  Message: [benefit]. CTA: [action]. Generate: curiosity, benefit, social proof, urgency approaches.

Email: Write email for [objective]. Segment: [audience]. Stage: [new/engaged/lapsed].
  Generate: 10 subject lines, opening with [context], body [AIDA/PAS/Story], 3 CTAs, P.S.
```

**Google RSA:** 15 headlines (30 chars), 4 descriptions (90 chars). Cover: benefits, features, urgency, social proof, questions.

### Brand Voice and Persuasion

**Voice template:** `Dimension: [Playful vs. Serious] | We say: [example] | We don't say: [counter-example]`. Few-shot: provide 3+ approved examples, then "Write [content] in same voice."

**Persuasion triggers:** Social proof (stat/testimonial), scarcity (time/quantity), authority (credential), reciprocity (value). **Emotional drivers:** Fear (FOMO), Greed (savings), Pride (status), Belonging (community), Curiosity (knowledge gaps).

---

## Creative Testing and DCO

### Analysis Platforms

VidMob (element analysis, performance prediction) | CreativeX (quality scoring, brand compliance) | Pattern89 (predictive analytics, fatigue prediction). Computer vision detects: faces, colors, objects, scenes, text/logo placement, composition.

### Dynamic Creative Optimization

**Architecture:** Visual (backgrounds, products, lifestyle) + Messaging (headlines, body, CTAs) + Data (feeds, pricing, inventory) + Rules (targeting, triggers, optimization).

**Decisioning:** New Visitors → "Welcome Offer" | Cart Abandoners → "Still Thinking?" | Past Customers → "Welcome Back, [Name]". Context: Morning → energy | Rainy → cozy | Mobile → vertical.

**Workflow:** Upload components → define rules → set goals → generate variations → distribute traffic → shift budget to winners. **Scale:** 5 hooks x 3 backgrounds x 4 products x 3 CTAs = 180 variations.

**Platforms:** Meta Dynamic Creative | Google Responsive Display | Celtra (cross-channel) | Jivox (commerce) | Thunder/Salesforce (CRM).

**By vertical:** E-commerce (catalog sync, real-time pricing, browse/cart triggers) | Travel (destination imagery + dates + scarcity) | Financial (compliance-approved messaging, real-time rates, credit tiers).

### Fatigue Detection

**Signals:** Increasing CPM, decreasing CTR, falling conversions, rising frequency. **AI responses:** Auto-refresh, rotation to backup, frequency caps, audience expansion. **Pre-flight prediction:** Historical + audience + platform → expected CTR, conversion probability, optimal matching.

---

## Personalization at Scale

**Dimensions:** Demographic (Gen Z: mobile-native | Millennials: value-driven | Gen X: practical | Boomers: trust) | Behavioral (abandonment: show exact products | purchase history: complementary/upgrades) | Psychographic (sustainability → environmental | status → premium | value → savings) | Contextual (morning → productivity | evening → relaxation | weather-adaptive).

**CDPs:** Segment, mParticle, Tealium, Adobe Real-Time CDP, Salesforce CDP. **Engines:** Evergage/Salesforce (behavioral triggers) | Dynamic Yield (AI recommendations) | Optimizely (experimentation).

**Modular creative:** Backgrounds (5) x Products (10) x Headlines (20) x CTAs (10) x Overlays (5) = 50,000 combinations. Rules: Background → location | Product → browse history | Headline → life stage | CTA → funnel position.

**Video personalization:** Idomoo, SundaySky, Vidyard, Hippo Video. Structure: [Name] + [Category] → [Industry/Role] scenes → [Company Size] testimonials → segment pricing → personalized URL/QR.

**Privacy-first:** Contextual targeting (no personal data) | First-party data (value exchange, progressive profiling, loyalty) | Privacy-preserving tech (differential privacy, federated learning, on-device).

**Measuring:** Engagement (CTR lift, completion rates) | Conversion (rate lift, AOV) | Business (ROAS, CAC, LTV) | Testing (holdout, incrementality, geo-holdout).

---

## AI Creative Strategy

**Competitive intelligence:** Sources: Meta Ad Library, Google Ads Transparency, social monitoring. Tools: Pathmatics, Social Ad Scout, Semrush, SpyFu, Brandwatch. Analyze: volume/velocity, messaging themes, visual patterns, offers, channels.

**Audience intelligence:** Psychographic profiling, interest graphs, content consumption, lookalike expansion. Insight → creative: tutorial engagement → educational ads | visual preference → image/video-heavy | price sensitivity → value messaging | premium affinity → quality positioning.

**Concept generation:** Input (objective, audience, brand, competitive, platform) → AI (concepts, metaphors, angles, hooks) → Human (judgment, brand fit, feasibility, selection).

**Performance prediction:** Creative elements + historical + audience + platform + competitive → scores, KPI ranges, risk assessments. Use: screen before production, prioritize high-probability, budget pacing, refresh timing.

---

## Integrating AI into Workflows

| Phase | AI Role | Human Role |
|-------|---------|-----------|
| Discovery | Research, competitive analysis, trend ID, concepts | Strategy, brand vision |
| Concept | Visuals, copy variations, mood boards | Evaluation, brand fit |
| Production | Generation, editing, format adaptation | QC, guidelines, approval |
| Testing | Automated testing, analysis, fatigue detection | Interpretation, iteration, budget |

**Pipeline:** ChatGPT concepts + competitive tools → brief → Midjourney visuals + Copy.ai headlines + Firefly refinement → assets → Meta/Google + DCO → performance data → AI analysis + auto-refresh → refined creative.

**Emerging roles:** AI Creative Strategist (prompt engineering, tool mastery) | Creative Technologist (integration, automation, fine-tuning) | Performance Analyst (testing, insights). Traditional evolution: Copywriters → strategy | Designers → art direction | Producers → orchestrate AI + human.

**QA:** Checkpoints: concept → asset review → performance analysis → brand safety. Common errors: visual artifacts, text errors, factual inaccuracies, tone/cultural issues. Mitigation: brand guidelines for AI, review workflows, bias testing, diverse evaluation.
