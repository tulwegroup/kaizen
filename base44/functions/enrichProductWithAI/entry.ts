/**
 * enrichProductWithAI — Smart Product Agent
 * Takes a raw research product and generates:
 * - SEO-optimized title
 * - Compelling product description (HTML)
 * - Bullet-point features
 * - Search tags
 * - Suggested price + sale price
 * - Shopify product type & vendor
 * - AliExpress/Alibaba/Temu sourcing keywords
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { product } = await req.json();
  if (!product?.product_name) return Response.json({ error: 'product required' }, { status: 400 });

  const isDigital = product.product_type === 'digital' || product.estimated_cogs === 0;

  const enriched = await base44.integrations.Core.InvokeLLM({
    model: 'claude_sonnet_4_6',
    prompt: `You are an expert Shopify e-commerce copywriter and product manager. Your job is to turn raw product research data into a fully optimized, conversion-ready Shopify product listing.

Product to enrich:
- Name: ${product.product_name}
- Type: ${product.product_type || 'physical'}
- Niche: ${product.niche}
- Why it works: ${product.why_it_works}
- Target audience: ${product.target_audience}
- Top platforms: ${(product.top_platforms || []).join(', ')}
- Cost price: $${product.estimated_cogs}
- Sell price: $${product.recommended_sell_price}
- Region: ${product.region}

Your task:
1. Write a punchy, SEO-optimized TITLE (60–80 chars) — include key benefit + product name
2. Write a compelling SHORT DESCRIPTION (2-3 sentences) for the storefront — hook-driven, benefit-first, no fluff
3. Write a full HTML BODY DESCRIPTION (400–600 words) — with sections: Why You'll Love It, Key Features, Who It's For, What's Included. Use <h3>, <p>, <ul> tags. No inline styles.
4. Write 5–7 BULLET POINTS (short, benefit-first, under 15 words each)
5. Generate 8–12 TAGS — mix of: product name keywords, niche, trend keywords, audience, use-case
6. Suggest a COMPARE_AT_PRICE (should be 20–40% higher than sell price, to show a "sale")
7. Write a SEO_TITLE (under 70 chars) and SEO_DESCRIPTION (under 160 chars) for Google
8. Suggest the Shopify PRODUCT_TYPE (e.g. "Wellness Devices", "Digital Templates", "Home & Kitchen")
9. Generate 3 ALIEXPRESS_KEYWORDS — exact search terms to find this on AliExpress/AliDrop (if physical)
10. Generate 3 ALIBABA_KEYWORDS — search terms for Alibaba wholesale sourcing (if physical)
11. Generate 3 TEMU_KEYWORDS — search terms for Temu (if physical)
12. Write a VENDOR_NAME suggestion (brand-style, e.g. "GlowCraft", "TechNest", "HomeBliss")

Be conversion-focused. Write for impulse buyers. Keep it human, exciting, and trustworthy.`,
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        short_description: { type: 'string' },
        body_html: { type: 'string' },
        bullet_points: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        compare_at_price: { type: 'number' },
        seo_title: { type: 'string' },
        seo_description: { type: 'string' },
        product_type: { type: 'string' },
        vendor_name: { type: 'string' },
        aliexpress_keywords: { type: 'array', items: { type: 'string' } },
        alibaba_keywords: { type: 'array', items: { type: 'string' } },
        temu_keywords: { type: 'array', items: { type: 'string' } },
      }
    }
  });

  return Response.json({
    success: true,
    original_product: product,
    enriched,
  });
});