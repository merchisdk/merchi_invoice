'use client';
import { useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { FaFileInvoiceDollar } from 'react-icons/fa';

const urlToFile = async (url: string, filename: string, type: string) => {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new File([buf], filename, { type });
};

const urlToFilePdf = async (url: string, filename: string) => {
  const file = await urlToFile(url, filename, 'application/pdf');
  return file;
};

export async function generatePublicInvoicePdf(urlApi: string, invoice: any, receipt?: boolean) {
  const id = invoice.id;
  const domain = invoice.domain.emailDomain;

  const queryString = new URLSearchParams({
    invoice_token: invoice.invoiceToken
  }).toString();

  const fetchOptions: any = {
    method: 'GET',
    mode: 'cors'
  };
  const uri = receipt ? 'generate/receipt/pdf/' : 'generate/pdf/';
  try {
    const response = await fetch(`${urlApi}invoices/${id}/${uri}`, fetchOptions);

    if (!response.ok) {
      throw new Error("Error fetching PDF.");
    }

    const r = await response.json();
    const pdf = await urlToFilePdf(
      `data:application/pdf;base64,${r.pdf}`,
      `${domain}-invoice-${id}.pdf`
    );

    const url = URL.createObjectURL(pdf);
    const doc = (document as any);
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = pdf.name;

    // Append to the DOM
    doc.body.appendChild(anchor);

    // Trigger `click` event
    anchor.click();

    // Remove element from DOM
    doc.body.removeChild(anchor);

    return { success: true };
  } catch (e: any) {
    throw e;
  }
}

interface Props {
  alertErrorShow: (message: string) => void;
  classNameMerchiInvoiceButtonDownloadInvoice?: string;
  invoice: any;
  urlApi: string;
}

function ButtonInvoiceDownload({
  alertErrorShow,
  classNameMerchiInvoiceButtonDownloadInvoice,
  invoice,
  urlApi,
}: Props) {
  const { unpaid } = invoice;
  const [loading, setLoading] = useState(false);
  // const icon = loading ? faCircleNotch : faFileInvoiceDollar;
  async function generateInvoice(receipt?: boolean) {
    setLoading(true);
    try {
      await generatePublicInvoicePdf(urlApi, invoice, receipt);
      setLoading(false);
    } catch (e: any) {
      alertErrorShow(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      {unpaid ? (
        <button
          className={
            classNameMerchiInvoiceButtonDownloadInvoice + ' btn btn-lg'
          }
          disabled={loading}
          onClick={() => generateInvoice(false)}
        >
          {loading ? (
            <CgSpinner fontSize='1.1rem' className='animate_spin mr-2' />
          ) : (
            <FaFileInvoiceDollar fontSize='1.1rem' className='mr-2' />
          )}
          Download Invoice
        </button>
      ) : (
        <button
          className={
            classNameMerchiInvoiceButtonDownloadInvoice + ' btn btn-lg'
          }
          disabled={loading}
          onClick={() => generateInvoice(true)}
        >
          {loading ? (
            <CgSpinner fontSize='1.1rem' className='animate_spin mr-2' />
          ) : (
            <FaFileInvoiceDollar fontSize='1.1rem' className='mr-2' />
          )}
          Download Receipt
        </button>
      )}
    </>
  );
}

export default ButtonInvoiceDownload;
