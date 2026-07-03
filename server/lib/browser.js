import puppeteer from 'puppeteer-core';

// Navegador Chromium compartido (singleton) para generar PDFs (reportes IA,
// certificados, etc.). Reusa la misma instancia entre peticiones.
let browserPromise = null;

export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      .catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}
