import paypal from '@paypal/checkout-server-sdk';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV = 'sandbox' } = process.env;

if (!PAYPAL_CLIENT_ID || PAYPAL_CLIENT_ID.startsWith('xxxx')) {
  console.warn('⚠️  PAYPAL_CLIENT_ID non configurato. Gli endpoint /api/paypal/* falliranno.');
}

const Environment =
  PAYPAL_ENV === 'live' ? paypal.core.LiveEnvironment : paypal.core.SandboxEnvironment;

const environment = new Environment(
  PAYPAL_CLIENT_ID || 'placeholder',
  PAYPAL_CLIENT_SECRET || 'placeholder',
);

export const paypalClient = new paypal.core.PayPalHttpClient(environment);
export { paypal };

// PayPal vuole stringhe decimali "10.00", Stripe vuole int cents 1000.
export function centsToDecimalString(cents) {
  return (cents / 100).toFixed(2);
}
