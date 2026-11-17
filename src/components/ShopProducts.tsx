"use client";

import Image from "next/image";
import { useState } from "react";
import type { ShopProduct } from "@/lib/shop-catalog";

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function ProductCard({ product }: { product: ShopProduct }) {
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const single = product.variants.length === 1;

  async function buy() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, variantId: variant.id, quantity }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout could not start.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not start.");
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col border border-white/15 bg-white/[0.02]">
      {product.image ? (
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          <Image
            src={product.image}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h2 className="text-lg leading-snug text-[var(--pnc-fg)]">{product.title}</h2>
        <p className="text-[15px] text-[var(--pnc-fg)]">
          {formatPrice(variant.price)}
        </p>
        {product.blurb ? <p className="text-[14px] leading-relaxed text-[var(--pnc-muted)]">{product.blurb}</p> : null}
        <div className="mt-auto flex flex-wrap items-end gap-3 pt-2">
          {!single ? (
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] uppercase tracking-[0.2em] text-[var(--pnc-muted)]">
              Option
              <select
                value={variantId}
                onChange={(e) => setVariantId(Number(e.target.value))}
                className="w-full border border-white/25 bg-black px-3 py-2 text-[14px] normal-case tracking-normal text-[var(--pnc-fg)]"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.2em] text-[var(--pnc-muted)]">
            Qty
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="border border-white/25 bg-black px-3 py-2 text-[14px] text-[var(--pnc-fg)]"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={buy}
            disabled={busy}
            className="border border-white/25 px-6 py-[9px] text-[11px] uppercase tracking-[0.28em] transition-colors hover:border-white hover:bg-white hover:text-black disabled:opacity-50"
          >
            {busy ? "One sec…" : "Buy"}
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-[13px] text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function ShopProducts({ products }: { products: ShopProduct[] }) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
