import type { Product } from "@/types";

export interface QuoteHtmlLineItem {
  product: Product;
  quantity: number;
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

function resolveImageUrl(src: string) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  if (typeof window === "undefined") return src;
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

function renderFeatures(product: Product) {
  const benefits = product.benefits?.filter(Boolean) ?? [];
  const specs = product.technicalSpecs?.map((s) => s.label).filter(Boolean) ?? [];
  const advantages = product.advantages?.filter(Boolean) ?? [];
  const features = [...benefits, ...specs, ...advantages];

  if (features.length === 0) {
    return `<p class="muted">Sin características registradas.</p>`;
  }

  return `<ul class="features">${features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("")}</ul>`;
}

function renderItem(item: QuoteHtmlLineItem) {
  const { product, quantity } = item;
  const unitPrice = product.price;
  const lineTotal = unitPrice * quantity;
  const imageUrl = resolveImageUrl(product.image);

  return `
    <article class="item">
      <div class="item-header">
        ${
          imageUrl
            ? `<img class="item-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" />`
            : `<div class="item-image placeholder"></div>`
        }
        <div class="item-meta">
          <h2>${escapeHtml(product.name)}</h2>
          <p class="description">${escapeHtml(product.description || "")}</p>
          <div class="price-row">
            <span>Cantidad: <strong>${quantity}</strong></span>
            <span>Precio unitario: <strong>${formatPrice(unitPrice)}</strong></span>
            <span>Total: <strong>${formatPrice(lineTotal)}</strong></span>
          </div>
        </div>
      </div>
      <div class="item-body">
        <h3>Características</h3>
        ${renderFeatures(product)}
      </div>
    </article>
  `;
}

export function buildQuoteHtmlDocument(
  items: QuoteHtmlLineItem[],
  options?: { title?: string; ivaRate?: number }
) {
  const title = options?.title ?? "Cotización DirectTrack";
  const ivaRate = options?.ivaRate ?? 0.16;
  const validItems = items.filter((item) => item.quantity > 0 && item.product);

  const subtotal = validItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const iva = subtotal * ivaRate;
  const total = subtotal + iva;

  const itemsHtml =
    validItems.length === 0
      ? `<p class="empty">No hay productos en la cotización.</p>`
      : validItems.map(renderItem).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --brand: #1e88e5;
      --ink: #1a3a5c;
      --muted: #64748b;
      --line: #e2e8f0;
      --bg: #f8fafc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background: linear-gradient(180deg, #eff6ff 0%, var(--bg) 40%, #fff 100%);
      line-height: 1.5;
    }
    .wrap {
      max-width: 880px;
      margin: 0 auto;
      padding: 40px 24px 64px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      border-bottom: 2px solid var(--brand);
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    header h1 {
      margin: 0;
      font-size: 1.75rem;
      letter-spacing: 0.02em;
    }
    header p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .badge {
      background: var(--brand);
      color: #fff;
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
    }
    .item {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px;
      margin-bottom: 18px;
      box-shadow: 0 10px 30px rgba(26, 58, 92, 0.06);
    }
    .item-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .item-image {
      width: 96px;
      height: 96px;
      object-fit: contain;
      border-radius: 14px;
      background: #f1f5f9;
      border: 1px solid var(--line);
      flex-shrink: 0;
    }
    .item-image.placeholder {
      background: repeating-linear-gradient(
        -45deg,
        #f1f5f9,
        #f1f5f9 8px,
        #e2e8f0 8px,
        #e2e8f0 16px
      );
    }
    .item-meta h2 {
      margin: 0 0 6px;
      font-size: 1.2rem;
    }
    .description {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .price-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      font-size: 0.92rem;
    }
    .item-body {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
    }
    .item-body h3 {
      margin: 0 0 8px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--brand);
    }
    .features {
      margin: 0;
      padding-left: 18px;
    }
    .features li {
      margin: 4px 0;
      color: #334155;
    }
    .muted, .empty {
      color: var(--muted);
    }
    .empty {
      text-align: center;
      padding: 48px 16px;
      background: #fff;
      border: 1px dashed var(--line);
      border-radius: 18px;
    }
    .totals {
      margin-top: 28px;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: 0 10px 30px rgba(26, 58, 92, 0.06);
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      color: var(--muted);
    }
    .totals-row.total {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      color: var(--ink);
      font-size: 1.2rem;
      font-weight: 700;
    }
    .totals-row.total span:last-child {
      color: var(--brand);
    }
    footer {
      margin-top: 24px;
      text-align: center;
      color: var(--muted);
      font-size: 0.85rem;
    }
    @media (max-width: 640px) {
      .item-header { flex-direction: column; }
      header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>Generada el ${escapeHtml(new Date().toLocaleString("es-MX"))}</p>
      </div>
      <div class="badge">${validItems.length} equipo${validItems.length === 1 ? "" : "s"}</div>
    </header>

    <main>
      ${itemsHtml}
    </main>

    <section class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
      <div class="totals-row"><span>IVA (${Math.round(ivaRate * 100)}%)</span><span>${formatPrice(iva)}</span></div>
      <div class="totals-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
    </section>

    <footer>DirectTrack — Cotización generada desde el visualizador 3D</footer>
  </div>
</body>
</html>`;
}

export function downloadQuoteHtml(
  items: QuoteHtmlLineItem[],
  options?: { title?: string; ivaRate?: number; filename?: string }
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
