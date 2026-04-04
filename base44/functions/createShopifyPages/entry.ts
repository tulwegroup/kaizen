/**
 * Creates all store pages and collections for Kaizen Market
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopify(path, method, body, token, domain) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    method,
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const PAGES = [
  {
    title: 'Contact Us',
    handle: 'contact',
    body_html: `
<h2>Get In Touch</h2>
<p>Have a question or need help with your order? We're here for you 24/7.</p>
<p><strong>Email:</strong> support@kaizenmarket.com</p>
<p><strong>Response Time:</strong> Within 24 hours</p>
<p><strong>Order Issues:</strong> Please include your order number in your message.</p>
<div class="contact-form">{% form 'contact' %}{{ form | default_errors }}<p><label>Name</label><input type="text" name="contact[name]" /></p><p><label>Email</label><input type="email" name="contact[email]" /></p><p><label>Message</label><textarea name="contact[body]" rows="5"></textarea></p><p><input type="submit" value="Send Message" /></p>{% endform %}</div>
    `.trim()
  },
  {
    title: 'Shipping Info',
    handle: 'shipping-info',
    body_html: `
<h2>Shipping Information</h2>
<h3>🌍 We Ship Worldwide</h3>
<p>We deliver to over 150 countries with tracked shipping on every order.</p>
<h3>Estimated Delivery Times</h3>
<table>
  <tr><th>Region</th><th>Standard</th><th>Express</th></tr>
  <tr><td>United States</td><td>7–14 days</td><td>3–7 days</td></tr>
  <tr><td>United Kingdom</td><td>7–14 days</td><td>3–7 days</td></tr>
  <tr><td>Europe</td><td>10–18 days</td><td>5–10 days</td></tr>
  <tr><td>Australia / NZ</td><td>10–20 days</td><td>5–12 days</td></tr>
  <tr><td>Middle East</td><td>7–14 days</td><td>3–7 days</td></tr>
  <tr><td>Rest of World</td><td>14–25 days</td><td>7–15 days</td></tr>
</table>
<h3>Free Shipping</h3>
<p>Enjoy <strong>free standard shipping</strong> on all orders over $39.99.</p>
<h3>Tracking</h3>
<p>Every order comes with a tracking number sent to your email once shipped. Track your package at any time using the link in your confirmation email.</p>
<h3>Customs & Duties</h3>
<p>Most orders ship duty-free. International buyers may be subject to import duties depending on their country's regulations. These are the buyer's responsibility.</p>
    `.trim()
  },
  {
    title: 'Returns & Refunds',
    handle: 'returns-refunds',
    body_html: `
<h2>Returns & Refunds Policy</h2>
<h3>30-Day Return Policy</h3>
<p>We want you to love what you ordered. If you're not 100% satisfied, you can return most items within <strong>30 days</strong> of delivery.</p>
<h3>Eligibility</h3>
<ul>
  <li>Item must be unused and in original packaging</li>
  <li>Must be returned within 30 days of delivery</li>
  <li>Digital products are non-refundable</li>
  <li>Clearance / final sale items cannot be returned</li>
</ul>
<h3>How to Return</h3>
<ol>
  <li>Email us at support@kaizenmarket.com with your order number and reason for return</li>
  <li>We'll send you a return authorisation within 24 hours</li>
  <li>Ship the item back using the instructions provided</li>
  <li>Refund is processed within 5–7 business days of receiving your return</li>
</ol>
<h3>Damaged or Wrong Item?</h3>
<p>If your item arrived damaged or you received the wrong product, contact us within 7 days and we'll send a replacement or full refund — no return needed.</p>
<h3>Refund Method</h3>
<p>Refunds are issued to your original payment method. Processing time depends on your bank (typically 3–5 business days after we process it).</p>
    `.trim()
  },
  {
    title: 'Buyer Protection',
    handle: 'buyer-protection',
    body_html: `
<h2>Kaizen Buyer Protection</h2>
<p>Shop with confidence. Every purchase on Kaizen Market is covered by our <strong>Buyer Protection Guarantee</strong>.</p>
<h3>✅ What's Covered</h3>
<ul>
  <li><strong>Item Not Received:</strong> Full refund if your order doesn't arrive within the estimated delivery window</li>
  <li><strong>Not As Described:</strong> Refund or free replacement if the item significantly differs from the listing</li>
  <li><strong>Damaged on Arrival:</strong> Immediate replacement or full refund — no return required</li>
  <li><strong>Counterfeit Items:</strong> 100% refund guaranteed, no questions asked</li>
</ul>
<h3>🔒 Secure Payments</h3>
<p>All transactions are encrypted using SSL technology. We accept Visa, Mastercard, PayPal, and American Express. Your payment details are never stored on our servers.</p>
<h3>📦 Delivery Guarantee</h3>
<p>If your package is lost in transit, we'll reship or refund — whichever you prefer.</p>
<h3>How to File a Claim</h3>
<p>Email <strong>support@kaizenmarket.com</strong> with your order number. We aim to resolve all claims within 48 hours.</p>
    `.trim()
  },
  {
    title: 'FAQ',
    handle: 'faq',
    body_html: `
<h2>Frequently Asked Questions</h2>

<h3>Orders</h3>
<p><strong>How do I track my order?</strong><br/>Once your order ships, you'll receive a tracking number via email. Use it to track your package on our carrier's website.</p>
<p><strong>Can I change or cancel my order?</strong><br/>Orders can be changed or cancelled within 12 hours of placing them. Contact us immediately at support@kaizenmarket.com.</p>
<p><strong>Why hasn't my order shipped yet?</strong><br/>Processing takes 1–3 business days before shipping. You'll get a shipping confirmation email as soon as it's on its way.</p>

<h3>Shipping</h3>
<p><strong>Do you ship internationally?</strong><br/>Yes! We ship to 150+ countries worldwide. See our <a href="/pages/shipping-info">Shipping Info</a> page for delivery times.</p>
<p><strong>Is shipping free?</strong><br/>Free standard shipping on orders over $39.99. Express options are available at checkout.</p>

<h3>Returns</h3>
<p><strong>What's your return policy?</strong><br/>30-day returns on most items. See our <a href="/pages/returns-refunds">Returns & Refunds</a> page for full details.</p>
<p><strong>My item arrived damaged — what do I do?</strong><br/>Email us within 7 days with photos and your order number. We'll send a replacement or full refund immediately.</p>

<h3>Payments</h3>
<p><strong>What payment methods do you accept?</strong><br/>Visa, Mastercard, PayPal, American Express, and Apple Pay.</p>
<p><strong>Is it safe to use my card on your site?</strong><br/>Absolutely. All payments are SSL-encrypted and processed through Shopify's secure payment gateway.</p>

<h3>Products</h3>
<p><strong>Are your products genuine?</strong><br/>Yes. All products are sourced from verified suppliers and covered by our <a href="/pages/buyer-protection">Buyer Protection</a> guarantee.</p>
<p><strong>How do I find the right size?</strong><br/>Each product page includes a size guide where applicable. When in doubt, size up!</p>
    `.trim()
  },
  {
    title: 'New Arrivals',
    handle: 'new-arrivals',
    body_html: `
<h2>New Arrivals</h2>
<p>Discover the latest additions to our store — fresh products added weekly. Be the first to shop trending items before they sell out.</p>
<p><a href="/collections/new-arrivals">Browse all new arrivals →</a></p>
    `.trim()
  },
  {
    title: 'Flash Deals',
    handle: 'flash-deals',
    body_html: `
<h2>⚡ Flash Deals</h2>
<p>Limited-time offers at unbeatable prices. These deals won't last — grab them while stock lasts!</p>
<p><a href="/collections/flash-deals">See all flash deals →</a></p>
    `.trim()
  },
];

const COLLECTIONS = [
  { title: 'New Arrivals', handle: 'new-arrivals', body_html: 'The latest products added to our store — refreshed every week.', sort_order: 'created-desc' },
  { title: 'Flash Deals', handle: 'flash-deals', body_html: 'Limited-time offers at the lowest prices. Shop fast — stock is limited!', sort_order: 'best-selling' },
  { title: 'Best Sellers', handle: 'best-sellers', body_html: 'Our most popular products loved by thousands of customers worldwide.', sort_order: 'best-selling' },
  { title: 'All Products', handle: 'all', body_html: 'Browse our full catalog of quality products.', sort_order: 'best-selling' },
];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No Shopify session found' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;

  const results = { pages: [], collections: [], errors: [] };

  // Create pages in parallel
  const pageResults = await Promise.all(PAGES.map(async (page) => {
    const res = await shopify('pages.json', 'POST', { page }, token, domain);
    if (res.page) return { type: 'page', title: page.title, ok: true };
    // Already exists? update it
    if (res.errors) {
      const list = await shopify(`pages.json?handle=${page.handle}`, 'GET', null, token, domain);
      if (list.pages?.[0]?.id) {
        await shopify(`pages/${list.pages[0].id}.json`, 'PUT', { page: { body_html: page.body_html } }, token, domain);
        return { type: 'page', title: page.title, ok: true, updated: true };
      }
    }
    return { type: 'page', title: page.title, ok: false, error: JSON.stringify(res.errors) };
  }));

  // Create collections in parallel
  const collectionResults = await Promise.all(COLLECTIONS.map(async (col) => {
    const res = await shopify('custom_collections.json', 'POST', {
      custom_collection: { title: col.title, handle: col.handle, body_html: col.body_html, sort_order: col.sort_order, published: true }
    }, token, domain);
    if (res.custom_collection) return { type: 'collection', title: col.title, ok: true };
    return { type: 'collection', title: col.title, ok: false, note: 'may already exist' };
  }));

  results.pages = pageResults;
  results.collections = collectionResults;

  return Response.json({
    success: true,
    summary: {
      pages_created: pageResults.filter(r => r.ok).length,
      collections_created: collectionResults.filter(r => r.ok).length,
    },
    details: results,
  });
});