/**
 * fixThemeLiquid — patches deals-row and featured-products sections to show all products
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopifyGet(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  return res.json();
}

async function shopifyPut(domain, token, themeId, key, value) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: { key, value } }),
  });
  return res.json();
}

const DEALS_ROW_LIQUID = `<section class="deals-row-wrap">
  <div class="deals-row-head">
    <h2>🔥 Flash Deals</h2>
    <a href="/collections/flash-deals" class="view-all-link" style="color:#fff;">See all →</a>
  </div>
  <div class="deals-scroll">
    {% assign flash_col = collections['flash-deals'] %}
    {% assign deals_products = flash_col.products | default: collections.all.products %}
    {% for product in deals_products limit: 12 %}
      <div class="deal-product">
        <a href="{{ product.url }}">
          {% if product.images[0] %}
            <img src="{{ product.images[0] | img_url: '200x200' }}" alt="{{ product.title | escape }}" loading="lazy">
          {% endif %}
          <div class="deal-info">
            {% if product.compare_at_price > product.price %}
              {% assign disc = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price %}
              <span class="deal-pct">-{{ disc }}%</span>
              <p class="deal-price">{{ product.price | money }}</p>
              <p class="deal-was">{{ product.compare_at_price | money }}</p>
            {% else %}
              <span class="deal-pct">HOT</span>
              <p class="deal-price">{{ product.price | money }}</p>
            {% endif %}
          </div>
        </a>
      </div>
    {% endfor %}
  </div>
</section>
{% schema %}{"name":"Flash Deals Row","settings":[]}{% endschema %}`;

const FEATURED_PRODUCTS_LIQUID = `<section class="section-wrap">
  <div class="section-head">
    <h2 class="section-title">{{ section.settings.title | default: 'Best Sellers' }}</h2>
    <a href="{{ section.settings.view_all | default: '/collections/best-sellers' }}" class="view-all-link">View All →</a>
  </div>
  <div class="mp-grid">
    {% assign col_handle = section.settings.collection | default: 'best-sellers' %}
    {% assign col = collections[col_handle] %}
    {% if col and col.products_count > 0 %}
      {% assign products_list = col.products %}
    {% else %}
      {% assign products_list = collections.all.products %}
    {% endif %}
    {% for product in products_list limit: 20 %}
      <div class="mp-card">
        <a href="{{ product.url }}" class="mp-img-wrap">
          {% if product.images[0] %}
            <img src="{{ product.images[0] | img_url: '300x300' }}" alt="{{ product.title | escape }}" loading="lazy" class="mp-img">
          {% else %}
            <div class="mp-no-img">No Image</div>
          {% endif %}
          {% if product.compare_at_price > product.price %}
            {% assign discount = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price %}
            <span class="mp-badge sale">-{{ discount }}%</span>
          {% endif %}
        </a>
        <div class="mp-info">
          <p class="mp-title">{{ product.title | truncate: 55 }}</p>
          <div class="mp-stars">★★★★★ <span class="sold-count">500+ sold</span></div>
          <div class="mp-price-row">
            <span class="mp-price">{{ product.price | money }}</span>
            {% if product.compare_at_price > product.price %}
              <span class="mp-was">{{ product.compare_at_price | money }}</span>
            {% endif %}
          </div>
          <div class="mp-shipping">Free shipping</div>
        </div>
      </div>
    {% endfor %}
  </div>
</section>
{% schema %}
{"name":"Product Grid","settings":[
  {"type":"text","id":"title","label":"Heading","default":"Best Sellers"},
  {"type":"text","id":"collection","label":"Collection handle","default":"best-sellers"},
  {"type":"text","id":"view_all","label":"View All URL","default":"/collections/best-sellers"}
]}
{% endschema %}`;

const INDEX_JSON = JSON.stringify({
  sections: {
    hero: { type: "hero-banner", settings: {} },
    trust: { type: "trust-strip", settings: {} },
    deals: {
      type: "deals-row",
      settings: {}
    },
    featured: {
      type: "featured-products",
      settings: {
        title: "Best Sellers",
        collection: "best-sellers",
        view_all: "/collections/best-sellers"
      }
    },
    nl: { type: "newsletter", settings: {} }
  },
  order: ["hero", "trust", "deals", "featured", "nl"]
}, null, 2);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No session' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;

  // Get active theme
  const themesData = await shopifyGet(domain, token, 'themes.json');
  const activeTheme = (themesData.themes || []).find(t => t.role === 'main');
  if (!activeTheme) return Response.json({ error: 'No active theme' }, { status: 400 });

  const themeId = activeTheme.id;

  // Upload all 3 files in parallel
  const [dealsRes, featuredRes, indexRes] = await Promise.all([
    shopifyPut(domain, token, themeId, 'sections/deals-row.liquid', DEALS_ROW_LIQUID),
    shopifyPut(domain, token, themeId, 'sections/featured-products.liquid', FEATURED_PRODUCTS_LIQUID),
    shopifyPut(domain, token, themeId, 'templates/index.json', INDEX_JSON),
  ]);

  return Response.json({
    success: true,
    theme: activeTheme.name,
    deals_row_updated: !!dealsRes.asset,
    featured_updated: !!featuredRes.asset,
    index_updated: !!indexRes.asset,
    message: 'All sections now show products without requiring compare_at_price. Flash Deals uses flash-deals collection, Best Sellers uses best-sellers collection.',
  });
});