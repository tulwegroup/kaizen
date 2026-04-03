import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const session = sessions[0];

  if (!session) return Response.json({ error: 'No session found' });

  // Check scopes stored in DB
  const storedScope = session.scope;

  // Also verify token is live by calling Shopify
  const res = await fetch(`https://${shopDomain}/admin/api/2024-10/shop.json`, {
    headers: { 'X-Shopify-Access-Token': session.access_token }
  });

  const shopData = res.ok ? await res.json() : null;

  return Response.json({
    stored_scope: storedScope,
    has_write_themes: storedScope?.includes('write_themes'),
    token_valid: res.ok,
    token_status: res.status,
    shop_name: shopData?.shop?.name,
    session_created: session.created_date,
    session_updated: session.updated_date,
  });
});