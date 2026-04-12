/**
 * publishProductsToStorefront
 * Uses GraphQL publishablePublish to properly attach all products to the Online Store channel.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function graphql(domain, token, query, variables = {}) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function restGet(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  return res.json();
}

async function restPut(domain, token, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify(body),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session.' }, { status: 401 });

  // Step 1: Get the Online Store publication ID via GraphQL
  const pubRes = await graphql(shopDomain, token, `{
    publications(first: 10) {
      edges {
        node {
          id
          name
        }
      }
    }
  }`);

  const publications = pubRes?.data?.publications?.edges || [];
  const onlineStore = publications.find(e =>
    e.node.name === 'Online Store' || e.node.name?.toLowerCase().includes('online store')
  );
  const publicationId = onlineStore?.node?.id;

  // Step 2: Get all products via REST (up to 250)
  const data = await restGet(shopDomain, token, 'products.json?limit=250&fields=id,title,status');
  const products = data.products || [];

  // Step 3: First set all to active via REST
  let activated = 0;
  for (const product of products) {
    if (product.status !== 'active') {
      await restPut(shopDomain, token, `products/${product.id}.json`, {
        product: { id: product.id, status: 'active' }
      });
      activated++;
      await new Promise(r => setTimeout(r, 150));
    }
  }

  // Step 4: Publish to Online Store via GraphQL publishablePublish
  let published = 0;
  let failed = 0;
  const errors = [];

  if (publicationId) {
    for (const product of products) {
      const gid = `gid://shopify/Product/${product.id}`;
      const result = await graphql(shopDomain, token, `
        mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            publishable {
              publishedOnCurrentPublication
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        id: gid,
        input: [{ publicationId }]
      });

      const errs = result?.data?.publishablePublish?.userErrors || [];
      if (errs.length > 0) {
        failed++;
        errors.push({ id: product.id, title: product.title, error: errs.map(e => e.message).join(', ') });
      } else {
        published++;
      }
      await new Promise(r => setTimeout(r, 100));
    }
  } else {
    // Fallback: REST published_at approach
    const publishedAt = new Date().toISOString();
    for (const product of products) {
      await restPut(shopDomain, token, `products/${product.id}.json`, {
        product: { id: product.id, status: 'active', published: true, published_at: publishedAt, published_scope: 'web' }
      });
      published++;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return Response.json({
    success: true,
    total: products.length,
    activated,
    published,
    failed,
    publication_used: onlineStore?.node?.name || 'REST fallback',
    publication_id: publicationId || null,
    errors: errors.slice(0, 10),
  });
});