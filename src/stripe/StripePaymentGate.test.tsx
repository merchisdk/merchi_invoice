import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { StripePaymentGate } from './StripePaymentGate';

const fetchMock = vi.fn();
const props = { apiUrl: 'https://api.example/v6/', resource: 'invoice' as const, resourceId: 1,
  resourceToken: 'invoice-token', legacy: <div>Original card form</div>, children: <div>Wallet form</div> };

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); sessionStorage.clear(); window.history.replaceState({}, '', '/'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('payment engine routing', () => {
  it('uses the original form when the server disables the new engine', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ engine: 'legacy' }) });
    render(<StripePaymentGate {...props} />);
    await screen.findByText('Original card form');
    expect(screen.queryByText('Wallet form')).toBeNull();
    const request = new URL(fetchMock.mock.calls[0][0]);
    expect(request.pathname).toBe('/v6/payments/stripe/invoice/1/mode/');
    expect(request.searchParams.get('invoice_token')).toBe('invoice-token');
    expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
  });
  it('waits for the server before mounting either payment form', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<StripePaymentGate {...props} />);
    expect(screen.queryByText('Original card form')).toBeNull();
    expect(screen.queryByText('Wallet form')).toBeNull();
  });
  it('uses the new form only when the server selects it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ engine: 'wallet', attemptId: 'attempt-existing' }) });
    render(<StripePaymentGate {...props} />);
    await screen.findByText('Wallet form');
    expect(sessionStorage.getItem('merchi-payment:https://api.example/v6/payments/stripe/invoice/1/attempts/')).toBe('attempt-existing');
  });
  it('keeps older backends on their original form', async () => {
    fetchMock.mockResolvedValue({ status: 404 });
    render(<StripePaymentGate {...props} />);
    await screen.findByText('Original card form');
  });
  it('does not silently select another engine after a server failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ message: 'Temporary failure' }) });
    render(<StripePaymentGate {...props} />);
    await screen.findByRole('alert');
    expect(screen.queryByText('Original card form')).toBeNull();
    expect(screen.queryByText('Wallet form')).toBeNull();
  });
  it('passes a returning attempt to the authorized mode endpoint', async () => {
    window.history.replaceState({}, '', '/?merchi_payment_attempt=returning');
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ engine: 'wallet', attemptId: 'returning' }) });
    render(<StripePaymentGate {...props} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('attemptId')).toBe('returning');
    await screen.findByText('Wallet form');
  });
});
