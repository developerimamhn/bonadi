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

test('validOrder accepts real BD numbers and rejects bad input', async () => {
  const { validOrder } = await import('./order.js');
  const f = (phone, name = 'Shafi', address = 'House 5, Road 2, Dhaka') => ({ name, phone, address });
  for (const p of ['01712345678', '+8801712345678', '8801712345678', '017-1234-5678', '01912 345 678']) assert.equal(validOrder(f(p)), true, p);
  for (const p of ['0171234567', '01212345678', '1712345678', '+8811712345678', 'abc']) assert.equal(validOrder(f(p)), false, p);
  assert.equal(validOrder(f('01712345678', 'A')), false, 'name too short');
  assert.equal(validOrder(f('01712345678', 'Shafi', 'Dhaka')), false, 'address too short');
});
