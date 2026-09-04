'use client';

import * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';

export interface StripePaymentFormProps {
  apiUrl: string;
  resource: 'invoice' | 'cart';
  resourceId: number;
  resourceToken?: string;
  sessionToken?: string;
  allowPartial?: boolean;
  onSuccess: (invoice: any) => void;
  onError?: (message: string) => void;
  onBack?: () => void;
  dark?: boolean;
  locale?: 'en' | 'zh' | 'ko';
}

interface Attempt {
  id: string;
  status: string;
  recorded: boolean;
  invoice?: any;
  amountMinor: number;
  amountMajor: string;
  currency: string;
  publishableKey: string;
  stripeClientSecret?: string;
  methods: string[];
}

const messages = {
  en: { full: 'Pay full balance', partial: 'Pay a partial amount', amount: 'Payment amount', continue: 'Continue to payment', pay: 'Pay', cancel: 'Cancel payment / change amount', back: 'Back', loading: 'Checking payment…', pending: 'Payment is awaiting confirmation. You can safely return later.', retry: 'Check payment status', invalid: 'Enter an amount greater than zero, with no more than two decimal places.', success: 'Payment recorded', secure: 'Secure payment by Stripe', resume: 'Resume payment', methods: 'Credit card · WeChat Pay · Alipay (where available)' },
  zh: { full: '支付全部余额', partial: '支付部分金额', amount: '支付金额', continue: '继续付款', pay: '支付', cancel: '取消付款 / 修改金额', back: '返回', loading: '正在核对付款…', pending: '正在等待支付确认。你可以稍后返回查看。', retry: '核对支付状态', invalid: '请输入大于零的金额，最多两位小数。', success: '付款已入账', secure: '由 Stripe 安全处理付款', resume: '继续付款', methods: '信用卡 · 微信支付 · 支付宝（视账户可用性）' },
  ko: { full: '잔액 전액 결제', partial: '일부 금액 결제', amount: '결제 금액', continue: '결제 계속', pay: '결제', cancel: '결제 취소 / 금액 변경', back: '뒤로', loading: '결제 확인 중…', pending: '결제 확인을 기다리고 있습니다. 나중에 돌아와 확인할 수 있습니다.', retry: '결제 상태 확인', invalid: '소수점 두 자리 이하의 양수를 입력하세요.', success: '결제가 반영되었습니다', secure: 'Stripe 보안 결제', resume: '결제 계속', methods: '카드 · WeChat Pay · Alipay (사용 가능한 경우)' },
};

function PaymentFields({ attempt, check, report, text }: {
  attempt: Attempt; check: () => Promise<void>; report: (message: string) => void; text: typeof messages.en;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set('merchi_payment_attempt', attempt.id);
      const result = await stripe.confirmPayment({ elements,
        confirmParams: { return_url: returnUrl.toString() }, redirect: 'if_required' });
      if (result.error) report(result.error.message || 'Payment could not be confirmed.');
      await check();
    } catch (error: any) {
      report(error.message || 'Payment could not be confirmed.');
    } finally { setBusy(false); }
  };
  return <form onSubmit={submit}>
    <PaymentElement options={{ layout: 'tabs', paymentMethodOrder: ['card', 'wechat_pay', 'alipay'], defaultValues: {} }}
      onReady={() => setReady(true)} onLoadError={(event) => report(event.error.message)} />
    <button type="submit" disabled={!stripe || !ready || busy} style={buttonStyle}>
      {busy ? text.loading : text.pay}
    </button>
  </form>;
}

const buttonStyle: React.CSSProperties = { padding: '10px 16px', marginTop: 12, border: '1px solid currentColor', borderRadius: 6, cursor: 'pointer' };

/** Only the backend's recorded payment state invokes onSuccess. */
export function StripePaymentForm({ apiUrl, resource, resourceId, resourceToken, sessionToken,
  allowPartial = false, onSuccess, onError, onBack, dark = false, locale = 'en' }: StripePaymentFormProps) {
  const text = messages[locale];
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [restoring, setRestoring] = useState(true);
  const [paymentOptions, setPaymentOptions] = useState<{ minorUnitFactor: number; currency: string; amountMinor: number } | null>(null);
  const requestKey = useRef<string | null>(null);
  const completed = useRef(false);
  const callback = useRef({ onSuccess, onError });
  callback.current = { onSuccess, onError };
  const fieldId = useId();
  const base = `${apiUrl.replace(/\/$/, '')}/payments/stripe/${resource}/${resourceId}/attempts/`;
  const storageKey = `merchi-payment:${base}`;
  const request = useCallback(async (suffix: string, method = 'GET', body?: object) => {
    const url = new URL(suffix === 'options' ? base.replace(/attempts\/$/, 'options/') : base + suffix);
    if (resourceToken) url.searchParams.set(`${resource}_token`, resourceToken);
    if (sessionToken) url.searchParams.set('session_token', sessionToken);
    const response = await fetch(url.toString(), { method, mode: 'cors', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || 'Unable to process payment.'), { status: response.status });
    return data;
  }, [base, resourceToken, sessionToken, resource]);
  const remember = useCallback((id?: string) => {
    try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
  }, [storageKey]);
  const accept = useCallback((value: Attempt) => {
    setAttempt(value);
    remember(value.id);
    if (value.recorded && value.invoice && !completed.current) {
      completed.current = true;
      remember();
      const url = new URL(window.location.href);
      ['merchi_payment_attempt', 'payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach(key => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, '', url.toString());
      callback.current.onSuccess(value.invoice);
    }
  }, [remember]);
  const report = useCallback((message: string) => {
    setError(message);
    callback.current.onError?.(message);
  }, []);
  useEffect(() => {
    let active = true;
    completed.current = false;
    requestKey.current = null;
    setAttempt(null);
    setRestoring(true);
    const url = new URL(window.location.href);
    let id = url.searchParams.get('merchi_payment_attempt');
    try { id = id || sessionStorage.getItem(storageKey); } catch { /* Optional storage. */ }
    // Strip Stripe's client secret from the visible URL as soon as it returns.
    ['payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach(key => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', url.toString());
    if (id) request(`${encodeURIComponent(id)}/`).then(value => { if (active) accept(value); })
      .catch(error => { if (active) report(error.message); })
      .finally(() => { if (active) setRestoring(false); });
    else setRestoring(false);
    return () => { active = false; };
  }, [request, storageKey, accept, report]);
  useEffect(() => {
    let active = true;
    if (resource === 'invoice') request('options').then(value => { if (active) setPaymentOptions(value); })
      .catch(error => { if (active) report(error.message); });
    return () => { active = false; };
  }, [request, resource, report]);
  const check = useCallback(async () => {
    if (!attempt) return;
    try { accept(await request(`${attempt.id}/`)); } catch (error: any) { report(error.message); }
  }, [attempt, request, accept, report]);
  useEffect(() => {
    if (!attempt || attempt.recorded || ['canceled', 'failed'].includes(attempt.status)) return;
    // Poll slowly even while a QR code is visible. Webhooks also reconcile after the page closes.
    const timer = window.setTimeout(() => { void check(); }, 5000);
    return () => window.clearTimeout(timer);
  }, [attempt, check]);
  const start = async () => {
    if (busy) return;
    setError('');
    const rawMinor = Number(amount) * (paymentOptions?.minorUnitFactor || 100);
    const minor = partial ? Math.round(rawMinor) : undefined;
    if (partial && (!/^\d+(\.\d{1,2})?$/.test(amount) || !minor || !Number.isSafeInteger(minor) || Math.abs(rawMinor - minor) > 1e-7)) { report(text.invalid); return; }
    setBusy(true);
    try {
      // Reuse across network errors; the server also coalesces active attempts.
      requestKey.current = requestKey.current || `checkout:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      accept(await request('', 'POST', { requestKey: requestKey.current, ...(partial ? { amountMinor: minor } : {}) }));
    } catch (error: any) { if (error.status === 400) requestKey.current = null; report(error.message); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      const result = await request(`${attempt.id}/`, 'DELETE');
      if (result.recorded) accept(result);
      else if (result.status === 'canceled') { setAttempt(null); requestKey.current = null; remember(); setError(''); }
      else report(text.pending);
    } catch (error: any) { report(error.message); }
    finally { setBusy(false); }
  };
  const stripe = useMemo(() => attempt?.publishableKey ? loadStripe(attempt.publishableKey) : null, [attempt?.publishableKey]);
  const options: StripeElementsOptions = useMemo(() => ({ clientSecret: attempt?.stripeClientSecret,
    appearance: { theme: dark ? 'night' : 'stripe' }, locale: locale === 'zh' ? 'zh' : locale }), [attempt?.stripeClientSecret, dark, locale]);
  const terminal = attempt && ['canceled', 'failed'].includes(attempt.status);
  return <section aria-label={text.secure} style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
    <p>{text.secure}</p>
    {paymentOptions && !attempt && <p>{new Intl.NumberFormat(locale, { style: 'currency', currency: paymentOptions.currency }).format(paymentOptions.amountMinor / paymentOptions.minorUnitFactor)}</p>}
    {error && <p role="alert" style={{ color: '#c53030' }}>{error}</p>}
    {restoring ? <p role="status">{text.loading}</p> : attempt?.recorded ? <p role="status">{text.success}</p> : !attempt || terminal ? <>
      {allowPartial && paymentOptions && <fieldset disabled={busy}>
        <label style={{ display: 'block' }}><input type="radio" name={fieldId} checked={!partial} onChange={() => setPartial(false)} /> {text.full}</label>
        <label style={{ display: 'block' }}><input type="radio" name={fieldId} checked={partial} onChange={() => setPartial(true)} /> {text.partial}</label>
        {partial && <div><label htmlFor={fieldId}>{text.amount}</label><input id={fieldId} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!!error} style={{ display: 'block', border: '1px solid', padding: 8 }} /></div>}
      </fieldset>}
      <button type="button" onClick={() => void start()} disabled={busy} style={buttonStyle}>{busy ? text.loading : text.continue}</button>
    </> : <>
      <p>{new Intl.NumberFormat(locale, { style: 'currency', currency: attempt.currency }).format(Number(attempt.amountMajor))}</p>
      {attempt.stripeClientSecret && stripe && !['processing', 'requires_capture'].includes(attempt.status) && <Elements key={attempt.id} stripe={stripe} options={options}>
        <PaymentFields attempt={attempt} check={check} report={report} text={text} />
      </Elements>}
      {attempt.status === 'processing' && <p role="status">{text.pending}</p>}
      <div><button type="button" onClick={() => void check()} disabled={busy} style={buttonStyle}>{text.retry}</button></div>
      <button type="button" onClick={() => void cancel()} disabled={busy} style={buttonStyle}>{text.cancel}</button>
    </>}
    {onBack && <div><button type="button" onClick={onBack} disabled={busy} style={buttonStyle}>{text.back}</button></div>}
  </section>;
}
