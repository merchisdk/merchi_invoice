'use client';
import svgSslSecured from '../images/ssl-secured.svg';
import { assetSrc } from '../assetSrc';

export default function IconPaymentSSL() {
  return (
    <div style={{
      display: 'block',
      margin: '1em auto 0',
      textAlign: 'center',
    }}>
      <img
        style={{
          margin: '5px',
          maxHeight: 40,
          maxWidth: 67,
          padding: 4,
        }}
        src={assetSrc(svgSslSecured)}
      />
    </div>
  );
}
