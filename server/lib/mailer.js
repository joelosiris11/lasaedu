import nodemailer from 'nodemailer';

// Envío de correo (reset de clave / verificación). Si no hay SMTP configurado,
// smtpConfigured=false y sendMail no envía (modo dev: el endpoint devuelve el
// token para poder probar el flujo sin correo real).
export const smtpConfigured = !!process.env.SMTP_HOST;

const transport = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail({ to, subject, html }) {
  if (!transport) return false;
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'LasaEdu <no-reply@lasaacademy.cloudteco.com>',
    to,
    subject,
    html,
  });
  return true;
}
