/**
 * deployShopifyTheme — Marketplace style (AliExpress/CJ inspired)
 * White bg, orange accents, dense product grid, sale badges, search bar, category nav
 * NOTE: All Liquid {{ }} blocks use \${{ to avoid JS template literal conflicts
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopifyRequest(domain, token, method, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2024-10/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shopify [${res.status}] ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function uploadAsset(domain, token, themeId, key, value) {
  await shopifyRequest(domain, token, 'PUT', `themes/${themeId}/assets.json`, { asset: { key, value } });
}

const LAYOUT_THEME = String.raw`<!DOCTYPE html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{{ page_title }} | {{ shop.name }}</title>
  <meta name="description" content="{{ page_description | escape }}">
  {{ content_for_header }}
  {{ 'theme.css' | asset_url | stylesheet_tag }}
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  {% section 'announcement-bar' %}
  {% section 'header' %}
  {% section 'category-nav' %}
  <main>{{ content_for_layout }}</main>
  {% section 'footer' %}
</body>
</html>`;

const SECTION_ANNOUNCEMENT = String.raw`<div class="ann-bar">
  <span>🔥 Flash Sale — Up to 80% OFF &nbsp;|&nbsp; 🚚 Free Shipping on $29+ &nbsp;|&nbsp; 🌍 Ships to 200+ Countries</span>
</div>
{% schema %}{"name":"Announcement Bar","settings":[]}{% endschema %}`;

const SECTION_HEADER = String.raw`<header class="site-header">
  <div class="header-top">
    <a href="/" class="brand-logo">{{ shop.name }}</a>
    <form action="/search" method="get" class="search-form">
      <input type="text" name="q" placeholder="Search products, brands and categories..." class="search-input" autocomplete="off">
      <button type="submit" class="search-btn">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </button>
    </form>
    <div class="header-icons">
      <a href="/account" class="hicon">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Account</span>
      </a>
      <a href="/cart" class="hicon cart-hicon">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        {% if cart.item_count > 0 %}<span class="cart-badge">{{ cart.item_count }}</span>{% endif %}
        <span>Cart</span>
      </a>
    </div>
  </div>
</header>
{% schema %}{"name":"Header","settings":[]}{% endschema %}`;

const SECTION_CATEGORY_NAV = String.raw`<nav class="cat-nav">
  <div class="cat-nav-inner">
    <div class="cat-all">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
      All Categories
    </div>
    {% for link in linklists.main-menu.links %}
      <a href="{{ link.url }}" class="cat-link{% if link.active %} active{% endif %}">{{ link.title }}</a>
    {% endfor %}
    <a href="/collections/sale" class="cat-link hot">🔥 Super Deals</a>
    <a href="/collections/new" class="cat-link">New Arrivals</a>
  </div>
</nav>
{% schema %}{"name":"Category Nav","settings":[]}{% endschema %}`;

const SECTION_HERO = String.raw`<section class="hero-mp">
  <div class="hero-main">
    <div class="hero-text">
      <div class="hero-tag">{{ section.settings.tag | default: 'Limited Time Offer' }}</div>
      <h1>{{ section.settings.title | default: 'Millions of Products' }}</h1>
      <p>{{ section.settings.subtitle | default: 'Shop the best deals from top sellers worldwide' }}</p>
      <a href="{{ section.settings.cta_url | default: '/collections/all' }}" class="btn-shop-now">Shop Now &#8594;</a>
    </div>
  </div>
  <div class="hero-sidebar">
    <div class="deal-card" style="background:#fff3cd;">
      <div class="deal-label">Flash Deal</div>
      <div class="deal-off">Up to 80% OFF</div>
      <a href="/collections/sale" class="deal-link">View Deals</a>
    </div>
    <div class="deal-card" style="background:#e8f4fd;">
      <div class="deal-label">Free Shipping</div>
      <div class="deal-off">On $29+</div>
      <a href="/collections/all" class="deal-link">Shop Now</a>
    </div>
  </div>
</section>
{% schema %}
{"name":"Hero Banner","settings":[
  {"type":"text","id":"tag","label":"Tag"},
  {"type":"text","id":"title","label":"Title"},
  {"type":"text","id":"subtitle","label":"Subtitle"},
  {"type":"url","id":"cta_url","label":"CTA URL"}
]}
{% endschema %}`;

const SECTION_TRUST = String.raw`<div class="trust-strip">
  <div class="trust-item"><span class="ti-icon">🚚</span><div><b>Free Shipping</b><p>Orders over $29</p></div></div>
  <div class="trust-item"><span class="ti-icon">🔒</span><div><b>Secure Payment</b><p>100% protected</p></div></div>
  <div class="trust-item"><span class="ti-icon">↩️</span><div><b>Easy Returns</b><p>30-day policy</p></div></div>
  <div class="trust-item"><span class="ti-icon">🌍</span><div><b>Global Delivery</b><p>200+ countries</p></div></div>
  <div class="trust-item"><span class="ti-icon">⭐</span><div><b>Top Rated</b><p>Millions of reviews</p></div></div>
</div>
{% schema %}{"name":"Trust Strip","settings":[]}{% endschema %}`;

const SECTION_FEATURED = String.raw`<section class="section-wrap">
  <div class="section-head">
    <h2 class="section-title">{{ section.settings.title | default: 'Best Sellers' }}</h2>
    <a href="{{ section.settings.view_all | default: '/collections/all' }}" class="view-all-link">View All &#8594;</a>
  </div>
  <div class="mp-grid">
    {% assign col = collections[section.settings.collection] %}
    {% assign products_list = col.products | default: collections.all.products %}
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
          <div class="mp-stars">&#9733;&#9733;&#9733;&#9733;&#9733; <span class="sold-count">500+ sold</span></div>
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
  {"type":"text","id":"title","label":"Section Title"},
  {"type":"collection","id":"collection","label":"Collection"},
  {"type":"url","id":"view_all","label":"View All URL"}
]}
{% endschema %}`;

const SECTION_DEALS_ROW = String.raw`<section class="deals-row-wrap">
  <div class="deals-row-head">
    <h2>🔥 Flash Deals</h2>
    <a href="/collections/sale" class="view-all-link" style="color:#fff;">See all &#8594;</a>
  </div>
  <div class="deals-scroll">
    {% for product in collections.all.products limit: 12 %}
      {% if product.compare_at_price > product.price %}
      <div class="deal-product">
        <a href="{{ product.url }}">
          {% if product.images[0] %}
            <img src="{{ product.images[0] | img_url: '200x200' }}" alt="{{ product.title | escape }}" loading="lazy">
          {% endif %}
          <div class="deal-info">
            {% assign disc = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price %}
            <span class="deal-pct">-{{ disc }}%</span>
            <p class="deal-price">{{ product.price | money }}</p>
            <p class="deal-was">{{ product.compare_at_price | money }}</p>
          </div>
        </a>
      </div>
      {% endif %}
    {% endfor %}
  </div>
</section>
{% schema %}{"name":"Flash Deals Row","settings":[]}{% endschema %}`;

const SECTION_NEWSLETTER = String.raw`<section class="nl-section">
  <div class="nl-inner">
    <div>
      <h3>Get Exclusive Deals &amp; Coupons</h3>
      <p>Subscribe and get up to $10 off your first order</p>
    </div>
    {% form 'customer' %}
      <input type="hidden" name="contact[tags]" value="newsletter">
      <div class="nl-form">
        <input type="email" name="contact[email]" placeholder="Enter your email..." class="nl-input" required>
        <button type="submit" class="nl-btn">Subscribe</button>
      </div>
    {% endform %}
  </div>
</section>
{% schema %}{"name":"Newsletter","settings":[]}{% endschema %}`;

const SECTION_FOOTER = String.raw`<footer class="site-footer">
  <div class="footer-top">
    <div class="footer-col">
      <h4>{{ shop.name }}</h4>
      <p>Your one-stop marketplace for quality products at unbeatable prices. Fast shipping worldwide.</p>
    </div>
    <div class="footer-col">
      <h4>Shop</h4>
      <ul>
        <li><a href="/collections/all">All Products</a></li>
        <li><a href="/collections/new">New Arrivals</a></li>
        <li><a href="/collections/sale">Flash Deals</a></li>
        <li><a href="/collections/best-sellers">Best Sellers</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Buyer Protection</h4>
      <ul>
        <li><a href="/pages/shipping">Shipping Info</a></li>
        <li><a href="/pages/returns">Returns &amp; Refunds</a></li>
        <li><a href="/pages/faq">FAQ</a></li>
        <li><a href="/pages/contact">Contact Us</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>We Accept</h4>
      <div class="pay-icons">
        <span>VISA</span><span>MC</span><span>PayPal</span><span>AMEX</span>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&#169; {{ 'now' | date: '%Y' }} {{ shop.name }}. All rights reserved.</p>
  </div>
</footer>
{% schema %}{"name":"Footer","settings":[]}{% endschema %}`;

const TEMPLATE_INDEX = JSON.stringify({
  sections: {
    "hero": { type: "hero-banner", settings: {} },
    "trust": { type: "trust-strip" },
    "deals": { type: "deals-row" },
    "featured": { type: "featured-products", settings: { title: "Best Sellers" } },
    "nl": { type: "newsletter" }
  },
  order: ["hero", "trust", "deals", "featured", "nl"]
});

const TEMPLATE_COLLECTION = String.raw`{% paginate collection.products by 40 %}
<div class="coll-page">
  <div class="coll-header">
    <div class="coll-breadcrumb"><a href="/">Home</a> &rsaquo; {{ collection.title }}</div>
    <h1>{{ collection.title }}</h1>
    {% if collection.description != blank %}<p class="coll-desc">{{ collection.description }}</p>{% endif %}
  </div>
  <div class="coll-toolbar">
    <span class="results-count">{{ collection.products_count }} results</span>
    <div class="sort-wrap">
      <label>Sort by:</label>
      <select onchange="location.href=location.pathname+'?sort_by='+this.value" class="sort-select">
        {% assign sort_by = collection.sort_by | default: collection.default_sort_by %}
        {% for opt in collection.sort_options %}
          <option value="{{ opt.value }}"{% if opt.value == sort_by %} selected{% endif %}>{{ opt.name }}</option>
        {% endfor %}
      </select>
    </div>
  </div>
  <div class="mp-grid">
    {% for product in collection.products %}
      <div class="mp-card">
        <a href="{{ product.url }}" class="mp-img-wrap">
          {% if product.images[0] %}
            <img src="{{ product.images[0] | img_url: '300x300' }}" alt="{{ product.title | escape }}" loading="lazy" class="mp-img">
          {% else %}
            <div class="mp-no-img">No Image</div>
          {% endif %}
          {% if product.compare_at_price > product.price %}
            {% assign disc = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price %}
            <span class="mp-badge sale">-{{ disc }}%</span>
          {% endif %}
        </a>
        <div class="mp-info">
          <p class="mp-title">{{ product.title | truncate: 55 }}</p>
          <div class="mp-stars">&#9733;&#9733;&#9733;&#9733;&#9733; <span class="sold-count">500+ sold</span></div>
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
  {% if paginate.pages > 1 %}
    <div class="pagination">{{ paginate | default_pagination }}</div>
  {% endif %}
</div>
{% endpaginate %}`;

const TEMPLATE_PRODUCT = String.raw`<div class="pdp-wrap">
  <div class="pdp-breadcrumb"><a href="/">Home</a> &rsaquo; <a href="{{ product.collections.first.url }}">{{ product.collections.first.title }}</a> &rsaquo; {{ product.title | truncate: 40 }}</div>
  <div class="pdp-layout">
    <div class="pdp-gallery">
      <div class="pdp-main-img-wrap">
        {% if product.images[0] %}
          <img id="pdp-main" src="{{ product.images[0] | img_url: '600x600' }}" alt="{{ product.title | escape }}" class="pdp-main-img">
        {% endif %}
      </div>
      {% if product.images.size > 1 %}
        <div class="pdp-thumbs">
          {% for img in product.images limit: 6 %}
            <img src="{{ img | img_url: '100x100' }}" alt="" onclick="document.getElementById('pdp-main').src='{{ img | img_url: '600x600' }}'" class="pdp-thumb" loading="lazy">
          {% endfor %}
        </div>
      {% endif %}
    </div>
    <div class="pdp-details">
      <div class="pdp-badges-row">
        <span class="pdp-choice-badge">&#10003; Choice</span>
        {% if product.compare_at_price > product.price %}
          {% assign disc = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price %}
          <span class="pdp-sale-badge">-{{ disc }}% Sale</span>
        {% endif %}
      </div>
      <h1 class="pdp-title">{{ product.title }}</h1>
      <div class="pdp-rating">
        <span class="pdp-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
        <span class="pdp-rating-num">4.8</span>
        <span class="pdp-sold">| 1,000+ sold</span>
      </div>
      <div class="pdp-price-block">
        <span class="pdp-price">{{ product.price | money }}</span>
        {% if product.compare_at_price > product.price %}
          <span class="pdp-was">{{ product.compare_at_price | money }}</span>
          <span class="pdp-save">Save {{ product.compare_at_price | minus: product.price | money }}</span>
        {% endif %}
      </div>
      <div class="pdp-perks">
        <div class="pdp-perk">🚚 <b>Free Shipping</b> &mdash; Est. delivery 10&ndash;20 days</div>
        <div class="pdp-perk">🛡️ <b>Buyer Protection</b> &mdash; Full refund if item not received</div>
        <div class="pdp-perk">↩️ <b>Free Returns</b> &mdash; Within 30 days</div>
      </div>
      {% form 'product', product %}
        {% if product.variants.size > 1 %}
          {% for option in product.options_with_values %}
            <div class="pdp-option-group">
              <div class="pdp-option-label">{{ option.name }}:</div>
              <div class="pdp-options">
                {% for val in option.values %}
                  <button type="button" class="pdp-opt-btn" onclick="this.closest('.pdp-options').querySelectorAll('.pdp-opt-btn').forEach(b=>b.classList.remove('sel'));this.classList.add('sel')">{{ val }}</button>
                {% endfor %}
              </div>
            </div>
          {% endfor %}
          <select name="id" style="display:none;">
            {% for v in product.variants %}<option value="{{ v.id }}">{{ v.title }}</option>{% endfor %}
          </select>
        {% else %}
          <input type="hidden" name="id" value="{{ product.variants.first.id }}">
        {% endif %}
        <div class="pdp-qty-row">
          <span class="pdp-option-label">Quantity:</span>
          <div class="qty-box">
            <button type="button" onclick="var i=document.getElementById('pdp-qty');if(i.value>1)i.value=+i.value-1">&#8722;</button>
            <input type="number" id="pdp-qty" name="quantity" value="1" min="1">
            <button type="button" onclick="var i=document.getElementById('pdp-qty');i.value=+i.value+1">&#43;</button>
          </div>
        </div>
        <div class="pdp-actions">
          <button type="submit" name="add" class="btn-add-cart">Add to Cart</button>
          <button type="button" class="btn-buy-now" onclick="this.form.action='/checkout';this.form.submit()">Buy Now</button>
        </div>
      {% endform %}
    </div>
  </div>
  <div class="pdp-desc-section">
    <h3>Product Description</h3>
    <div class="pdp-desc-body">{{ product.description }}</div>
  </div>
</div>`;

const TEMPLATE_CART = String.raw`<div class="cart-wrap">
  <h1>Shopping Cart <span>({{ cart.item_count }} items)</span></h1>
  {% if cart.item_count > 0 %}
    <div class="cart-layout">
      <div class="cart-items">
        {% for item in cart.items %}
          <div class="cart-row">
            <img src="{{ item.image | img_url: '100x100' }}" alt="{{ item.title | escape }}" class="cart-img">
            <div class="cart-row-info">
              <a href="{{ item.url }}" class="cart-item-title">{{ item.title }}</a>
              {% if item.variant.title != 'Default Title' %}<p class="cart-item-var">{{ item.variant.title }}</p>{% endif %}
            </div>
            <div class="cart-row-qty">
              <a href="/cart/change?line={{ forloop.index }}&quantity={{ item.quantity | minus: 1 }}">&#8722;</a>
              <span>{{ item.quantity }}</span>
              <a href="/cart/change?line={{ forloop.index }}&quantity={{ item.quantity | plus: 1 }}">&#43;</a>
            </div>
            <div class="cart-row-price">{{ item.line_price | money }}</div>
            <a href="/cart/change?line={{ forloop.index }}&quantity=0" class="cart-remove">&#10005;</a>
          </div>
        {% endfor %}
      </div>
      <div class="cart-summary-box">
        <h3>Order Summary</h3>
        <div class="cs-row"><span>Subtotal</span><span>{{ cart.total_price | money }}</span></div>
        <div class="cs-row"><span>Shipping</span><span class="free-ship">Free</span></div>
        <div class="cs-total"><span>Total</span><span>{{ cart.total_price | money }}</span></div>
        <form action="/checkout" method="post">
          <button type="submit" class="btn-checkout">Proceed to Checkout</button>
        </form>
        <div class="cs-secure">🔒 Secure 256-bit SSL checkout</div>
        <a href="/collections/all" class="cs-continue">&#8592; Continue Shopping</a>
      </div>
    </div>
  {% else %}
    <div class="cart-empty">
      <p>Your cart is empty</p>
      <a href="/collections/all" class="btn-add-cart" style="display:inline-block;text-decoration:none;margin-top:16px;">Start Shopping</a>
    </div>
  {% endif %}
</div>`;

const SETTINGS_SCHEMA = JSON.stringify([{
  name: "theme_info", theme_name: "Kaizen Market", theme_author: "Kaizen", theme_version: "2.0.0",
  theme_documentation_url: "https://kaizen.com", theme_support_url: "https://kaizen.com"
}]);
const SETTINGS_DATA = JSON.stringify({ current: {} });
const LOCALE_EN = JSON.stringify({
  general: { password_page: { login_form_heading: "Enter store password", login_form_password_label: "Password", login_form_password_placeholder: "Password", login_form_submit: "Enter", signup_form_email_label: "Email" } },
  products: { product: { add_to_cart: "Add to Cart", sold_out: "Sold Out", unavailable: "Unavailable" } },
  cart: { general: { title: "Shopping Cart", empty: "Your cart is empty", checkout: "Check Out", subtotal: "Subtotal" } }
});

const THEME_CSS = `
/* === KAIZEN MARKET — Marketplace Style (AliExpress/CJ inspired) === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --orange: #ff6600; --orange-dark: #e55a00; --red: #e43225; --gold: #f5a623;
  --green: #00a651; --dark: #222; --mid: #666; --light: #f5f5f5;
  --border: #e8e8e8; --white: #fff; --font: 'Inter', -apple-system, sans-serif;
}
body { font-family: var(--font); color: var(--dark); background: #f0f0f0; font-size: 13px; line-height: 1.5; }
a { text-decoration: none; color: inherit; }
img { max-width: 100%; display: block; }

.ann-bar { background: var(--orange); color: #fff; text-align: center; padding: 7px 16px; font-size: 12px; font-weight: 500; }

.site-header { background: var(--white); border-bottom: 2px solid var(--orange); position: sticky; top: 0; z-index: 200; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.header-top { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; gap: 16px; padding: 10px 20px; }
.brand-logo { font-size: 22px; font-weight: 800; color: var(--orange); letter-spacing: -0.5px; white-space: nowrap; flex-shrink: 0; }
.search-form { flex: 1; display: flex; max-width: 640px; border: 2px solid var(--orange); border-radius: 4px; overflow: hidden; }
.search-input { flex: 1; border: none; padding: 9px 14px; font-size: 14px; outline: none; }
.search-btn { background: var(--orange); color: #fff; border: none; padding: 0 18px; cursor: pointer; display: flex; align-items: center; }
.search-btn:hover { background: var(--orange-dark); }
.header-icons { display: flex; gap: 20px; align-items: center; margin-left: auto; flex-shrink: 0; }
.hicon { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: var(--dark); padding: 4px; transition: color .15s; }
.hicon:hover { color: var(--orange); }
.cart-hicon { position: relative; }
.cart-badge { position: absolute; top: -2px; right: -6px; background: var(--red); color: #fff; font-size: 10px; font-weight: 700; width: 17px; height: 17px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

.cat-nav { background: var(--white); border-bottom: 1px solid var(--border); }
.cat-nav-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; padding: 0 20px; overflow-x: auto; scrollbar-width: none; }
.cat-nav-inner::-webkit-scrollbar { display: none; }
.cat-all { display: flex; align-items: center; gap: 6px; padding: 10px 14px; font-size: 13px; font-weight: 600; color: var(--white); background: var(--dark); white-space: nowrap; cursor: pointer; flex-shrink: 0; }
.cat-link { padding: 10px 14px; font-size: 13px; color: var(--dark); white-space: nowrap; transition: color .15s; border-bottom: 2px solid transparent; }
.cat-link:hover, .cat-link.active { color: var(--orange); border-bottom-color: var(--orange); }
.cat-link.hot { color: var(--red); font-weight: 600; }

.hero-mp { max-width: 1280px; margin: 12px auto; padding: 0 20px; display: grid; grid-template-columns: 1fr 200px; gap: 12px; }
.hero-main { background: linear-gradient(120deg, #fff5f0 0%, #fff9f5 100%); border-radius: 8px; padding: 48px; min-height: 240px; display: flex; flex-direction: column; justify-content: center; border: 1px solid var(--border); }
.hero-tag { display: inline-block; background: var(--orange); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase; }
.hero-main h1 { font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 800; color: var(--dark); margin-bottom: 8px; line-height: 1.2; }
.hero-main p { font-size: 14px; color: var(--mid); margin-bottom: 20px; }
.btn-shop-now { display: inline-block; background: var(--orange); color: #fff; padding: 11px 28px; border-radius: 4px; font-weight: 700; font-size: 14px; }
.btn-shop-now:hover { background: var(--orange-dark); }
.hero-sidebar { display: flex; flex-direction: column; gap: 12px; }
.deal-card { border-radius: 8px; padding: 20px 16px; border: 1px solid var(--border); }
.deal-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--mid); margin-bottom: 4px; }
.deal-off { font-size: 20px; font-weight: 800; color: var(--red); margin-bottom: 8px; }
.deal-link { font-size: 12px; color: var(--orange); font-weight: 600; }
@media (max-width: 768px) { .hero-mp { grid-template-columns: 1fr; } .hero-sidebar { display: none; } }

.trust-strip { max-width: 1280px; margin: 8px 20px; padding: 10px 20px; background: var(--white); border: 1px solid var(--border); border-radius: 6px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.trust-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.ti-icon { font-size: 20px; }
.trust-item b { display: block; font-size: 12px; font-weight: 600; }
.trust-item p { font-size: 11px; color: var(--mid); }

.section-wrap { max-width: 1280px; margin: 12px auto; padding: 0 20px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; background: var(--white); border-radius: 6px; padding: 12px 16px; border-left: 4px solid var(--orange); }
.section-title { font-size: 16px; font-weight: 700; }
.view-all-link { font-size: 13px; color: var(--orange); font-weight: 600; }

.mp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 8px; }
.mp-card { background: var(--white); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); transition: box-shadow .2s, transform .2s; }
.mp-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.12); transform: translateY(-2px); }
.mp-img-wrap { display: block; position: relative; aspect-ratio: 1; overflow: hidden; background: var(--light); }
.mp-img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.mp-card:hover .mp-img { transform: scale(1.05); }
.mp-no-img { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 12px; }
.mp-badge { position: absolute; top: 6px; left: 0; font-size: 10px; font-weight: 700; padding: 2px 7px; letter-spacing: 0.5px; }
.mp-badge.sale { background: var(--red); color: #fff; border-radius: 0 3px 3px 0; }
.mp-info { padding: 8px 10px 10px; }
.mp-title { font-size: 12px; color: #333; line-height: 1.4; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 34px; }
.mp-stars { font-size: 11px; color: var(--gold); margin-bottom: 3px; }
.sold-count { color: var(--mid); font-size: 10px; }
.mp-price-row { display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; margin-bottom: 3px; }
.mp-price { font-size: 15px; font-weight: 700; color: var(--red); }
.mp-was { font-size: 11px; color: #999; text-decoration: line-through; }
.mp-shipping { font-size: 10px; color: var(--green); font-weight: 500; }

.deals-row-wrap { max-width: 1280px; margin: 12px auto; padding: 0 20px; }
.deals-row-head { display: flex; align-items: center; justify-content: space-between; background: var(--red); border-radius: 6px 6px 0 0; padding: 10px 16px; }
.deals-row-head h2 { font-size: 15px; font-weight: 700; color: #fff; }
.deals-scroll { display: flex; gap: 8px; overflow-x: auto; background: var(--white); border: 1px solid var(--border); border-top: none; border-radius: 0 0 6px 6px; padding: 12px; scrollbar-width: thin; }
.deal-product { flex-shrink: 0; width: 140px; }
.deal-product img { width: 140px; height: 140px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); }
.deal-info { text-align: center; padding: 6px 0; }
.deal-pct { display: inline-block; background: var(--red); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 3px; margin-bottom: 3px; }
.deal-price { font-size: 14px; font-weight: 700; color: var(--red); }
.deal-was { font-size: 11px; color: #999; text-decoration: line-through; }

.nl-section { background: linear-gradient(90deg, #fff5f0 0%, #fff9f5 100%); border-top: 2px solid var(--orange); padding: 36px 20px; margin-top: 16px; }
.nl-inner { max-width: 800px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.nl-inner h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.nl-inner p { font-size: 13px; color: var(--mid); }
.nl-form { display: flex; width: 100%; max-width: 400px; }
.nl-input { flex: 1; padding: 11px 14px; border: 2px solid var(--orange); border-right: none; border-radius: 4px 0 0 4px; font-size: 13px; outline: none; }
.nl-btn { background: var(--orange); color: #fff; border: 2px solid var(--orange); padding: 11px 20px; font-weight: 700; font-size: 13px; border-radius: 0 4px 4px 0; cursor: pointer; }
.nl-btn:hover { background: var(--orange-dark); }

.site-footer { background: #333; color: rgba(255,255,255,0.75); margin-top: 16px; }
.footer-top { max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 32px; padding: 40px 20px; border-bottom: 1px solid #444; }
.footer-col h4 { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.footer-col p { font-size: 12px; line-height: 1.7; }
.footer-col ul { list-style: none; }
.footer-col ul li { margin-bottom: 8px; }
.footer-col ul li a { font-size: 12px; color: rgba(255,255,255,0.6); }
.footer-col ul li a:hover { color: var(--orange); }
.pay-icons { display: flex; flex-wrap: wrap; gap: 6px; }
.pay-icons span { font-size: 10px; font-weight: 700; padding: 3px 8px; border: 1px solid #555; border-radius: 3px; color: rgba(255,255,255,0.5); }
.footer-bottom { text-align: center; padding: 14px 20px; font-size: 11px; color: rgba(255,255,255,0.35); }
@media (max-width: 768px) { .footer-top { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .footer-top { grid-template-columns: 1fr; } }

.coll-page { max-width: 1280px; margin: 12px auto; padding: 0 20px 40px; }
.coll-header { background: var(--white); border-radius: 6px; padding: 20px; margin-bottom: 12px; border: 1px solid var(--border); }
.coll-breadcrumb { font-size: 11px; color: var(--mid); margin-bottom: 6px; }
.coll-header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
.coll-desc { font-size: 13px; color: var(--mid); }
.coll-toolbar { display: flex; justify-content: space-between; align-items: center; background: var(--white); border-radius: 6px; padding: 10px 16px; border: 1px solid var(--border); margin-bottom: 10px; }
.results-count { font-size: 13px; color: var(--mid); }
.sort-wrap { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.sort-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; cursor: pointer; }
.pagination { display: flex; justify-content: center; gap: 6px; padding: 24px 0; }
.pagination a, .pagination em { padding: 8px 14px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; background: var(--white); }
.pagination em { background: var(--orange); color: #fff; border-color: var(--orange); font-style: normal; }

.pdp-wrap { max-width: 1280px; margin: 12px auto; padding: 0 20px 40px; }
.pdp-breadcrumb { font-size: 11px; color: var(--mid); margin-bottom: 12px; }
.pdp-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; background: var(--white); border-radius: 6px; padding: 24px; border: 1px solid var(--border); margin-bottom: 16px; }
.pdp-main-img-wrap { border-radius: 6px; overflow: hidden; aspect-ratio: 1; border: 1px solid var(--border); background: var(--light); }
.pdp-main-img { width: 100%; height: 100%; object-fit: cover; }
.pdp-thumbs { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.pdp-thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 4px; border: 2px solid var(--border); cursor: pointer; }
.pdp-thumb:hover { border-color: var(--orange); }
.pdp-badges-row { display: flex; gap: 8px; margin-bottom: 10px; }
.pdp-choice-badge { background: var(--orange); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 3px; }
.pdp-sale-badge { background: var(--red); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 3px; }
.pdp-title { font-size: 16px; font-weight: 600; line-height: 1.5; margin-bottom: 10px; }
.pdp-rating { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.pdp-stars { color: var(--gold); font-size: 14px; }
.pdp-rating-num { font-size: 13px; font-weight: 600; color: var(--gold); }
.pdp-sold { font-size: 12px; color: var(--mid); }
.pdp-price-block { background: var(--light); border-radius: 6px; padding: 14px 16px; margin-bottom: 16px; }
.pdp-price { font-size: 28px; font-weight: 800; color: var(--red); }
.pdp-was { font-size: 14px; color: #999; text-decoration: line-through; margin-left: 8px; }
.pdp-save { font-size: 12px; font-weight: 700; color: var(--green); margin-left: 8px; }
.pdp-perks { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.pdp-perk { font-size: 12px; color: #444; }
.pdp-option-group { margin-bottom: 14px; }
.pdp-option-label { font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--mid); text-transform: uppercase; letter-spacing: 0.5px; }
.pdp-options { display: flex; flex-wrap: wrap; gap: 6px; }
.pdp-opt-btn { padding: 6px 14px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; cursor: pointer; background: var(--white); }
.pdp-opt-btn:hover, .pdp-opt-btn.sel { border-color: var(--orange); color: var(--orange); background: #fff5f0; }
.pdp-qty-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.qty-box { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.qty-box button { width: 36px; height: 36px; border: none; background: var(--light); cursor: pointer; font-size: 16px; font-weight: 600; }
.qty-box button:hover { background: #e0e0e0; }
.qty-box input { width: 50px; height: 36px; text-align: center; border: none; border-left: 1px solid var(--border); border-right: 1px solid var(--border); font-size: 14px; outline: none; }
.pdp-actions { display: flex; gap: 10px; }
.btn-add-cart { flex: 1; background: var(--orange); color: #fff; border: none; padding: 13px 20px; font-size: 14px; font-weight: 700; border-radius: 4px; cursor: pointer; }
.btn-add-cart:hover { background: var(--orange-dark); }
.btn-buy-now { flex: 1; background: var(--red); color: #fff; border: none; padding: 13px 20px; font-size: 14px; font-weight: 700; border-radius: 4px; cursor: pointer; }
.btn-buy-now:hover { background: #c42a1e; }
.pdp-desc-section { background: var(--white); border-radius: 6px; padding: 24px; border: 1px solid var(--border); }
.pdp-desc-section h3 { font-size: 15px; font-weight: 700; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid var(--orange); display: inline-block; }
.pdp-desc-body { font-size: 13px; line-height: 1.8; color: #444; }
@media (max-width: 768px) { .pdp-layout { grid-template-columns: 1fr; } }

.cart-wrap { max-width: 1200px; margin: 16px auto; padding: 0 20px 40px; }
.cart-wrap h1 { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
.cart-wrap h1 span { font-size: 14px; color: var(--mid); font-weight: 400; }
.cart-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; }
.cart-items { background: var(--white); border-radius: 6px; border: 1px solid var(--border); overflow: hidden; }
.cart-row { display: flex; align-items: center; gap: 14px; padding: 16px; border-bottom: 1px solid var(--border); }
.cart-row:last-child { border-bottom: none; }
.cart-img { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); flex-shrink: 0; }
.cart-row-info { flex: 1; min-width: 0; }
.cart-item-title { font-size: 13px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cart-item-title:hover { color: var(--orange); }
.cart-item-var { font-size: 11px; color: var(--mid); margin-top: 2px; }
.cart-row-qty { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.cart-row-qty a { font-size: 18px; color: var(--mid); padding: 4px; line-height: 1; }
.cart-row-qty span { font-size: 14px; font-weight: 600; min-width: 24px; text-align: center; }
.cart-row-price { font-size: 15px; font-weight: 700; color: var(--red); min-width: 60px; text-align: right; }
.cart-remove { color: #bbb; font-size: 13px; padding: 4px; flex-shrink: 0; }
.cart-remove:hover { color: var(--red); }
.cart-summary-box { background: var(--white); border-radius: 6px; border: 1px solid var(--border); padding: 20px; position: sticky; top: 80px; }
.cart-summary-box h3 { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
.cs-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--mid); margin-bottom: 10px; }
.free-ship { color: var(--green); font-weight: 600; }
.cs-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; padding: 12px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 14px; }
.btn-checkout { width: 100%; background: var(--orange); color: #fff; border: none; padding: 14px; font-size: 14px; font-weight: 700; border-radius: 4px; cursor: pointer; margin-bottom: 10px; }
.btn-checkout:hover { background: var(--orange-dark); }
.cs-secure { text-align: center; font-size: 11px; color: var(--mid); margin-bottom: 10px; }
.cs-continue { display: block; text-align: center; font-size: 12px; color: var(--orange); }
.cart-empty { background: var(--white); border-radius: 6px; padding: 60px; text-align: center; border: 1px solid var(--border); }
.cart-empty p { font-size: 16px; color: var(--mid); }
@media (max-width: 768px) { .cart-layout { grid-template-columns: 1fr; } }
`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!shopDomain) return Response.json({ error: 'SHOPIFY_STORE_DOMAIN not set' }, { status: 500 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const activate = !!body.activate;

  const themeRes = await shopifyRequest(shopDomain, token, 'POST', 'themes.json', {
    theme: { name: 'Kaizen Market 2.0', role: 'unpublished' }
  });
  const themeId = themeRes.theme.id;
  await new Promise(r => setTimeout(r, 3000));

  const assets = [
    ['layout/theme.liquid', LAYOUT_THEME],
    ['sections/announcement-bar.liquid', SECTION_ANNOUNCEMENT],
    ['sections/header.liquid', SECTION_HEADER],
    ['sections/category-nav.liquid', SECTION_CATEGORY_NAV],
    ['sections/hero-banner.liquid', SECTION_HERO],
    ['sections/trust-strip.liquid', SECTION_TRUST],
    ['sections/featured-products.liquid', SECTION_FEATURED],
    ['sections/deals-row.liquid', SECTION_DEALS_ROW],
    ['sections/newsletter.liquid', SECTION_NEWSLETTER],
    ['sections/footer.liquid', SECTION_FOOTER],
    ['templates/index.json', TEMPLATE_INDEX],
    ['templates/collection.liquid', TEMPLATE_COLLECTION],
    ['templates/product.liquid', TEMPLATE_PRODUCT],
    ['templates/cart.liquid', TEMPLATE_CART],
    ['config/settings_schema.json', SETTINGS_SCHEMA],
    ['config/settings_data.json', SETTINGS_DATA],
    ['locales/en.default.json', LOCALE_EN],
    ['assets/theme.css', THEME_CSS],
  ];

  const results = [];
  for (const [key, value] of assets) {
    try {
      await uploadAsset(shopDomain, token, themeId, key, value);
      results.push({ key, ok: true });
      await new Promise(r => setTimeout(r, 350));
    } catch (e) {
      results.push({ key, ok: false, error: e.message });
    }
  }

  if (activate) {
    await shopifyRequest(shopDomain, token, 'PUT', `themes/${themeId}.json`, {
      theme: { id: themeId, role: 'main' }
    });
  }

  return Response.json({
    success: true,
    theme_id: themeId,
    theme_name: 'Kaizen Market 2.0',
    activated: activate,
    assets_uploaded: results.filter(r => r.ok).length,
    assets_failed: results.filter(r => !r.ok).length,
    failed_assets: results.filter(r => !r.ok),
    shopify_themes_url: `https://${shopDomain}/admin/themes`,
  });
});