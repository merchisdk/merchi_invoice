'use client';
import pnbUTrust from '../images/tile-utrust.png';
import { assetSrc } from '../assetSrc';

export default function IconPaymentUtrust() {
  return (
    <img
      src={assetSrc(pnbUTrust)}
      title='pay with Utrust'
      alt='checkout with Utrust'
    />
  );
}
