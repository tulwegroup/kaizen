import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function PipelineTest() {
  const [step, setStep] = useState('intro');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cjProductId, setCjProductId] = useState('');
  const [cjSku, setCjSku] = useState('');
  const [error, setError] = useState('');

  const runStep = async (action) => {
    setLoading(true);
    setError('');
    try {
      const payload = { action };
      if (action === 'map_to_cj') {
        payload.cj_product_id = cjProductId;
        payload.cj_sku = cjSku;
      }
      const res = await base44.functions.invoke('productPipelineTest', payload);
      setResult(res.data);
      setStep(action);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-slate-900">Phase 1 — Pipeline Validation</h1>
        <p className="text-slate-600 mb-8">Test: Product → CJ → Shopify</p>

        {/* Progress Bar */}
        <div className="mb-8 flex items-center justify-between">
          {['create', 'map', 'sync', 'verify'].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  ['create_test_product', 'map_to_cj', 'sync_to_shopify', 'verify_in_shopify'].indexOf(step) >= i
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-300 text-slate-600'
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && <div className="flex-1 h-1 mx-2 bg-slate-300" />}
            </div>
          ))}
        </div>

        {/* Step 1: Create Test Product */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Create Test Product</h2>
          <p className="text-slate-600 mb-4">
            Creates a canonical test product with one variant ready for CJ mapping.
          </p>
          <Button
            onClick={() => runStep('create_test_product')}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating...' : 'Create Test Product'}
          </Button>
          {step === 'create_test_product' && result && (
            <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </Card>

        {/* Step 2: Map to CJ */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 2: Map to CJ Product</h2>
          <p className="text-slate-600 mb-4">
            Get a product ID + SKU from your CJ dashboard (Source → Products), then paste here.
          </p>
          <div className="space-y-4 mb-4">
            <Input
              placeholder="CJ Product ID (e.g. 123456)"
              value={cjProductId}
              onChange={(e) => setCjProductId(e.target.value)}
            />
            <Input
              placeholder="CJ SKU (e.g. ABC-123)"
              value={cjSku}
              onChange={(e) => setCjSku(e.target.value)}
            />
          </div>
          <Button
            onClick={() => runStep('map_to_cj')}
            disabled={!cjProductId || !cjSku || loading}
            className="w-full"
          >
            {loading ? 'Mapping...' : 'Map to CJ'}
          </Button>
          {step === 'map_to_cj' && result && (
            <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </Card>

        {/* Step 3: Sync to Shopify */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 3: Sync to Shopify</h2>
          <p className="text-slate-600 mb-4">
            Pushes the product to your Shopify store. Will appear in Products → All Products.
          </p>
          <Button
            onClick={() => runStep('sync_to_shopify')}
            disabled={step !== 'map_to_cj' || loading}
            className="w-full"
          >
            {loading ? 'Syncing...' : 'Sync to Shopify'}
          </Button>
          {step === 'sync_to_shopify' && result && (
            <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </Card>

        {/* Step 4: Verify */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 4: Verify in Shopify</h2>
          <p className="text-slate-600 mb-4">
            Confirms product is visible in your Shopify store.
          </p>
          <Button
            onClick={() => runStep('verify_in_shopify')}
            disabled={step !== 'sync_to_shopify' || loading}
            className="w-full"
          >
            {loading ? 'Verifying...' : 'Verify in Shopify'}
          </Button>
          {step === 'verify_in_shopify' && result && (
            <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </Card>

        {/* Errors */}
        {error && (
          <Card className="p-6 bg-red-50 border-red-200">
            <p className="text-red-600 font-semibold">Error:</p>
            <p className="text-red-500 text-sm mt-2">{error}</p>
          </Card>
        )}

        {/* Success Message */}
        {step === 'verify_in_shopify' && result?.status === 'success' && (
          <Card className="p-6 bg-green-50 border-green-200">
            <p className="text-green-600 font-semibold">✅ Phase 1 Complete!</p>
            <p className="text-green-700 text-sm mt-2">
              Product is live in Shopify. Now test a real order to trigger CJ fulfillment.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}