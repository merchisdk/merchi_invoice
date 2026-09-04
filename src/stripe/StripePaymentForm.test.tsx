import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StripePaymentForm } from './StripePaymentForm';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), elementOptions: [] as any[] }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div>{children}</div>,
  PaymentElement: ({ onReady, options }: any) => {
    React.useEffect(() => { onReady(); }, []);
    mocks.elementOptions.push(options);
    return <div>Credit card | WeChat Pay | Alipay</div>;
  },
  useStripe: () => ({ confirmPayment: mocks.confirm }),
  useElements: () => ({}),
}));

const pending = { id: 'attempt-1', status: 'requires_payment_method', recorded: false, amountMinor: 1234,
  amountMajor: '12.34', currency: 'aud', publishableKey: 'pk_test_fixture', stripeClientSecret: 'pi_fixture_secret_test',
  methods: ['card', 'wechat_pay', 'alipay'] };
const options = { amountMinor: 5000, currency: 'aud', minorUnitFactor: 100 };
let requests: Array<{ url: string; method: string; body?: any }>;
let status: any;
let postError = false;

beforeEach(() => {
  requests = []; status = pending; postError = false;
  mocks.confirm.mockReset().mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
  mocks.elementOptions.length = 0;
  sessionStorage.clear();
  history.replaceState({}, '', '/invoice/1');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
    requests.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    if (String(url).includes('/options/')) return { ok: true, json: async () => options };
    if (postError && init.method === 'POST') throw new Error('Network disconnected');
    return { ok: true, json: async () => init.method === 'POST' ? pending : status };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(onSuccess = vi.fn()) {
  render(<StripePaymentForm apiUrl="https://api.example/v6/" resource="invoice" resourceId={1}
    resourceToken="invoice-token" allowPartial onSuccess={onSuccess} />);
  return onSuccess;
}

describe('shared Stripe payment form', () => {
  it('defaults to full amount, uses account key and presents the wallet selector', async () => {
    setup();
    await screen.findByText('Pay full balance');
    expect((screen.getByRole('radio', { name: 'Pay full balance' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByText('Continue to payment'));
    await screen.findByText('Credit card | WeChat Pay | Alipay');
    const post = requests.find(request => request.method === 'POST')!;
    expect(post.body.amountMinor).toBeUndefined();
    expect(post.url).toContain('invoice_token=invoice-token');
    expect(mocks.elementOptions.at(-1).paymentMethodOrder).toEqual(['card', 'wechat_pay', 'alipay']);
  });

  it('sends a partial amount as minor units and rejects excess precision', async () => {
    setup();
    fireEvent.click(await screen.findByRole('radio', { name: 'Pay a partial amount' }));
    fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '12.345' } });
    fireEvent.click(screen.getByText('Continue to payment'));
    expect(requests.some(request => request.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '12.34' } });
    fireEvent.click(screen.getByText('Continue to payment'));
    await screen.findByText('Credit card | WeChat Pay | Alipay');
    expect(requests.find(request => request.method === 'POST')!.body.amountMinor).toBe(1234);
  });

  it('does not report success from the Stripe browser response before server booking', async () => {
    const completed = setup();
    fireEvent.click(await screen.findByText('Continue to payment'));
    await screen.findByText('Credit card | WeChat Pay | Alipay');
    fireEvent.click(screen.getByRole('button', { name: 'Pay', exact: true } as any));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
    await waitFor(() => expect(requests.some(request => request.url.includes('/attempt-1/'))).toBe(true));
    expect(completed).not.toHaveBeenCalled();
    status = { ...pending, recorded: true, status: 'succeeded', invoice: { id: 1, unpaid: true } };
    fireEvent.click(screen.getByText('Check payment status'));
    await waitFor(() => expect(completed).toHaveBeenCalledWith({ id: 1, unpaid: true }));
  });

  it('recovers a redirect and removes the client secret from the URL', async () => {
    history.replaceState({}, '', '/invoice/1?merchi_payment_attempt=attempt-1&payment_intent_client_secret=secret');
    status = { ...pending, recorded: true, status: 'succeeded', invoice: { id: 1 } };
    const completed = setup();
    await waitFor(() => expect(completed).toHaveBeenCalledOnce());
    expect(location.search).toBe('');
    expect(requests.some(request => request.method === 'POST')).toBe(false);
  });

  it('reuses the idempotency key when the start response is lost', async () => {
    postError = true;
    setup();
    fireEvent.click(await screen.findByText('Continue to payment'));
    await screen.findByRole('alert');
    postError = false;
    fireEvent.click(screen.getByText('Continue to payment'));
    await screen.findByText('Credit card | WeChat Pay | Alipay');
    const posts = requests.filter(request => request.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0].body.requestKey).toBe(posts[1].body.requestKey);
  });

  it('keeps a payment that succeeds while cancellation is requested', async () => {
    const completed = setup();
    fireEvent.click(await screen.findByText('Continue to payment'));
    await screen.findByText('Credit card | WeChat Pay | Alipay');
    status = { ...pending, recorded: true, status: 'succeeded', invoice: { id: 1 } };
    fireEvent.click(screen.getByText('Cancel payment / change amount'));
    await waitFor(() => expect(completed).toHaveBeenCalledOnce());
  });
});
