import type { ProductInfo } from "../types";
import styles from "./ProductHero.module.css";

interface Props {
  product: ProductInfo;
}

export default function ProductHero({ product }: Props) {
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 50;

  return (
    <div className={styles.hero}>
      <div className={styles.thumb} aria-hidden="true">
        {/* simple lock glyph — swap for a product image when you have one */}
        <svg viewBox="0 0 32 32" width="34" height="34">
          <path
            d="M9 14V10a7 7 0 0 1 14 0v4M7 14h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V15a1 1 0 0 1 1-1Zm9 5v4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className={styles.info}>
        <h2 className={styles.name}>{product.name}</h2>
        <div className={styles.metaRow}>
          <span className={styles.asin}>ASIN {product.asin}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.rating}>
            ★ {product.rating.toFixed(1)}{" "}
            <span className={styles.muted}>({product.reviews.toLocaleString()} reviews)</span>
          </span>
        </div>
      </div>

      <dl className={styles.stats}>
        <div>
          <dt>List price</dt>
          <dd>${product.price.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Lifetime units</dt>
          <dd>{product.unitsLifetime.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Inventory</dt>
          <dd
            className={
              outOfStock ? styles.bad : lowStock ? styles.warn : undefined
            }
          >
            {outOfStock
              ? "Out of stock"
              : `${product.stock.toLocaleString()} units${lowStock ? " · low" : ""}`}
          </dd>
        </div>
      </dl>
    </div>
  );
}
