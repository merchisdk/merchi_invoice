'use client';
import { useState } from 'react';
import Container from './Container';
import { ButtonPayInvoice } from './buttons';
import InvoiceInfo from './InvoiceInfo';
import TabTile from './TabTile';
import { IconsPayments } from './icons';
import SquareCard from './square/SquareCard';
import StripeCardForm from './stripe/StripeCardForm';

const payWithStripe = 'stripe-tab';
const payWithUtrust = 'utrust-tab';

export function defaultActivePaymentTab(invoice: any) {
  const { acceptStripe, acceptUtrust, unpaid } = invoice;
  const paid = !unpaid;
  const showStripe = !paid && acceptStripe;
  const showUtrust = !paid && acceptUtrust;
  return showStripe ? payWithStripe : showUtrust ? payWithUtrust : '';
}

interface Props {
  alertErrorShow?: (message: string) => void;
  classNameMerchiInvoiceButtonDownloadInvoice?: string;
  classNameMerchiInvoiceButtonPayInvoice?: string;
  callbackCreditCardPaymentSuccess?: (invoiceJson: any) => void;
  invoice: any;
  urlApi?: string;
}

function MerchiInvoice({
  alertErrorShow = console.error,
  classNameMerchiInvoiceButtonDownloadInvoice = 'btn btn-lg btn-primary',
  classNameMerchiInvoiceButtonPayInvoice = 'btn btn-lg btn-primary btn-block',
  callbackCreditCardPaymentSuccess = console.log,
  invoice = {},
  urlApi = 'https://api.merchi.co/v6/',
}: Props) {
  const [activeTab, setActiveTab] = useState(
    defaultActivePaymentTab(invoice) || payWithStripe
  );
  const { acceptSquare, acceptStripe, unpaid } = invoice;
  const paid = !unpaid;
  const PaymentButton = ({ loading }: any) => (
    <ButtonPayInvoice
      className={classNameMerchiInvoiceButtonPayInvoice}
      invoice={invoice}
      loading={loading}
    />
  );
  return (
    <div className='container-fluid'>
      <InvoiceInfo
        classNameMerchiInvoiceButtonDownloadInvoice={
          classNameMerchiInvoiceButtonDownloadInvoice
        }
        invoice={invoice}
        alertErrorShow={alertErrorShow}
        urlApi={urlApi}
      />
      {!paid && (
        <>
          <div className='m-auto pt-2' style={{ maxWidth: 400 }}>
            {!!acceptSquare && (
              <Container description='Secure credit card payments powered by Square.'>
                <SquareCard
                  alertErrorShow={alertErrorShow}
                  invoice={invoice}
                  callbackPaymentSuccess={callbackCreditCardPaymentSuccess}
                  urlApi={urlApi}
                />
              </Container>
            )}
            {acceptStripe && (
              <TabTile
                activeStyle={activeTab === payWithStripe}
                defaultValue={activeTab}
                name={payWithStripe}
                setTab={() => setActiveTab(payWithStripe)}
              >
                <div className='merchi_invoice-container-icons'>
                  <IconsPayments />
                </div>
              </TabTile>
            )}
          </div>
          {!!(acceptStripe && payWithStripe === activeTab) && (
            <div className='w-100'>
              <Container description='Secure credit card payments powered by Stripe.'>
                <StripeCardForm
                  alertErrorShow={alertErrorShow}
                  invoice={invoice}
                  callbackStripePaymentSuccess={
                    callbackCreditCardPaymentSuccess
                  }
                  PaymentButton={PaymentButton}
                />
              </Container>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MerchiInvoice;
