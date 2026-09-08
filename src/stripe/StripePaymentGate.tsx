'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';

interface Props {
  engine?: string;
  apiUrl: string;
  resource: 'invoice' | 'cart';
  resourceId: number;
  resourceToken?: string;
  sessionToken?: string;
  legacy: React.ReactNode;
  children: React.ReactNode;
}

/** Missing hints from older APIs keep the original form independent of new endpoints. */
export function StripePaymentGate(props: Props) {
  const base = `${props.apiUrl.replace(/\/$/, '')}/payments/stripe/${props.resource}/${props.resourceId}/`;
  let returning = false;
  if (typeof window !== 'undefined') {
    returning = !!new URL(window.location.href).searchParams.get('merchi_payment_attempt');
    try { returning = returning || !!sessionStorage.getItem(`merchi-payment:${base}attempts/`); } catch { /* Optional storage. */ }
  }
  if (props.engine !== 'wallet' && !returning) return <>{props.legacy}</>;
  return <VerifiedStripePaymentGate {...props} />;
}

/** Only opted-in or already-started wallet payments require a mode lookup. */
function VerifiedStripePaymentGate({ apiUrl, resource, resourceId, resourceToken, sessionToken, legacy, children }: Props) {
  const [state, setState] = useState<{ key: string; engine?: string; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const base = `${apiUrl.replace(/\/$/, '')}/payments/stripe/${resource}/${resourceId}/`;
  const key = `${base}:${resourceToken || ''}:${sessionToken || ''}`;
  useEffect(() => {
    const controller = new AbortController();
    const storageKey = `merchi-payment:${base}attempts/`;
    const url = new URL(`${base}mode/`);
    if (resourceToken) url.searchParams.set(`${resource}_token`, resourceToken);
    if (sessionToken) url.searchParams.set('session_token', sessionToken);
    let attempt = new URL(window.location.href).searchParams.get('merchi_payment_attempt');
    try { attempt = attempt || sessionStorage.getItem(storageKey); } catch { /* Optional storage. */ }
    if (attempt) url.searchParams.set('attemptId', attempt);
    fetch(url.toString(), { cache: 'no-store', signal: controller.signal }).then(async response => {
      // Older backends have no mode endpoint and retain their original card UI.
      if (response.status === 404) return { engine: 'legacy' };
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not check payment availability.');
      if (!['legacy', 'wallet'].includes(data.engine)) throw new Error('Invalid payment configuration.');
      return data;
    }).then(data => {
      if (controller.signal.aborted) return;
      if (data.attemptId) {
        try { sessionStorage.setItem(storageKey, data.attemptId); } catch { /* Optional storage. */ }
      }
      setState({ key, engine: data.engine });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, error: error.message });
    });
    return () => controller.abort();
  }, [base, key, resource, resourceToken, sessionToken, retry]);
  if (state?.key !== key) return <p role="status">Checking payment options…</p>;
  if (state.error) return <div role="alert">{state.error}<button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>;
  return <>{state.engine === 'wallet' ? children : legacy}</>;
}
