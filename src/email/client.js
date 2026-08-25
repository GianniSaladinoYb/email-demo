import { Resend } from 'resend';

const { RESEND_API_KEY, MAIL_FROM, MAIL_TO } = process.env;

// MAIL_TO è il destinatario "test mode": Resend con onboarding@resend.dev può
// inviare SOLO all'email dell'account registrato. Per la demo redirigiamo tutto lì.
// In produzione, dopo aver verificato il dominio, useremmo customer.email per davvero.

export const resend = new Resend(RESEND_API_KEY);

export async function sendEmail({ subject, html, toOverride }) {
  const to = toOverride || MAIL_TO;
  if (!to) {
    console.warn('⚠️  MAIL_TO non configurato — email non inviata');
    return { ok: false };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      console.error(`❌ Resend (${subject}):`, error.message || error);
      return { ok: false, error };
    }
    console.log(`📧 Email inviata: "${subject}" → ${to} (id ${data.id})`);
    return { ok: true, id: data.id };
  } catch (err) {
    console.error(`❌ Resend (${subject}) exception:`, err.message);
    return { ok: false, error: err };
  }
}
