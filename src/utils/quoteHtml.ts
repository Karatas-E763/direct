import type { Product, QuoteConfig } from "@/types";

export interface QuoteHtmlLineItem {
  product: Product;
  quantity: number;
}

export interface QuoteHtmlOptions {
  config?: Partial<QuoteConfig>;
  vehicleTitle?: string;
  filename?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function buildReference(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const seq = String(Math.floor(1000 + Math.random() * 9000));
  return `DR-${y}${m}${d}-${seq}`;
}

function renderTableRows(items: QuoteHtmlLineItem[]) {
  if (items.length === 0) {
    return `<tr class="empty-row"><td colspan="4">No hay productos en la cotización.</td></tr>`;
  }

  return items
    .map((item, index) => {
      const importe = item.product.price * item.quantity;
      const zebra = index % 2 === 1 ? "alt" : "";
      return `<tr class="${zebra}">
        <td class="product">${escapeHtml(item.product.name)}</td>
        <td class="qty">${item.quantity}</td>
        <td class="money">${formatPrice(item.product.price)}</td>
        <td class="money">${formatPrice(importe)}</td>
      </tr>`;
    })
    .join("");
}

export function buildQuoteHtmlDocument(
  items: QuoteHtmlLineItem[],
  options?: QuoteHtmlOptions
) {
  const now = new Date();
  const config = options?.config ?? {};
  const ivaRate = config.ivaRate ?? 0.16;
  const companyName = config.companyName ?? "Directrack";
  const companyTagline =
    config.companyTagline ?? "Control vehicular y gestión de flotas";
  const providerName = config.providerName ?? companyName;
  const providerAddress = config.providerAddress ?? "";
  const providerPhone = config.providerPhone ?? "";
  const providerEmail = config.providerEmail ?? "";
  const providerRfc = config.providerRfc ?? "";
  const paymentTerms =
    config.paymentTerms ??
    "50% anticipo al confirmar pedido, 50% contra entrega e instalación. Transferencia bancaria o depósito. Vigencia de cotización: 15 días naturales.";
  const quoteFooter =
    config.quoteFooter ??
    "Precios sujetos a cambio sin previo aviso. Instalación y capacitación incluidas según paquete contratado.";
  const vehicleTitle = options?.vehicleTitle?.trim() || "—";
  const reference = buildReference(now);

  const validItems = items.filter((item) => item.quantity > 0 && item.product);
  const subtotal = validItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const iva = subtotal * ivaRate;
  const total = subtotal + iva;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotización ${escapeHtml(companyName)}</title>
  <style>
    :root {
      --blue: #2185d5;
      --navy: #1b365d;
      --ink: #1f2937;
      --muted: #4b5563;
      --line: #dbe3ee;
      --soft: #e7f3ff;
      --zebra: #f3f7fb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #edf2f7;
      color: var(--ink);
      font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.45;
    }
    .page {
      max-width: 900px;
      margin: 24px auto;
      background: #fff;
      box-shadow: 0 12px 40px rgba(27, 54, 93, 0.12);
      overflow: hidden;
    }
    .header {
      background: var(--blue);
      color: #fff;
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 28px 36px;
    }
    .brand {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: 0.01em;
      margin: 0;
    }
    .tagline {
      margin: 6px 0 0;
      font-size: 0.95rem;
      font-weight: 400;
      opacity: 0.95;
    }
    .doc-title {
      text-align: right;
    }
    .doc-title h2 {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: 0.08em;
    }
    .doc-title p {
      margin: 8px 0 0;
      font-size: 0.92rem;
      opacity: 0.95;
    }
    .content {
      padding: 28px 36px 36px;
    }
    .meta {
      background: var(--soft);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 28px;
    }
    .meta p {
      margin: 0 0 4px;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .meta .right {
      text-align: right;
    }
    h3 {
      margin: 0 0 10px;
      font-size: 1.05rem;
      color: #111827;
    }
    .provider {
      margin-bottom: 28px;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .provider p {
      margin: 0 0 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      overflow: hidden;
      border-radius: 8px;
    }
    thead th {
      background: var(--navy);
      color: #fff;
      font-size: 0.92rem;
      font-weight: 700;
      padding: 12px 14px;
      text-align: left;
    }
    thead th.qty,
    thead th.money,
    td.qty,
    td.money {
      text-align: right;
      white-space: nowrap;
    }
    thead th.qty,
    td.qty {
      text-align: center;
      width: 70px;
    }
    tbody td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      font-size: 0.95rem;
    }
    tbody tr.alt td {
      background: var(--zebra);
    }
    tbody tr.empty-row td {
      text-align: center;
      color: var(--muted);
      padding: 28px 14px;
      background: #fafbfc;
    }
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 28px;
    }
    .totals {
      min-width: 260px;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 18px;
      background: #fff;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 28px;
      margin: 6px 0;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .totals-row.total {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      color: #111827;
      font-size: 1.1rem;
      font-weight: 800;
    }
    .totals-row.total span:last-child {
      color: var(--blue);
    }
    .section {
      margin-bottom: 22px;
    }
    .section p {
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .footer {
      margin-top: 8px;
      padding-top: 18px;
      border-top: 2px solid var(--blue);
    }
    .footer .name {
      margin: 0;
      font-weight: 800;
      color: #111827;
    }
    .footer .role {
      margin: 2px 0 10px;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .footer .contacts {
      margin: 0;
      color: var(--muted);
      font-size: 0.88rem;
    }
    @media (max-width: 720px) {
      .header, .meta {
        flex-direction: column;
      }
      .doc-title, .meta .right {
        text-align: left;
      }
      .content, .header {
        padding-left: 20px;
        padding-right: 20px;
      }
    }
    @media print {
      body { background: #fff; }
      .page { margin: 0; box-shadow: none; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <p class="brand">${escapeHtml(companyName)}</p>
        <p class="tagline">${escapeHtml(companyTagline)}</p>
      </div>
      <div class="doc-title">
        <h2>COTIZACIÓN</h2>
        <p>Ref: ${escapeHtml(reference)}</p>
      </div>
    </div>

    <div class="content">
      <div class="meta">
        <div>
          <p>Fecha: ${escapeHtml(formatLongDate(now))}</p>
        </div>
        <div class="right">
          <p>Unidad: ${escapeHtml(vehicleTitle.toUpperCase())}</p>
          <p>Vigencia: 15 días naturales</p>
          <p>Moneda: MXN</p>
        </div>
      </div>

      <section class="provider">
        <h3>Datos del proveedor</h3>
        <p>${escapeHtml(providerName)}</p>
        ${providerAddress ? `<p>${escapeHtml(providerAddress)}</p>` : ""}
        ${providerPhone ? `<p>Tel: ${escapeHtml(providerPhone)}</p>` : ""}
        ${providerEmail ? `<p>Email: ${escapeHtml(providerEmail)}</p>` : ""}
        ${providerRfc ? `<p>RFC: ${escapeHtml(providerRfc)}</p>` : ""}
        ${
          providerEmail
            ? `<p>Web: ${escapeHtml(
                providerEmail.includes("@")
                  ? `www.${providerEmail.split("@")[1] ?? "directtrack.mx"}`
                  : "www.directtrack.mx"
              )}</p>`
            : `<p>Web: www.directtrack.mx</p>`
        }
      </section>

      <table>
        <thead>
          <tr>
            <th>Producto / servicio</th>
            <th class="qty">Cant.</th>
            <th class="money">Precio unit.</th>
            <th class="money">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${renderTableRows(validItems)}
        </tbody>
      </table>

      <div class="totals-wrap">
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
          <div class="totals-row"><span>IVA (${Math.round(ivaRate * 100)}%)</span><span>${formatPrice(iva)}</span></div>
          <div class="totals-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
        </div>
      </div>

      <section class="section">
        <h3>Condiciones comerciales</h3>
        <p>${escapeHtml(paymentTerms)}</p>
      </section>

      <section class="section">
        <h3>Notas</h3>
        <p>${escapeHtml(quoteFooter)}</p>
      </section>

      <footer class="footer">
        <p class="name">Lic. Alejandro Flores Arias</p>
        <p class="role">Gerente de Ventas</p>
        <p class="contacts">
          ${escapeHtml(providerPhone || "+52 (55) 1234-5678")}
          &nbsp;|&nbsp;
          ${escapeHtml(providerEmail || "ventas@directtrack.mx")}
          &nbsp;|&nbsp;
          www.directtrack.mx
        </p>
      </footer>
    </div>
  </div>
</body>
</html>`;
}

export function downloadQuoteHtml(
  items: QuoteHtmlLineItem[],
  options?: QuoteHtmlOptions
) {
  const html = buildQuoteHtmlDocument(items, options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    options?.filename ?? `cotizacion-directtrack-${Date.now()}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
