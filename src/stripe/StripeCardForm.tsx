import * as React from 'react';
import { StripePaymentForm } from './StripePaymentForm';
import { StripePaymentGate } from './StripePaymentGate';
import LegacyStripeCardForm from './LegacyStripeCardForm';

export default function StripeCardForm(props: any) {
  const { invoice, urlApi, alertErrorShow, callbackStripePaymentSuccess } = props;
  return <StripePaymentGate apiUrl={urlApi} resource="invoice" resourceId={invoice.id}
    resourceToken={invoice.invoiceToken} legacy={<LegacyStripeCardForm {...props} />}>
    <StripePaymentForm apiUrl={urlApi} resource="invoice" resourceId={invoice.id}
    resourceToken={invoice.invoiceToken} onError={alertErrorShow}
    onSuccess={updated => callbackStripePaymentSuccess({ invoice: updated })} />
  </StripePaymentGate>;
}
