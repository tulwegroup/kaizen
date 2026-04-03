/**
 * deployShopifyTheme
 * Generates a full luxury Shopify theme and uploads all assets via Admin API.
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
  await shopifyRequest(domain, token, 'PUT', `themes/${themeId}/assets.json`, {
    asset: { key, value }
  });
}

// ── THEME FILES ────────────────────────────────────────────────────────────────

const LAYOUT_THEME = `<!DOCTYPE html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ page_title }} | {{ shop.name }}</title>
  <meta name="description" content="{{ page_description | escape }}">
  {{ content_for_header }}
  {{ 'theme.css' | asset_url | stylesheet_tag }}
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body class="kaizen-body">
  {% section 'announcement-bar' %}
  {% section 'header' %}
  <main class="main-content">
    {{ content_for_layout }}
  </main>
  {% section 'footer' %}
  <div id="cart-overlay" class="cart-overlay" style="display:none;"></div>
</body>
</html>`;

const SECTION_ANNOUNCEMENT = `<div class="announcement-bar">
  <p>{{ section.settings.text | default: '🚚 Free Shipping on Orders Over $50 &nbsp;|&nbsp; 🔒 Secure Checkout &nbsp;|&nbsp; ⭐ 30-Day Returns' }}</p>
</div>
{% schema %}
{"name":"Announcement Bar","settings":[{"type":"text","id":"text","label":"Text"}]}
{% endschema %}`;

const SECTION_HEADER = `<header class="site-header">
  <div class="header-inner container">
    <a href="/" class="brand-logo">
      <span class="logo-text">{{ shop.name }}</span>
    </a>
    <nav class="main-nav">
      {% for link in linklists.main-menu.links %}
        <a href="{{ link.url }}" class="nav-link{% if link.active %} active{% endif %}">{{ link.title }}</a>
      {% endfor %}
    </nav>
    <div class="header-actions">
      <a href="/search" class="header-icon" aria-label="Search">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </a>
      <a href="/account" class="header-icon" aria-label="Account">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </a>
      <a href="/cart" class="header-icon cart-icon" aria-label="Cart">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        {% if cart.item_count > 0 %}<span class="cart-count">{{ cart.item_count }}</span>{% endif %}
      </a>
    </div>
    <button class="mobile-menu-btn" onclick="document.querySelector('.mobile-nav').classList.toggle('open')">
      <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  </div>
  <nav class="mobile-nav">
    {% for link in linklists.main-menu.links %}
      <a href="{{ link.url }}" class="mobile-nav-link">{{ link.title }}</a>
    {% endfor %}
  </nav>
</header>
{% schema %}{"name":"Header","settings":[]}{% endschema %}`;

const SECTION_HERO = `<section class="hero-section" style="background-image: url('{{ section.settings.bg_image | img_url: 'master' }}');">
  <div class="hero-overlay"></div>
  <div class="hero-content container">
    <p class="hero-eyebrow">{{ section.settings.eyebrow | default: 'New Collection 2024' }}</p>
    <h1 class="hero-title">{{ section.settings.title | default: 'Discover Premium Products' }}</h1>
    <p class="hero-subtitle">{{ section.settings.subtitle | default: 'Curated for quality. Delivered with care.' }}</p>
    <div class="hero-buttons">
      <a href="{{ section.settings.cta_url | default: '/collections/all' }}" class="btn btn-primary">{{ section.settings.cta_text | default: 'Shop Now' }}</a>
      <a href="{{ section.settings.cta2_url | default: '/collections' }}" class="btn btn-outline">{{ section.settings.cta2_text | default: 'Browse Categories' }}</a>
    </div>
  </div>
  <div class="hero-stats">
    <div class="stat-item"><strong>50K+</strong><span>Happy Customers</span></div>
    <div class="stat-divider"></div>
    <div class="stat-item"><strong>1,000+</strong><span>Products</span></div>
    <div class="stat-divider"></div>
    <div class="stat-item"><strong>4.9★</strong><span>Average Rating</span></div>
  </div>
</section>
{% schema %}
{"name":"Hero Banner","settings":[
  {"type":"image_picker","id":"bg_image","label":"Background Image"},
  {"type":"text","id":"eyebrow","label":"Eyebrow Text"},
  {"type":"text","id":"title","label":"Title"},
  {"type":"text","id":"subtitle","label":"Subtitle"},
  {"type":"text","id":"cta_text","label":"Button 1 Text"},
  {"type":"url","id":"cta_url","label":"Button 1 URL"},
  {"type":"text","id":"cta2_text","label":"Button 2 Text"},
  {"type":"url","id":"cta2_url","label":"Button 2 URL"}
]}
{% endschema %}`;

const SECTION_TRUST = `<section class="trust-section">
  <div class="container">
    <div class="trust-grid">
      <div class="trust-item">
        <div class="trust-icon">🚚</div>
        <div><strong>Free Shipping</strong><p>On orders over $50</p></div>
      </div>
      <div class="trust-item">
        <div class="trust-icon">🔒</div>
        <div><strong>Secure Payment</strong><p>256-bit SSL encryption</p></div>
      </div>
      <div class="trust-item">
        <div class="trust-icon">↩️</div>
        <div><strong>Easy Returns</strong><p>30-day return policy</p></div>
      </div>
      <div class="trust-item">
        <div class="trust-icon">🌍</div>
        <div><strong>Global Delivery</strong><p>Ships worldwide</p></div>
      </div>
    </div>
  </div>
</section>
{% schema %}{"name":"Trust Badges","settings":[]}{% endschema %}`;

const SECTION_FEATURED_PRODUCTS = `<section class="featured-section">
  <div class="container">
    <div class="section-header">
      <p class="section-label">{{ section.settings.label | default: 'Hand-picked for you' }}</p>
      <h2 class="section-title">{{ section.settings.title | default: 'Best Sellers' }}</h2>
    </div>
    <div class="products-grid">
      {% assign collection = collections[section.settings.collection] %}
      {% if collection %}
        {% for product in collection.products limit: section.settings.limit %}
          <div class="product-card">
            <a href="{{ product.url }}" class="product-image-wrap">
              {% if product.images[0] %}
                <img src="{{ product.images[0] | img_url: '400x400' }}" 
                     data-hover="{{ product.images[1] | img_url: '400x400' }}"
                     alt="{{ product.title | escape }}" 
                     class="product-img" loading="lazy">
              {% else %}
                <div class="product-img-placeholder">No Image</div>
              {% endif %}
              {% if product.compare_at_price > product.price %}
                <span class="product-badge sale">SALE</span>
              {% elsif product.tags contains 'new' %}
                <span class="product-badge new">NEW</span>
              {% endif %}
              <div class="product-overlay">
                <button class="quick-add" data-variant="{{ product.variants.first.id }}">Quick Add</button>
              </div>
            </a>
            <div class="product-info">
              <p class="product-vendor">{{ product.vendor }}</p>
              <h3 class="product-title"><a href="{{ product.url }}">{{ product.title }}</a></h3>
              <div class="product-rating">
                <span class="stars">★★★★★</span>
                <span class="review-count">({{ product.metafields.reviews.rating_count | default: '24' }})</span>
              </div>
              <div class="product-price">
                <span class="price">{{ product.price | money }}</span>
                {% if product.compare_at_price > product.price %}
                  <span class="compare-price">{{ product.compare_at_price | money }}</span>
                  <span class="discount-badge">{{ product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price }}% OFF</span>
                {% endif %}
              </div>
            </div>
          </div>
        {% endfor %}
      {% else %}
        {% for product in collections.all.products limit: section.settings.limit %}
          <div class="product-card">
            <a href="{{ product.url }}" class="product-image-wrap">
              {% if product.images[0] %}
                <img src="{{ product.images[0] | img_url: '400x400' }}" alt="{{ product.title | escape }}" class="product-img" loading="lazy">
              {% else %}
                <div class="product-img-placeholder">No Image</div>
              {% endif %}
              <div class="product-overlay">
                <button class="quick-add">Quick Add</button>
              </div>
            </a>
            <div class="product-info">
              <p class="product-vendor">{{ product.vendor }}</p>
              <h3 class="product-title"><a href="{{ product.url }}">{{ product.title }}</a></h3>
              <div class="product-rating"><span class="stars">★★★★★</span></div>
              <div class="product-price">
                <span class="price">{{ product.price | money }}</span>
                {% if product.compare_at_price > product.price %}
                  <span class="compare-price">{{ product.compare_at_price | money }}</span>
                {% endif %}
              </div>
            </div>
          </div>
        {% endfor %}
      {% endif %}
    </div>
    <div class="section-footer">
      <a href="{{ section.settings.view_all_url | default: '/collections/all' }}" class="btn btn-outline-dark">View All Products</a>
    </div>
  </div>
</section>
{% schema %}
{"name":"Featured Products","settings":[
  {"type":"text","id":"label","label":"Label"},
  {"type":"text","id":"title","label":"Title"},
  {"type":"collection","id":"collection","label":"Collection"},
  {"type":"range","id":"limit","min":2,"max":12,"step":2,"default":8,"label":"Product count"},
  {"type":"url","id":"view_all_url","label":"View All URL"}
]}
{% endschema %}`;

const SECTION_BANNER_SPLIT = `<section class="banner-split">
  <div class="banner-item" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">
    <div class="banner-content">
      <p class="banner-label">{{ section.settings.label1 | default: 'New Arrivals' }}</p>
      <h3>{{ section.settings.title1 | default: 'Tech & Gadgets' }}</h3>
      <a href="{{ section.settings.url1 | default: '/collections/tech' }}" class="btn btn-gold">Explore →</a>
    </div>
  </div>
  <div class="banner-item" style="background: linear-gradient(135deg, #2d1b69 0%, #11063a 100%);">
    <div class="banner-content">
      <p class="banner-label">{{ section.settings.label2 | default: 'Top Rated' }}</p>
      <h3>{{ section.settings.title2 | default: 'Home & Living' }}</h3>
      <a href="{{ section.settings.url2 | default: '/collections/home' }}" class="btn btn-gold">Explore →</a>
    </div>
  </div>
</section>
{% schema %}
{"name":"Split Banner","settings":[
  {"type":"text","id":"label1","label":"Label 1"},{"type":"text","id":"title1","label":"Title 1"},{"type":"url","id":"url1","label":"URL 1"},
  {"type":"text","id":"label2","label":"Label 2"},{"type":"text","id":"title2","label":"Title 2"},{"type":"url","id":"url2","label":"URL 2"}
]}
{% endschema %}`;

const SECTION_NEWSLETTER = `<section class="newsletter-section">
  <div class="container">
    <div class="newsletter-inner">
      <div class="newsletter-text">
        <h2>Join the Kaizen Community</h2>
        <p>Get exclusive deals, new arrivals, and style tips delivered to your inbox.</p>
      </div>
      {% form 'customer', id: 'newsletter-form' %}
        <input type="hidden" name="contact[tags]" value="newsletter">
        <div class="newsletter-form">
          <input type="email" name="contact[email]" placeholder="Enter your email address" class="newsletter-input" required>
          <button type="submit" class="btn btn-gold">Subscribe</button>
        </div>
      {% endform %}
    </div>
  </div>
</section>
{% schema %}{"name":"Newsletter","settings":[]}{% endschema %}`;

const SECTION_FOOTER = `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <h3 class="footer-logo">{{ shop.name }}</h3>
        <p>Premium products curated for modern living. Quality you can trust, prices you'll love.</p>
        <div class="social-links">
          <a href="#" aria-label="Instagram">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
          <a href="#" aria-label="TikTok">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>
          </a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <ul>
          <li><a href="/collections/all">All Products</a></li>
          <li><a href="/collections/new-arrivals">New Arrivals</a></li>
          <li><a href="/collections/best-sellers">Best Sellers</a></li>
          <li><a href="/collections/sale">Sale</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <ul>
          <li><a href="/pages/faq">FAQ</a></li>
          <li><a href="/pages/shipping">Shipping Info</a></li>
          <li><a href="/pages/returns">Returns</a></li>
          <li><a href="/pages/contact">Contact Us</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="/pages/about">About Us</a></li>
          <li><a href="/pages/privacy-policy">Privacy Policy</a></li>
          <li><a href="/pages/terms">Terms of Service</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© {{ 'now' | date: '%Y' }} {{ shop.name }}. All rights reserved.</p>
      <div class="payment-icons">
        <span class="payment-icon">VISA</span>
        <span class="payment-icon">MC</span>
        <span class="payment-icon">AMEX</span>
        <span class="payment-icon">PayPal</span>
        <span class="payment-icon">Apple Pay</span>
      </div>
    </div>
  </div>
</footer>
{% schema %}{"name":"Footer","settings":[]}{% endschema %}`;

const TEMPLATE_INDEX = JSON.stringify({
  sections: {
    "announcement": { type: "announcement-bar", disabled: false },
    "hero": { type: "hero-banner", settings: {} },
    "trust": { type: "trust-badges", settings: {} },
    "featured": { type: "featured-products", settings: { limit: 8 } },
    "split-banner": { type: "banner-split", settings: {} },
    "newsletter": { type: "newsletter", settings: {} }
  },
  order: ["hero", "trust", "featured", "split-banner", "newsletter"]
});

const TEMPLATE_COLLECTION = `{% paginate collection.products by 24 %}
<div class="collection-page">
  <div class="collection-hero">
    <div class="container">
      <h1>{{ collection.title }}</h1>
      {% if collection.description != blank %}<p>{{ collection.description }}</p>{% endif %}
    </div>
  </div>
  <div class="container">
    <div class="collection-toolbar">
      <p class="product-count">{{ collection.products_count }} products</p>
      <div class="sort-by">
        {% assign sort_by = collection.sort_by | default: collection.default_sort_by %}
        <select onchange="window.location.href=window.location.pathname+'?sort_by='+this.value">
          {% for option in collection.sort_options %}
            <option value="{{ option.value }}" {% if option.value == sort_by %}selected{% endif %}>{{ option.name }}</option>
          {% endfor %}
        </select>
      </div>
    </div>
    <div class="products-grid">
      {% for product in collection.products %}
        <div class="product-card">
          <a href="{{ product.url }}" class="product-image-wrap">
            {% if product.images[0] %}
              <img src="{{ product.images[0] | img_url: '400x400' }}" alt="{{ product.title | escape }}" class="product-img" loading="lazy">
            {% else %}
              <div class="product-img-placeholder">No Image</div>
            {% endif %}
            {% if product.compare_at_price > product.price %}
              <span class="product-badge sale">SALE</span>
            {% endif %}
            <div class="product-overlay"><button class="quick-add">Quick Add</button></div>
          </a>
          <div class="product-info">
            <p class="product-vendor">{{ product.vendor }}</p>
            <h3 class="product-title"><a href="{{ product.url }}">{{ product.title }}</a></h3>
            <div class="product-rating"><span class="stars">★★★★★</span></div>
            <div class="product-price">
              <span class="price">{{ product.price | money }}</span>
              {% if product.compare_at_price > product.price %}
                <span class="compare-price">{{ product.compare_at_price | money }}</span>
              {% endif %}
            </div>
          </div>
        </div>
      {% endfor %}
    </div>
    {% if paginate.pages > 1 %}
      <div class="pagination">
        {{ paginate | default_pagination }}
      </div>
    {% endif %}
  </div>
</div>
{% endpaginate %}`;

const TEMPLATE_PRODUCT = `<div class="product-page container">
  <div class="product-layout">
    <div class="product-gallery">
      <div class="main-image-wrap">
        {% if product.images[0] %}
          <img id="main-product-img" src="{{ product.images[0] | img_url: '800x800' }}" alt="{{ product.title | escape }}" class="main-product-img">
        {% endif %}
      </div>
      {% if product.images.size > 1 %}
        <div class="thumbnail-strip">
          {% for image in product.images limit: 6 %}
            <img src="{{ image | img_url: '120x120' }}" alt="{{ product.title | escape }}" 
                 onclick="document.getElementById('main-product-img').src='{{ image | img_url: '800x800' }}'"
                 class="thumb-img" loading="lazy">
          {% endfor %}
        </div>
      {% endif %}
    </div>
    <div class="product-details">
      <p class="product-vendor-large">{{ product.vendor }}</p>
      <h1 class="product-title-large">{{ product.title }}</h1>
      <div class="product-rating-large">
        <span class="stars-large">★★★★★</span>
        <span class="review-count">4.8 (128 reviews)</span>
      </div>
      <div class="product-price-large">
        <span class="price-large">{{ product.price | money }}</span>
        {% if product.compare_at_price > product.price %}
          <span class="compare-price-large">{{ product.compare_at_price | money }}</span>
          <span class="savings">You save {{ product.compare_at_price | minus: product.price | money }}</span>
        {% endif %}
      </div>
      {% form 'product', product %}
        {% if product.variants.size > 1 %}
          {% for option in product.options_with_values %}
            <div class="variant-group">
              <label class="variant-label">{{ option.name }}:</label>
              <div class="variant-options">
                {% for value in option.values %}
                  <button type="button" class="variant-btn" onclick="this.parentNode.querySelectorAll('.variant-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">{{ value }}</button>
                {% endfor %}
              </div>
            </div>
          {% endfor %}
          <select name="id" class="variant-select-hidden" style="display:none;">
            {% for variant in product.variants %}
              <option value="{{ variant.id }}">{{ variant.title }}</option>
            {% endfor %}
          </select>
        {% else %}
          <input type="hidden" name="id" value="{{ product.variants.first.id }}">
        {% endif %}
        <div class="quantity-row">
          <label class="variant-label">Quantity:</label>
          <div class="qty-control">
            <button type="button" onclick="var q=document.getElementById('qty');if(q.value>1)q.value--">−</button>
            <input type="number" id="qty" name="quantity" value="1" min="1" class="qty-input">
            <button type="button" onclick="document.getElementById('qty').value++">+</button>
          </div>
        </div>
        <div class="product-actions">
          <button type="submit" name="add" class="btn btn-add-cart">Add to Cart</button>
          <button type="button" class="btn btn-wishlist">♡ Wishlist</button>
        </div>
      {% endform %}
      <div class="product-trust-mini">
        <span>🚚 Fast shipping</span>
        <span>🔒 Secure checkout</span>
        <span>↩️ Easy returns</span>
      </div>
      <div class="product-description">
        <h3>Product Description</h3>
        {{ product.description }}
      </div>
    </div>
  </div>
</div>`;

const TEMPLATE_CART = `<div class="cart-page container">
  <h1>Your Cart ({{ cart.item_count }} items)</h1>
  {% if cart.item_count > 0 %}
    <div class="cart-layout">
      <div class="cart-items">
        {% for item in cart.items %}
          <div class="cart-item">
            <img src="{{ item.image | img_url: '120x120' }}" alt="{{ item.title | escape }}" class="cart-item-img">
            <div class="cart-item-details">
              <h3><a href="{{ item.url }}">{{ item.title }}</a></h3>
              <p class="cart-item-variant">{{ item.variant.title }}</p>
              <div class="cart-item-price">{{ item.price | money }}</div>
            </div>
            <div class="cart-item-qty">
              <a href="/cart/change?line={{ forloop.index }}&quantity={{ item.quantity | minus: 1 }}">−</a>
              <span>{{ item.quantity }}</span>
              <a href="/cart/change?line={{ forloop.index }}&quantity={{ item.quantity | plus: 1 }}">+</a>
            </div>
            <div class="cart-item-total">{{ item.line_price | money }}</div>
            <a href="/cart/change?line={{ forloop.index }}&quantity=0" class="cart-remove">✕</a>
          </div>
        {% endfor %}
      </div>
      <div class="cart-summary">
        <h3>Order Summary</h3>
        <div class="summary-row"><span>Subtotal</span><span>{{ cart.total_price | money }}</span></div>
        <div class="summary-row shipping"><span>Shipping</span><span>Calculated at checkout</span></div>
        <div class="summary-total"><span>Total</span><span>{{ cart.total_price | money }}</span></div>
        <form action="/checkout" method="post">
          <button type="submit" class="btn btn-checkout">Proceed to Checkout</button>
        </form>
        <a href="/collections/all" class="continue-shopping">← Continue Shopping</a>
      </div>
    </div>
  {% else %}
    <div class="empty-cart">
      <p>Your cart is empty.</p>
      <a href="/collections/all" class="btn btn-primary">Start Shopping</a>
    </div>
  {% endif %}
</div>`;

const SETTINGS_SCHEMA = JSON.stringify([
  { name: "theme_info", theme_name: "Kaizen Luxury", theme_author: "Kaizen", theme_version: "1.0.0", theme_documentation_url: "https://kaizen.com", theme_support_url: "https://kaizen.com" }
]);

const SETTINGS_DATA = JSON.stringify({
  current: {}
});

const LOCALE_EN = JSON.stringify({
  general: { password_page: { login_form_heading: "Enter store password", login_form_password_label: "Password", login_form_password_placeholder: "Your password", login_form_submit: "Enter", signup_form_email_label: "Email" } },
  products: { product: { add_to_cart: "Add to Cart", sold_out: "Sold Out", unavailable: "Unavailable" } },
  cart: { general: { title: "Your Cart", empty: "Your cart is empty", checkout: "Check Out", subtotal: "Subtotal" } }
});

const THEME_CSS = `
/* ═══════════════════════════════════════════════════════════
   KAIZEN LUXURY THEME — CSS
   Inspired by premium e-commerce aesthetics
═══════════════════════════════════════════════════════════ */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --gold: #c9a84c;
  --gold-light: #e8c97a;
  --dark: #0d0d0d;
  --dark-2: #1a1a1a;
  --dark-3: #2a2a2a;
  --mid: #555;
  --light: #f8f8f6;
  --white: #ffffff;
  --accent: #1a1a2e;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-heading: 'Playfair Display', Georgia, serif;
  --radius: 8px;
  --shadow: 0 4px 24px rgba(0,0,0,0.08);
  --shadow-hover: 0 12px 40px rgba(0,0,0,0.15);
}

body.kaizen-body { font-family: var(--font-body); color: var(--dark); background: var(--white); line-height: 1.6; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }

/* ── Layout ── */
.container { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
.main-content { min-height: 60vh; }

/* ── Announcement Bar ── */
.announcement-bar { background: var(--dark); color: var(--gold); text-align: center; padding: 10px 20px; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; }

/* ── Header ── */
.site-header { background: var(--white); border-bottom: 1px solid #e8e8e8; position: sticky; top: 0; z-index: 100; }
.header-inner { display: flex; align-items: center; gap: 32px; padding: 0 24px; height: 68px; max-width: 1280px; margin: 0 auto; }
.brand-logo { flex-shrink: 0; }
.logo-text { font-family: var(--font-heading); font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: var(--dark); }
.main-nav { display: flex; gap: 28px; flex: 1; justify-content: center; }
.nav-link { font-size: 14px; font-weight: 500; color: #444; transition: color .2s; letter-spacing: 0.3px; }
.nav-link:hover, .nav-link.active { color: var(--dark); }
.header-actions { display: flex; align-items: center; gap: 16px; margin-left: auto; }
.header-icon { color: var(--dark); transition: color .2s; display: flex; align-items: center; position: relative; }
.header-icon:hover { color: var(--gold); }
.cart-count { position: absolute; top: -8px; right: -8px; background: var(--gold); color: var(--dark); font-size: 10px; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; }
.mobile-nav { display: none; flex-direction: column; background: var(--dark); }
.mobile-nav.open { display: flex; }
.mobile-nav-link { padding: 14px 24px; color: var(--white); font-size: 15px; border-bottom: 1px solid var(--dark-3); }
@media (max-width: 768px) {
  .main-nav { display: none; }
  .mobile-menu-btn { display: flex; }
}

/* ── Buttons ── */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 28px; border-radius: var(--radius); font-size: 14px; font-weight: 600; cursor: pointer; transition: all .25s; border: 2px solid transparent; letter-spacing: 0.5px; }
.btn-primary { background: var(--dark); color: var(--white); }
.btn-primary:hover { background: var(--dark-3); }
.btn-outline { background: transparent; color: var(--white); border-color: rgba(255,255,255,0.6); }
.btn-outline:hover { background: rgba(255,255,255,0.1); border-color: var(--white); }
.btn-outline-dark { background: transparent; color: var(--dark); border: 2px solid var(--dark); }
.btn-outline-dark:hover { background: var(--dark); color: var(--white); }
.btn-gold { background: var(--gold); color: var(--dark); }
.btn-gold:hover { background: var(--gold-light); }
.btn-add-cart { flex: 1; background: var(--dark); color: var(--white); padding: 16px 24px; font-size: 15px; }
.btn-add-cart:hover { background: var(--gold); color: var(--dark); }
.btn-wishlist { background: transparent; color: var(--mid); border: 2px solid #e0e0e0; padding: 16px 20px; }
.btn-checkout { width: 100%; background: var(--gold); color: var(--dark); font-size: 16px; padding: 16px; border: none; border-radius: var(--radius); font-weight: 700; cursor: pointer; margin-bottom: 12px; }
.btn-checkout:hover { background: var(--gold-light); }

/* ── Hero Section ── */
.hero-section { position: relative; min-height: 90vh; display: flex; flex-direction: column; justify-content: center; background: linear-gradient(135deg, var(--dark) 0%, #1a1a2e 50%, #0d0d1a 100%); overflow: hidden; background-size: cover; background-position: center; }
.hero-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 100%); }
.hero-content { position: relative; z-index: 1; padding: 80px 24px 40px; max-width: 1280px; margin: 0 auto; width: 100%; }
.hero-eyebrow { color: var(--gold); font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px; }
.hero-title { font-family: var(--font-heading); font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 700; color: var(--white); line-height: 1.1; margin-bottom: 20px; max-width: 640px; }
.hero-subtitle { font-size: 18px; color: rgba(255,255,255,0.7); margin-bottom: 36px; max-width: 480px; }
.hero-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
.hero-stats { position: relative; z-index: 1; display: flex; align-items: center; gap: 0; padding: 28px 24px; max-width: 1280px; margin: 0 auto; width: 100%; border-top: 1px solid rgba(255,255,255,0.1); margin-top: auto; }
.stat-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.stat-item strong { font-family: var(--font-heading); font-size: 28px; color: var(--gold); font-weight: 700; }
.stat-item span { font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 0.5px; }
.stat-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.15); }

/* ── Trust Section ── */
.trust-section { padding: 40px 0; border-bottom: 1px solid #f0f0f0; }
.trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.trust-item { display: flex; align-items: center; gap: 14px; padding: 16px; }
.trust-icon { font-size: 28px; flex-shrink: 0; }
.trust-item strong { display: block; font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.trust-item p { font-size: 12px; color: var(--mid); margin: 0; }
@media (max-width: 768px) { .trust-grid { grid-template-columns: repeat(2, 1fr); } }

/* ── Section Common ── */
.section-header { text-align: center; margin-bottom: 48px; }
.section-label { font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
.section-title { font-family: var(--font-heading); font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 700; color: var(--dark); }
.section-footer { text-align: center; margin-top: 48px; }

/* ── Product Grid ── */
.featured-section { padding: 80px 0; }
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px; }
.product-card { background: var(--white); border-radius: 12px; overflow: hidden; border: 1px solid #f0f0f0; transition: all .3s; }
.product-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-hover); border-color: #e0e0e0; }
.product-image-wrap { display: block; position: relative; overflow: hidden; aspect-ratio: 1; background: var(--light); }
.product-img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
.product-card:hover .product-img { transform: scale(1.06); }
.product-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 13px; background: #f5f5f5; }
.product-badge { position: absolute; top: 12px; left: 12px; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 4px; letter-spacing: 1px; z-index: 2; }
.product-badge.sale { background: #e63946; color: white; }
.product-badge.new { background: var(--gold); color: var(--dark); }
.product-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding: 20px 16px 16px; transform: translateY(100%); transition: transform .3s; }
.product-card:hover .product-overlay { transform: translateY(0); }
.quick-add { background: var(--white); color: var(--dark); border: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; width: 100%; transition: background .2s; }
.quick-add:hover { background: var(--gold); }
.product-info { padding: 16px; }
.product-vendor { font-size: 11px; color: var(--gold); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
.product-title { font-size: 14px; font-weight: 500; margin-bottom: 6px; line-height: 1.4; color: var(--dark); }
.product-title a:hover { color: var(--gold); }
.product-rating { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
.stars { color: #f5a623; font-size: 13px; }
.review-count { font-size: 11px; color: var(--mid); }
.product-price { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.price { font-size: 16px; font-weight: 700; color: var(--dark); }
.compare-price { font-size: 13px; color: #999; text-decoration: line-through; }
.discount-badge { font-size: 11px; font-weight: 700; color: #e63946; background: #fff0f0; padding: 2px 6px; border-radius: 4px; }

/* ── Split Banner ── */
.banner-split { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.banner-item { min-height: 320px; display: flex; align-items: center; padding: 60px; position: relative; overflow: hidden; }
.banner-item::before { content: ''; position: absolute; inset: 0; opacity: 0.15; }
.banner-content { position: relative; z-index: 1; }
.banner-label { font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
.banner-item h3 { font-family: var(--font-heading); font-size: 2.5rem; font-weight: 700; color: var(--white); margin-bottom: 24px; }
@media (max-width: 640px) { .banner-split { grid-template-columns: 1fr; } .banner-item { padding: 40px 24px; } }

/* ── Newsletter ── */
.newsletter-section { padding: 80px 0; background: var(--light); }
.newsletter-inner { display: flex; align-items: center; justify-content: space-between; gap: 40px; flex-wrap: wrap; }
.newsletter-text h2 { font-family: var(--font-heading); font-size: 2rem; font-weight: 700; margin-bottom: 8px; }
.newsletter-text p { color: var(--mid); }
.newsletter-form { display: flex; gap: 0; max-width: 440px; width: 100%; }
.newsletter-input { flex: 1; padding: 14px 18px; border: 2px solid #e0e0e0; border-radius: var(--radius) 0 0 var(--radius); font-size: 14px; outline: none; }
.newsletter-input:focus { border-color: var(--gold); }
.newsletter-form .btn-gold { border-radius: 0 var(--radius) var(--radius) 0; }
@media (max-width: 768px) { .newsletter-inner { flex-direction: column; } .newsletter-form { width: 100%; } }

/* ── Footer ── */
.site-footer { background: var(--dark); color: rgba(255,255,255,0.7); padding: 64px 0 0; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 48px; border-bottom: 1px solid var(--dark-3); }
.footer-logo { font-family: var(--font-heading); font-size: 22px; color: var(--white); margin-bottom: 12px; }
.footer-brand p { font-size: 13px; line-height: 1.7; margin-bottom: 20px; }
.social-links { display: flex; gap: 12px; }
.social-links a { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--dark-3); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.5); transition: all .2s; }
.social-links a:hover { border-color: var(--gold); color: var(--gold); }
.footer-col h4 { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--white); margin-bottom: 16px; }
.footer-col ul { list-style: none; }
.footer-col ul li { margin-bottom: 10px; }
.footer-col ul li a { font-size: 13px; color: rgba(255,255,255,0.5); transition: color .2s; }
.footer-col ul li a:hover { color: var(--gold); }
.footer-bottom { display: flex; align-items: center; justify-content: space-between; padding: 24px 0; flex-wrap: wrap; gap: 12px; }
.footer-bottom p { font-size: 12px; color: rgba(255,255,255,0.3); }
.payment-icons { display: flex; gap: 8px; }
.payment-icon { font-size: 10px; font-weight: 700; padding: 4px 8px; border: 1px solid var(--dark-3); border-radius: 4px; color: rgba(255,255,255,0.4); }
@media (max-width: 768px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .footer-grid { grid-template-columns: 1fr; } }

/* ── Collection Page ── */
.collection-page { padding-bottom: 80px; }
.collection-hero { background: var(--light); padding: 60px 0; margin-bottom: 40px; text-align: center; }
.collection-hero h1 { font-family: var(--font-heading); font-size: 2.5rem; font-weight: 700; margin-bottom: 8px; }
.collection-hero p { color: var(--mid); max-width: 600px; margin: 0 auto; }
.collection-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #f0f0f0; }
.product-count { font-size: 13px; color: var(--mid); }
.sort-by select { padding: 8px 14px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 13px; cursor: pointer; }
.pagination { display: flex; justify-content: center; gap: 8px; margin-top: 48px; }
.pagination a, .pagination em { padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 14px; }
.pagination em { background: var(--dark); color: white; border-color: var(--dark); font-style: normal; }

/* ── Product Page ── */
.product-page { padding: 60px 0 80px; }
.product-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
.main-image-wrap { border-radius: 12px; overflow: hidden; aspect-ratio: 1; background: var(--light); }
.main-product-img { width: 100%; height: 100%; object-fit: cover; }
.thumbnail-strip { display: flex; gap: 10px; margin-top: 12px; }
.thumb-img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: border-color .2s; }
.thumb-img:hover { border-color: var(--gold); }
.product-vendor-large { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
.product-title-large { font-family: var(--font-heading); font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 700; margin-bottom: 12px; line-height: 1.2; }
.product-rating-large { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
.stars-large { color: #f5a623; font-size: 18px; }
.price-large { font-size: 2rem; font-weight: 700; color: var(--dark); }
.compare-price-large { font-size: 1.1rem; color: #999; text-decoration: line-through; margin-left: 8px; }
.savings { font-size: 13px; font-weight: 700; color: #e63946; background: #fff0f0; padding: 4px 10px; border-radius: 20px; margin-left: 8px; }
.product-price-large { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #f0f0f0; }
.variant-group { margin-bottom: 20px; }
.variant-label { font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
.variant-options { display: flex; gap: 8px; flex-wrap: wrap; }
.variant-btn { padding: 8px 16px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 13px; cursor: pointer; background: white; transition: all .2s; }
.variant-btn:hover, .variant-btn.active { border-color: var(--dark); background: var(--dark); color: white; }
.quantity-row { margin-bottom: 20px; }
.qty-control { display: flex; align-items: center; border: 2px solid #e0e0e0; border-radius: 8px; width: fit-content; overflow: hidden; }
.qty-control button { width: 44px; height: 44px; border: none; background: var(--light); cursor: pointer; font-size: 18px; transition: background .2s; }
.qty-control button:hover { background: #e0e0e0; }
.qty-input { width: 60px; height: 44px; text-align: center; border: none; border-left: 2px solid #e0e0e0; border-right: 2px solid #e0e0e0; font-size: 15px; outline: none; }
.product-actions { display: flex; gap: 12px; margin-bottom: 20px; }
.product-trust-mini { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--mid); margin-bottom: 28px; padding: 14px; background: var(--light); border-radius: 8px; }
.product-description { border-top: 1px solid #f0f0f0; padding-top: 24px; }
.product-description h3 { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
.product-description p, .product-description li { font-size: 14px; color: #444; line-height: 1.7; margin-bottom: 8px; }
@media (max-width: 768px) { .product-layout { grid-template-columns: 1fr; } }

/* ── Cart Page ── */
.cart-page { padding: 60px 0 80px; }
.cart-page h1 { font-family: var(--font-heading); font-size: 2rem; margin-bottom: 40px; }
.cart-layout { display: grid; grid-template-columns: 1fr 360px; gap: 40px; align-items: start; }
.cart-item { display: flex; align-items: center; gap: 16px; padding: 20px 0; border-bottom: 1px solid #f0f0f0; }
.cart-item-img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #f0f0f0; }
.cart-item-details { flex: 1; }
.cart-item-details h3 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.cart-item-variant { font-size: 12px; color: var(--mid); }
.cart-item-price { font-size: 15px; font-weight: 700; margin-top: 4px; }
.cart-item-qty { display: flex; align-items: center; gap: 12px; }
.cart-item-qty a { font-size: 18px; color: var(--mid); padding: 4px 8px; }
.cart-item-qty span { font-size: 15px; font-weight: 600; }
.cart-item-total { font-weight: 700; font-size: 15px; min-width: 70px; text-align: right; }
.cart-remove { color: #999; font-size: 14px; padding: 4px; }
.cart-summary { background: var(--light); border-radius: 12px; padding: 28px; position: sticky; top: 90px; }
.cart-summary h3 { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
.summary-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 12px; color: var(--mid); }
.summary-total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; margin: 16px 0 20px; padding-top: 16px; border-top: 2px solid #e0e0e0; }
.continue-shopping { display: block; text-align: center; font-size: 13px; color: var(--mid); margin-top: 12px; }
.continue-shopping:hover { color: var(--dark); }
.empty-cart { text-align: center; padding: 80px 0; }
.empty-cart p { font-size: 18px; color: var(--mid); margin-bottom: 24px; }
@media (max-width: 768px) { .cart-layout { grid-template-columns: 1fr; } }
`;

// ── DEPLOY FUNCTION ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!shopDomain) return Response.json({ error: 'SHOPIFY_STORE_DOMAIN not set' }, { status: 500 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session. Complete OAuth first.' }, { status: 401 });

  // 1. Create the theme
  const themeRes = await shopifyRequest(shopDomain, token, 'POST', 'themes.json', {
    theme: { name: 'Kaizen Luxury 1.0', role: 'unpublished' }
  });
  const themeId = themeRes.theme.id;

  // Wait for theme to be processed
  await new Promise(r => setTimeout(r, 3000));

  // 2. Upload all assets
  const assets = [
    ['layout/theme.liquid', LAYOUT_THEME],
    ['sections/announcement-bar.liquid', SECTION_ANNOUNCEMENT],
    ['sections/header.liquid', SECTION_HEADER],
    ['sections/hero-banner.liquid', SECTION_HERO],
    ['sections/trust-badges.liquid', SECTION_TRUST],
    ['sections/featured-products.liquid', SECTION_FEATURED_PRODUCTS],
    ['sections/banner-split.liquid', SECTION_BANNER_SPLIT],
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
      await new Promise(r => setTimeout(r, 300)); // rate limit buffer
    } catch (e) {
      results.push({ key, ok: false, error: e.message });
    }
  }

  const { activate } = await req.clone().json().catch(() => ({})) || {};

  // 3. Optionally publish
  if (activate) {
    await shopifyRequest(shopDomain, token, 'PUT', `themes/${themeId}.json`, {
      theme: { id: themeId, role: 'main' }
    });
  }

  return Response.json({
    success: true,
    theme_id: themeId,
    theme_name: 'Kaizen Luxury 1.0',
    activated: !!activate,
    assets_uploaded: results.filter(r => r.ok).length,
    assets_failed: results.filter(r => !r.ok).length,
    failed_assets: results.filter(r => !r.ok),
    shopify_themes_url: `https://${shopDomain}/admin/themes`,
  });
});