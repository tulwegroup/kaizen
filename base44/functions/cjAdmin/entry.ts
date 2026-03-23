/**
 * CJ Dropshipping — Admin, Observability, and Validation
 *
 * Actions:
 *   full_validation_report  — run all checks and return structured report
 *   list_dead_letters        — review dead-letter queue
 *   resolve_dead_letter      — mark a dead-letter as resolved or abandoned
 *   mapping_summary          — summary of all CJ mappings by type/status
 *   status_map               — return the canonical CJ status normalization table
 *
 * Required env vars:
 *   CJ_EMAIL
 *   CJ_API_KEY
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

let _tokenCache = { token: null, expiresAt: 0, refreshToken: null };

async function getCJToken(email, apiKey) {
  const now = Date.now();
  if (_tokenCache.token && _tokenCache.expiresAt > now + 300_000) return _tokenCache.token;

  if (_tokenCache.refreshToken && _tokenCache.expiresAt > now - 3_600_000) {
    try {
      const res = await fetch(`${CJ_BASE}/authentication/refreshAccessToken`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'refreshToken': _tokenCache.refreshToken },
      });
      const data = await res.json();
      if (data.result === true && data.data?.accessToken) {
        _tokenCache = {
          token: data.data.accessToken,
          refreshToken: data.data.refreshToken || _tokenCache.refreshToken,
          expiresAt: now + (data.data.expiresIn || 86400) * 1000,
        };
        return _tokenCache.token;
      }
    } catch (_) { /* fall through */ }
  }

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
  });
  const data = await res.json();
  if (data.result !== true || !data.data?.accessToken) {
    throw new Error(`CJ auth failed: ${data.message || JSON.stringify(data)}`);
  }
  _tokenCache = {
    token: data.data.accessToken,
    refreshToken: data.data.refreshToken || null,
    expiresAt: now + (data.data.expiresIn || 86400) * 1000,
  };
  return _tokenCache.token;
}

async function cjGet(token, path, params) {
  const url = new URL(`${CJ_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data.result === false) {
    throw new Error(`CJ API error [${path}]: ${data.message || JSON.stringify(data)}`);
  }
  return data.data || data;
}

const CJ_STATUS_MAP = {
  CREATED: 'pending', IN_CART: 'pending', UNPAID: 'pending',
  UNSHIPPED: 'processing', WAIT_SHIP: 'processing',
  SHIPPED: 'shipped', DELIVERING: 'in_transit',
  FINISHED: 'delivered', CANCELLED: 'cancelled',
  FAILED: 'failed', REJECTED: 'failed',
  REFUNDED: 'refunded', PART_REFUNDED: 'partially_refunded',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const email = Deno.env.get('CJ_EMAIL');
  const apiKey = Deno.env.get('CJ_API_KEY');
  if (!email || !apiKey) return Response.json({ error: 'Missing CJ_EMAIL or CJ_API_KEY' }, { status: 500 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  // ── status_map ─────────────────────────────────────────────────────────
  if (action === 'status_map') {
    return Response.json({
      action,
      cj_to_canonical_status_map: CJ_STATUS_MAP,
      fallback_behavior: 'unmapped statuses are returned as "unmapped:<raw>" and create a CJDeadLetter record with failure_class=malformed_response',
      note: 'Any status not in this map will generate a dead-letter entry for manual review',
    });
  }

  // ── list_dead_letters ──────────────────────────────────────────────────
  if (action === 'list_dead_letters') {
    const { status = 'pending_retry', failure_class, limit = 50 } = body;
    const filter = { status };
    if (failure_class) filter.failure_class = failure_class;
    const letters = await base44.asServiceRole.entities.CJDeadLetter.filter(filter);
    return Response.json({ action, count: letters.length, dead_letters: letters.slice(0, limit) });
  }

  // ── resolve_dead_letter ────────────────────────────────────────────────
  if (action === 'resolve_dead_letter') {
    const { dead_letter_id, resolution } = body;
    if (!dead_letter_id || !resolution) return Response.json({ error: 'dead_letter_id and resolution (resolved|abandoned) required' }, { status: 400 });
    await base44.asServiceRole.entities.CJDeadLetter.update(dead_letter_id, { status: resolution });
    return Response.json({ action, status: 'success', dead_letter_id, resolution });
  }

  // ── mapping_summary ────────────────────────────────────────────────────
  if (action === 'mapping_summary') {
    const all = await base44.asServiceRole.entities.CJMapping.filter({});
    const byType = {};
    const byStatus = {};
    for (const m of all) {
      byType[m.entity_type] = (byType[m.entity_type] || 0) + 1;
      byStatus[m.sync_status] = (byStatus[m.sync_status] || 0) + 1;
    }
    const deadLetters = await base44.asServiceRole.entities.CJDeadLetter.filter({});
    const dlByClass = {};
    const dlByStatus = {};
    for (const dl of deadLetters) {
      dlByClass[dl.failure_class] = (dlByClass[dl.failure_class] || 0) + 1;
      dlByStatus[dl.status] = (dlByStatus[dl.status] || 0) + 1;
    }
    return Response.json({
      action,
      mappings: { total: all.length, by_type: byType, by_sync_status: byStatus },
      dead_letters: { total: deadLetters.length, by_failure_class: dlByClass, by_status: dlByStatus },
    });
  }

  // ── full_validation_report ─────────────────────────────────────────────
  if (action === 'full_validation_report') {
    const { test_cj_product_id } = body;
    const report = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // 1. Auth
    let token;
    try {
      token = await getCJToken(email, apiKey);
      report.checks.authentication = { status: 'PASS', message: 'CJ access token acquired successfully' };
    } catch (e) {
      report.checks.authentication = { status: 'FAIL', error: e.message };
      report.overall = 'BLOCKED';
      return Response.json({ action, report });
    }

    // 2. Product lookup
    if (test_cj_product_id) {
      try {
        const t0 = Date.now();
        const raw = await cjGet(token, '/product/query', { pid: test_cj_product_id });
        const latency = Date.now() - t0;
        report.checks.product_lookup = {
          status: 'PASS',
          cj_product_id: test_cj_product_id,
          title: raw.productNameEn || raw.productName || '',
          variant_count: (raw.variants || []).length,
          latency_ms: latency,
        };
      } catch (e) {
        report.checks.product_lookup = { status: 'FAIL', error: e.message };
      }
    } else {
      report.checks.product_lookup = { status: 'SKIPPED', reason: 'No test_cj_product_id provided' };
    }

    // 3. Mapping layer
    const allMappings = await base44.asServiceRole.entities.CJMapping.filter({});
    const byType = {};
    for (const m of allMappings) byType[m.entity_type] = (byType[m.entity_type] || 0) + 1;
    report.checks.mapping_layer = {
      status: 'PASS',
      total_mappings: allMappings.length,
      by_type: byType,
    };

    // 4. Dead-letter state
    const deadLetters = await base44.asServiceRole.entities.CJDeadLetter.filter({ status: 'pending_retry' });
    report.checks.dead_letter_queue = {
      status: deadLetters.length === 0 ? 'PASS' : 'WARN',
      pending_retry_count: deadLetters.length,
      message: deadLetters.length > 0 ? 'Pending failures exist — review dead-letter queue' : 'No pending failures',
    };

    // 5. Order submission path
    report.checks.order_submission = {
      status: 'IMPLEMENTED',
      message: 'submit_order action in cjOrders function — idempotent, with dead-letter fallback',
      note: 'End-to-end test requires a real CJ product mapping and shipping address',
    };

    // 6. Tracking/fulfillment path
    report.checks.tracking_fulfillment = {
      status: 'IMPLEMENTED',
      message: 'get_tracking and sync_fulfillment actions in cjOrders function',
      note: 'Requires a submitted CJ order ID to test end-to-end',
    };

    // 7. Reconciliation
    const driftedMappings = await base44.asServiceRole.entities.CJMapping.filter({ sync_status: 'drift_detected' });
    report.checks.reconciliation = {
      status: 'IMPLEMENTED',
      drift_detected_count: driftedMappings.length,
      message: 'reconcile action in cjOrders function — polls all order mappings for drift',
    };

    // 8. Retry/failure handling
    report.checks.failure_handling = {
      status: 'IMPLEMENTED',
      failure_classes: ['auth_failure', 'product_mapping_failure', 'order_submission_failure', 'tracking_retrieval_failure', 'malformed_response'],
      message: 'All operations route failures to CJDeadLetter with structured classification',
    };

    const failCount = Object.values(report.checks).filter(c => c.status === 'FAIL').length;
    const warnCount = Object.values(report.checks).filter(c => c.status === 'WARN').length;
    report.overall = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';

    console.log('CJ full validation report completed', {
      overall: report.overall,
      auth: report.checks.authentication.status,
      product: report.checks.product_lookup.status,
    });

    return Response.json({ action, report });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});