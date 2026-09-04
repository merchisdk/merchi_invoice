import * as React from 'react';
import { StripePaymentForm } from './StripePaymentForm';

export default function StripeCardForm({ invoice, urlApi, alertErrorShow, callbackStripePaymentSuccess }: any) {
  return <StripePaymentForm apiUrl={urlApi} resource="invoice" resourceId={invoice.id}
    resourceToken={invoice.invoiceToken} onError={alertErrorShow}
    onSuccess={updated => callbackStripePaymentSuccess({ invoice: updated })} />;
}
