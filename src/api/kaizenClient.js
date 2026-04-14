/**
 * Kaizen API Client — replaces @base44/sdk
 * Direct fetch calls to our Express backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

let authToken = null;

export function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('kaizen_token', token);
  } else {
    localStorage.removeItem('kaizen_token');
  }
}

export function getToken() {
  if (!authToken) {
    authToken = localStorage.getItem('kaizen_token');
  }
  return authToken;
}

// Auto-load token on import
getToken();

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.error || 'HTTP ' + res.status);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────

const auth = {
  register: (data) =>
    apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => apiRequest('/auth/me'),

  logout: (redirectUrl) => {
    setToken(null);
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  redirectToLogin: (returnUrl) => {
    window.location.href = '/login?return=' + encodeURIComponent(returnUrl || window.location.href);
  },
};

// ── Entity helpers ────────────────────────────────────────────────────

function entityEndpoints(name) {
  return {
    list: (sort, limit) =>
      apiRequest('/' + name + '?sort=' + (sort || 'created_at') + '&order=desc&limit=' + (limit || 100)),

    filter: (where, sort, limit) => {
      const params = new URLSearchParams({ sort: sort || 'created_at', order: 'desc', limit: String(limit || 100) });
      if (where) Object.entries(where).forEach(function (k, v) { params.set(k, v); });
      return apiRequest('/' + name + '?' + params);
    },

    get: (id) => apiRequest('/' + name + '/' + id),

    create: (data) =>
      apiRequest('/' + name, { method: 'POST', body: JSON.stringify(data) }),

    update: (id, data) =>
      apiRequest('/' + name + '/' + id, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id) =>
      apiRequest('/' + name + '/' + id, { method: 'DELETE' }),
  };
}

// ── Entities (Proxy for base44.entities.EntityName access) ───────────

const entities = new Proxy({}, {
  get: function (_target, prop) {
    if (typeof prop === 'string' && prop !== 'then' && prop !== 'toJSON' && prop !== 'Symbol(Symbol.toPrimitive)') {
      return entityEndpoints(prop);
    }
    return undefined;
  },
});

// ── Function name → route mapping ────────────────────────────────────

const functionRoutes = {
  agentResearch: '/agent-research',
  automatedPipeline: '/automated-pipeline',
  bulkGenerateInfluencers: '/influencer/generate-bulk',
  bulkSendOutreach: '/outreach/send',
  importResearchProduct: '/import-research-product',
  influencerDiscovery: '/influencer-discovery',
  sendOutreachMessages: '/outreach/send',
  sendInfluencerPitch: '/influencer/send-pitch',
  getShopifyProducts: '/shopify/products',
  publishAllDrafts: '/shopify/publish-all-drafts',
  publishProductsToStorefront: '/shopify/publish-to-storefront',
  shopifyOAuth: '/shopify/store-token',
  createShopifyPages: '/shopify/create-pages',
  fixShopifyCollections: '/shopify/fix-collections',
  populateCollections: '/shopify/populate-collections',
  fixProductImages: '/shopify/fix-images',
  disableInventoryTracking: '/shopify/disable-inventory',
  orderRouter: '/order-router',
  pipelineTest: '/pipeline-test',
  productPipelineTest: '/product-pipeline-test',
};

const functions = {
  invoke: function (name, payload) {
    var route = functionRoutes[name];
    if (!route) throw new Error('Unknown function: ' + name);
    return apiRequest(route, { method: 'POST', body: JSON.stringify(payload) }).then(function (data) {
      return { data: data };
    });
  },
};

// ── LLM / Email integrations ─────────────────────────────────────────

const integrations = {
  Core: {
    InvokeLLM: function (params) {
      return apiRequest('/llm/invoke', { method: 'POST', body: JSON.stringify(params) });
    },
    SendEmail: function (params) {
      return apiRequest('/email/send', { method: 'POST', body: JSON.stringify(params) });
    },
  },
};

// ── Default export (backward-compatible shape) ───────────────────────

export default {
  auth: auth,
  entities: entities,
  functions: functions,
  integrations: integrations,
};
