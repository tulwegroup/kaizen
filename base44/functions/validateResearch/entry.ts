/**
 * validateResearch
 * Cross-checks AI-generated research products against real market signals.
 * Flags potential hallucinations and validates pricing/trend accuracy.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const { products, job_id } = await req.json();

  let productList = products;

  // If job_id provided, load from ImportJob
  if (!productList && job_id) {
    const jobs = await base44.asServiceRole.entities.ImportJob.filter({ id: job_id });
    if (jobs.length && jobs[0].products_raw) {
      productList = JSON.parse(jobs[0].products_raw);
    }
  }

  if (!productList?.length) return Response.json({ error: 'products array or job_id required' }, { status: 400 });

  const today = new Date().toISOString().split('T')[0];

  // Validate in a single AI call — pass all product names + claimed signals
  const productSummary = productList.slice(0, 20).map((p, i) =>
    `${i + 1}. "${p.product_name}" | type: ${p.product_type} | trend: ${p.search_trend} | niche: ${p.niche} | region: ${p.region} | price: $${p.recommended_sell_price} | why: ${p.why_it_works}`
  ).join('\n');

  const validation = await base44.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    add_context_from_internet: true,
    prompt: `Today is ${today}. You are a strict e-commerce market analyst validating AI-generated product research for accuracy.

Review these ${productList.slice(0, 20).length} products and assess each one:

${productSummary}

For each product, evaluate:
1. Is this a REAL product category that actually sells online? (not made up)
2. Is the trend signal plausible for ${today}? (rising/peak/stable accuracy)
3. Is the pricing realistic for this product type and source?
4. Does the "why_it_works" signal sound real or hallucinated?
5. Overall verdict: VALIDATED / PLAUSIBLE / SUSPECT / HALLUCINATED

Return a validation_summary and per-product results. Be strict — flag anything that sounds invented or exaggerated.`,
    response_json_schema: {
      type: 'object',
      properties: {
        validation_summary: { type: 'string' },
        overall_quality_score: { type: 'number' },
        validated_count: { type: 'number' },
        suspect_count: { type: 'number' },
        hallucinated_count: { type: 'number' },
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_name: { type: 'string' },
              verdict: { type: 'string' },
              real_product: { type: 'boolean' },
              trend_accurate: { type: 'boolean' },
              pricing_realistic: { type: 'boolean' },
              signal_credible: { type: 'boolean' },
              notes: { type: 'string' },
              real_examples: { type: 'string' },
            }
          }
        }
      }
    }
  });

  return Response.json({
    success: true,
    validated_at: new Date().toISOString(),
    total_products: productList.length,
    validated_sample: productList.slice(0, 20).length,
    ...validation,
  });
});