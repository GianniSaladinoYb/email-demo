import Stripe from 'stripe';

const { STRIPE_SECRET_KEY } = process.env;

if (!STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.startsWith('sk_test_xxxx')) {
  console.warn('⚠️  STRIPE_SECRET_KEY non configurata. Gli endpoint /api/stripe/* falliranno.');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-12-18.acacia',
});
