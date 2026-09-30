import { expect, expectTypeOf, it, vi } from 'vitest';
import { BotoZap } from '../src/index.js';

it.each([true, false, undefined])('serializes agent_paused=%s without dropping the business filter or cursor', async (agent_paused) => {
  const rows = [{ id: 'conversation', agent_paused_at: '2026-09-30T12:00:00Z' }, { id: 'running', agent_paused_at: null }];
  const fetch = vi.fn(async (_input: RequestInfo | URL) => Response.json({ data: rows, paging: { next: 'next', previous: null } }));
  const client = new BotoZap({ apiKey: 'bz_live_test', baseUrl: 'https://api.test/v1', fetch });
  const result = await client.conversations.list({ customer_id: 'business', agent_paused, after: 'cursor', limit: 100 });
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(url.pathname).toBe('/v1/conversations');
  expect(url.searchParams.get('customer_id')).toBe('business');
  expect(url.searchParams.get('agent_paused')).toBe(agent_paused === undefined ? null : String(agent_paused));
  expect(url.searchParams.get('after')).toBe('cursor');
  expect(url.searchParams.get('limit')).toBe('100');
  expect(result.data).toEqual(rows);
  expect(result.paging.next).toBe('next');
  expectTypeOf(result.data[0].agent_paused_at).toEqualTypeOf<string | null | undefined>();
});
