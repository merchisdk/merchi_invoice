'use client';
import pngStripe from '../images/tile-stripe.png';
import { assetSrc } from '../assetSrc';

export default function IconsPayments() {
  return (
    <img
      src={assetSrc(pngStripe)}
      title='pay with credit card'
      alt='checkout with Stripe'
      style={{ width: '100%' }}
    />
  );
}
