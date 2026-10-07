import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/client";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import { ProductForm, useProducts, type ProductPayload } from "./productForm";
import styles from "./Products.module.css";

// Full-page version of the add form (the Products list only keeps the edit
// popup). After a successful save it returns to Products, which shows a short
// "Added …" note; Cancel / Back also return to the list.
export default function AddProduct() {
  const navigate = useNavigate();
  const { products, loadError } = useProducts();

  async function add(payload: ProductPayload) {
    // Writes go through the backend — RTDB rules block client writes to products/.
    await api.post("/dashboard/products", payload);
    navigate("/products", { state: { added: payload.sku } });
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Add product" />
        <main className={styles.content}>
          <Link to="/products" className={styles.backLink}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to products
          </Link>

          <section className={`${styles.card} ${styles.pageForm}`}>
            <div className={styles.pageHead}>
              <h3>New product</h3>
              <p>Fill in the details below. S/N is filled in automatically if you leave it blank.</p>
            </div>
            {loadError && <p className={styles.error}>{loadError}</p>}
            <ProductForm
              products={products}
              submitLabel="Add product"
              onSubmit={add}
              onCancel={() => navigate("/products")}
              showHints
            />
          </section>
        </main>
      </div>
    </div>
  );
}
