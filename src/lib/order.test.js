import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

const { supabase } = await import('./supabase.js');
const { submitOrder } = await import('./order.js');

test('submitOrder sends a notification after successful checkout', async () => {
  let rpcCalls = 0;
  let invoked = false;

  Object.defineProperty(supabase, 'rpc', {
    value: async (...args) => {
      rpcCalls += 1;
      assert.deepEqual(args[0], 'place_order');
      return { data: 123, error: null };
    },
    configurable: true,
  });

  Object.defineProperty(supabase, 'functions', {
    value: {
      invoke: async (name, payload) => {
        invoked = true;
        assert.equal(name, 'send-order-email');
        assert.equal(payload.body.order_id, 123);
        return { data: { ok: true }, error: null };
      },
    },
    configurable: true,
  });

  const result = await submitOrder(
    { name: 'Shafi', phone: '01712345678', address: 'Dhaka' },
    [{ id: 'p1', qty: 2 }],
    false
  );

  assert.equal(rpcCalls, 1);
  assert.equal(invoked, true);
  assert.equal(result.data, 123);
  assert.equal(result.error, null);
});
