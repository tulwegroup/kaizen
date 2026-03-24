/**
 * Tracking Sync — CJ → Shopify
 * Polls CJ for tracking on all routed orders and pushes fulfillments to Shopify.
 * Runs on a schedule (e.g., every 5 minutes).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  // Fetch all CJ order mappings that have been synced
  const cjOrders = await base44.asServiceRole.entities.CJMapping.filter({
    entity_type: 'order',
    sync_status: 'synced',
  });

  console.log(`Tracking sync started — processing ${cjOrders.length} CJ orders`);

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    no_tracking_yet: 0,
    errors: [],
  };

  for (const orderMap of cjOrders) {
    results.processed++;

    try {
      // Call orderRouter to push tracking to Shopify
      const routeRes = await base44.asServiceRole.functions.invoke('orderRouter', {
        action: 'push_tracking_to_shopify',
        canonical_order_id: orderMap.canonical_id,
      });

      const routeData = routeRes.data;

      if (routeData.status === 'success') {
        results.succeeded++;
        console.log('Tracking pushed to Shopify', {
          canonical_id: orderMap.canonical_id,
          tracking_number: routeData.tracking_number,
        });
      } else if (routeData.status === 'no_tracking_yet') {
        results.no_tracking_yet++;
      } else {
        results.failed++;
        results.errors.push({
          canonical_id: orderMap.canonical_id,
          reason: routeData.status,
          detail: routeData.error || routeData.message,
        });
      }
    } catch (e) {
      results.failed++;
      results.errors.push({
        canonical_id: orderMap.canonical_id,
        reason: 'exception',
        detail: e.message,
      });
      console.error('Tracking sync error', { canonical_id: orderMap.canonical_id, error: e.message });
    }
  }

  console.log('Tracking sync complete', results);

  return Response.json({
    action: 'tracking_sync',
    timestamp: new Date().toISOString(),
    ...results,
  });
});