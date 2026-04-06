/**
 * createMissingPages
 * Creates only the pages that are missing from the Shopify store.
 * Checks existing pages first, then creates any that are missing.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopifyGet(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  return res.json();
}

async function shopifyPost(domain, token, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function shopifyPut(domain, token, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

const PAGES = [
  {
    handle: 'shipping',
    title: 'Shipping Information',
    body_html: `<h2>Shipping Policy</h2>
<p>We ship worldwide from our network of trusted suppliers. All orders are processed within 1-3 business days.</p>
<h3>Shipping Times</h3>
<ul>
  <li><strong>United States & Canada:</strong> 7–15 business days</li>
  <li><strong>United Kingdom & Europe:</strong> 7–14 business days</li>
  <li><strong>Australia & New Zealand:</strong> 10–20 business days</li>
  <li><strong>Rest of World:</strong> 10–25 business days</li>
</ul>
<h3>Tracking Your Order</h3>
<p>Once your order has shipped, you will receive a confirmation email with a tracking number. You can track your package at any time using the link provided.</p>
<h3>Free Shipping</h3>
<p>We offer free standard shipping on all orders. No minimum order required.</p>
<h3>Questions?</h3>
<p>If you have any questions about your shipment, please <a href="/pages/contact">contact us</a> and we'll be happy to help.</p>`,
  },
  {
    handle: 'returns',
    title: 'Returns & Refunds',
    body_html: `<h2>Returns & Refund Policy</h2>
<p>Your satisfaction is our top priority. If you're not completely happy with your purchase, we're here to help.</p>
<h3>30-Day Return Policy</h3>
<p>You have 30 days from the date of delivery to return an item. To be eligible for a return, your item must be unused and in the same condition that you received it.</p>
<h3>How to Return</h3>
<ol>
  <li>Email us at support@kaizenmarket.com with your order number and reason for return</li>
  <li>We'll send you return instructions within 24 hours</li>
  <li>Ship the item back to us</li>
  <li>Once we receive and inspect the item, we'll process your refund</li>
</ol>
<h3>Refunds</h3>
<p>Once your return is approved, a refund will be applied to your original payment method within 5–10 business days.</p>
<h3>Damaged or Wrong Items</h3>
<p>If you received a damaged or incorrect item, please <a href="/pages/contact">contact us</a> immediately and we'll send a replacement at no charge.</p>
<h3>Non-Returnable Items</h3>
<p>Digital products and downloadable software are non-returnable once accessed.</p>`,
  },
  {
    handle: 'faq',
    title: 'FAQ',
    body_html: `<h2>Frequently Asked Questions</h2>
<h3>How long does shipping take?</h3>
<p>Standard shipping takes 7–25 business days depending on your location. See our <a href="/pages/shipping">Shipping page</a> for full details.</p>
<h3>Can I track my order?</h3>
<p>Yes! Once shipped, you'll receive an email with a tracking number and link.</p>
<h3>What if I receive a damaged item?</h3>
<p>Contact us immediately and we'll send a replacement at no charge. See our <a href="/pages/returns">Returns page</a> for details.</p>
<h3>Do you offer refunds?</h3>
<p>Yes — we have a 30-day return & refund policy. Contact us to initiate a return.</p>
<h3>What payment methods do you accept?</h3>
<p>We accept Visa, Mastercard, American Express, PayPal, and more.</p>
<h3>How do I contact you?</h3>
<p>Visit our <a href="/pages/contact">Contact page</a> or email us directly.</p>`,
  },
  {
    handle: 'contact',
    title: 'Contact Us',
    body_html: `<h2>Get in Touch</h2>
<p>Have a question or need help with your order? We're here for you.</p>
<h3>Email Us</h3>
<p><a href="mailto:support@kaizenmarket.com">support@kaizenmarket.com</a></p>
<p>We respond to all enquiries within 24 hours, Monday–Friday.</p>
<h3>Order Issues</h3>
<p>For order-related questions, please include your order number in your message so we can assist you quickly.</p>
<h3>Returns & Refunds</h3>
<p>Please visit our <a href="/pages/returns">Returns page</a> for information on how to return an item.</p>`,
  },
  {
    handle: 'buyer-protection',
    title: 'Buyer Protection',
    body_html: `<h2>Buyer Protection</h2>
<p>Shop with confidence. Every order on Kaizen Market is protected.</p>
<h3>What's Covered</h3>
<ul>
  <li>✅ Full refund if your item doesn't arrive</li>
  <li>✅ Full refund if your item is not as described</li>
  <li>✅ Free replacement for damaged or defective items</li>
  <li>✅ 30-day return window</li>
</ul>
<h3>How to Claim</h3>
<p>Simply <a href="/pages/contact">contact our support team</a> within 30 days of delivery with your order number and a description of the issue. We'll resolve it promptly.</p>
<h3>Secure Payments</h3>
<p>All transactions are encrypted and processed through secure payment gateways. We never store your payment information.</p>`,
  },
];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No session' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;

  // Get existing pages
  const existingData = await shopifyGet(domain, token, 'pages.json?limit=250&fields=id,handle,title');
  const existingHandles = new Set((existingData.pages || []).map(p => p.handle));
  const existingById = {};
  for (const p of (existingData.pages || [])) existingById[p.handle] = p.id;

  const results = {};

  for (const page of PAGES) {
    if (existingHandles.has(page.handle)) {
      // Update existing page content
      const pageId = existingById[page.handle];
      const res = await shopifyPut(domain, token, `pages/${pageId}.json`, {
        page: { body_html: page.body_html }
      });
      results[page.handle] = res.page ? '✅ Updated' : `❌ Update failed: ${JSON.stringify(res.errors)}`;
    } else {
      // Create new page
      const res = await shopifyPost(domain, token, 'pages.json', {
        page: { title: page.title, handle: page.handle, body_html: page.body_html, published: true }
      });
      results[page.handle] = res.page ? '✅ Created' : `❌ Failed: ${JSON.stringify(res.errors)}`;
    }
  }

  return Response.json({ success: true, results });
});