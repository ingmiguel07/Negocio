"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatCOP, type InventoryProduct } from "@/lib/finance";

type ProductDraft = Omit<InventoryProduct, "id">;
type ProductChange = (product: ProductDraft) => void;

const emptyDraft = (category: string): ProductDraft => ({
  name: "", category, description: "", quantityPurchased: 1, quantityAvailable: 1,
  unitCost: 0, salePrice: 0, purchaseDate: new Date().toISOString().slice(0, 10), supplier: "",
});

function InventoryIcon({ name, size = 18 }: { name: "plus" | "search" | "edit" | "trash" | "close" | "box"; size?: number }) {
  const shapes = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    edit: <><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/><path d="M12 20h8"/></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3"/></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

export default function InventoryModule({
  products,
  protectedProductIds,
  categories,
  availableCapital,
  onAdd,
  onUpdate,
  onDelete,
  onCategoriesChange,
}: {
  products: InventoryProduct[];
  protectedProductIds: string[];
  categories: string[];
  availableCapital: number;
  onAdd: ProductChange;
  onUpdate: (id: string, product: ProductDraft) => void;
  onDelete: (id: string) => void;
  onCategoriesChange: (categories: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas las categorías");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<InventoryProduct | null>(null);
  const [notice, setNotice] = useState("");

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = `${product.name} ${product.category} ${product.supplier}`.toLocaleLowerCase("es-CO").includes(search.toLocaleLowerCase("es-CO"));
    return matchesSearch && (categoryFilter === "Todas las categorías" || product.category === categoryFilter);
  }), [products, search, categoryFilter]);
  const totalUnits = products.reduce((sum, product) => sum + product.quantityAvailable, 0);
  const invested = products.reduce((sum, product) => sum + product.quantityAvailable * product.unitCost, 0);
  const potentialProfit = products.reduce((sum, product) => sum + (product.salePrice - product.unitCost) * product.quantityAvailable, 0);

  function saveProduct(draft: ProductDraft) {
    if (editing) onUpdate(editing.id, draft);
    else onAdd(draft);
    setEditing(null);
    setShowProductForm(false);
  }

  function removeProduct() {
    if (!deleteCandidate) return;
    onDelete(deleteCandidate.id);
    setNotice(`Se eliminó ${deleteCandidate.name} del inventario.`);
    setDeleteCandidate(null);
    window.setTimeout(() => setNotice(""), 3000);
  }

  return <>
    <div className="section-welcome inventory-welcome">
      <div><div className="eyebrow"><span className="live-dot" /> CONTROL DE EXISTENCIAS</div><h1>Inventario</h1><p>Administra productos, existencias y costos de compra.</p></div>
      <div className="inventory-header-actions"><button className="button button-secondary" onClick={() => setShowCategoryForm(true)}><span className="category-plus">+</span> Nueva categoría</button><button className="button button-primary" onClick={() => { setEditing(null); setShowProductForm(true); }}><InventoryIcon name="plus" /> Registrar producto</button></div>
    </div>

    <section className="inventory-summary">
      <InventorySummary label="Productos registrados" value={String(products.length)} foot={`${categories.length} categorías`} icon="box" tone="blue" />
      <InventorySummary label="Unidades disponibles" value={new Intl.NumberFormat("es-CO").format(totalUnits)} foot="Existencias actuales" icon="units" tone="green" />
      <InventorySummary label="Valor invertido" value={formatCOP(invested)} foot="Cantidad × costo unitario" icon="money" tone="purple" />
      <InventorySummary label="Ganancia potencial" value={formatCOP(potentialProfit)} foot="Si vendes todas las existencias" icon="profit" tone="orange" />
    </section>

    <section className="panel inventory-panel">
      <div className="inventory-list-heading"><div><h2>Productos</h2><p>{products.length ? `${products.length} ${products.length === 1 ? "producto registrado" : "productos registrados"}` : "Administra los artículos de tu negocio"}</p></div><div className="inventory-filters"><label className="inventory-search"><InventoryIcon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto..." aria-label="Buscar producto" /></label><select className="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoría"><option>Todas las categorías</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div></div>
      {filteredProducts.length ? <div className="inventory-table-scroll"><table className="inventory-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th className="inventory-number">DISPONIBLE</th><th className="inventory-number">COSTO UNITARIO</th><th className="inventory-number">VALOR INVERTIDO</th><th className="inventory-number">PRECIO DE VENTA</th><th className="inventory-number">GANANCIA POTENCIAL</th><th className="inventory-actions-head">ACCIONES</th></tr></thead><tbody>{filteredProducts.map((product) => {
        const total = product.quantityAvailable * product.unitCost;
        const potential = (product.salePrice - product.unitCost) * product.quantityAvailable;
        const hasSales = protectedProductIds.includes(product.id);
        return <tr key={product.id}><td><div className="inventory-product-cell"><span className="product-avatar"><InventoryIcon name="box" size={17}/></span><span><strong>{product.name}</strong>{product.description && <small title={product.description}>{product.description}</small>}</span></div></td><td><span className="inventory-category-pill">{product.category}</span></td><td className="inventory-number stock-number"><strong>{new Intl.NumberFormat("es-CO").format(product.quantityAvailable)}</strong><small>unidades</small></td><td className="inventory-number">{formatCOP(product.unitCost)}</td><td className="inventory-number invested-cell">{formatCOP(total)}</td><td className="inventory-number">{formatCOP(product.salePrice)}</td><td className={`inventory-number ${potential >= 0 ? "potential-positive" : "potential-negative"}`}>{formatCOP(potential)}</td><td><div className="inventory-row-actions"><button className="inventory-action edit" aria-label={`Editar ${product.name}`} title="Editar" onClick={() => { setEditing(product); setShowProductForm(true); }}><InventoryIcon name="edit" size={16}/></button><button className="inventory-action delete" aria-label={hasSales ? `${product.name} tiene ventas asociadas` : `Eliminar ${product.name}`} title={hasSales ? "No se puede eliminar: tiene ventas asociadas" : "Eliminar"} disabled={hasSales} onClick={() => setDeleteCandidate(product)}><InventoryIcon name="trash" size={16}/></button></div></td></tr>;
      })}</tbody></table></div> : <div className="inventory-empty"><div className="inventory-empty-icon"><InventoryIcon name="box" size={23}/></div><strong>{products.length ? "No encontramos productos" : "Tu inventario está listo para comenzar"}</strong><span>{products.length ? "Prueba otra búsqueda o cambia el filtro de categoría." : "Registra tu primera compra para organizar tus productos y controlar su valor."}</span>{!products.length && <button className="empty-action" onClick={() => setShowProductForm(true)}><InventoryIcon name="plus" size={15}/> Registrar primer producto</button>}</div>}
      <div className="inventory-table-footer"><span>Mostrando {filteredProducts.length} de {products.length} productos</span><span><i /> Actualizado automáticamente</span></div>
    </section>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    {(showProductForm || editing) && <ProductModal key={editing?.id ?? "new-product"} product={editing} categories={categories} availableCapital={availableCapital} onClose={() => { setEditing(null); setShowProductForm(false); }} onSave={saveProduct} onCreateCategory={(name) => onCategoriesChange([...categories, name])} />}
    {showCategoryForm && <CategoryModal categories={categories} onClose={() => setShowCategoryForm(false)} onSave={(category) => { onCategoriesChange([...categories, category]); setShowCategoryForm(false); }} />}
    {deleteCandidate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteCandidate(null); }}><section className="movement-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title"><div className="modal-header"><div><span className="eyebrow">CONFIRMAR ACCIÓN</span><h2 id="delete-product-title">Eliminar producto</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => setDeleteCandidate(null)}><InventoryIcon name="close"/></button></div><p className="delete-copy">¿Seguro que deseas eliminar <strong>{deleteCandidate.name}</strong>? Se retirará su valor disponible del inventario. El movimiento histórico de compra se conservará.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleteCandidate(null)}>Cancelar</button><button className="button delete-confirm" onClick={removeProduct}>Eliminar producto</button></div></section></div>}
  </>;
}

function InventorySummary({ label, value, foot, icon, tone }: { label: string; value: string; foot: string; icon: string; tone: string }) {
  return <article className="inventory-summary-card"><span className={`inventory-summary-icon ${tone}`}>{icon === "box" ? <InventoryIcon name="box" size={19}/> : icon === "units" ? <span className="units-glyph">#</span> : icon === "money" ? <span className="money-glyph">$</span> : <span className="profit-glyph">↗</span>}</span><span className="inventory-summary-label">{label}</span><strong>{value}</strong><small>{foot}</small></article>;
}

function ProductModal({ product, categories, availableCapital, onClose, onSave, onCreateCategory }: { product: InventoryProduct | null; categories: string[]; availableCapital: number; onClose: () => void; onSave: ProductChange; onCreateCategory: (name: string) => void }) {
  const [draft, setDraft] = useState<ProductDraft>(() => product ? { ...product } : emptyDraft(categories[0] ?? "Otros"));
  const [addCategory, setAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const totalCost = draft.quantityPurchased * draft.unitCost;

  function change<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function createCategory() {
    const normalized = newCategory.trim();
    if (!normalized) return setError("Escribe el nombre de la categoría.");
    if (categories.some((category) => category.toLocaleLowerCase("es-CO") === normalized.toLocaleLowerCase("es-CO"))) return setError("Esta categoría ya existe.");
    onCreateCategory(normalized);
    change("category", normalized);
    setNewCategory("");
    setAddCategory(false);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) return setError("Escribe el nombre del producto.");
    if (!draft.category) return setError("Selecciona una categoría.");
    if (!Number.isInteger(draft.quantityPurchased) || draft.quantityPurchased < 1) return setError("La cantidad comprada debe ser un número entero mayor que cero.");
    if (!Number.isInteger(draft.quantityAvailable) || draft.quantityAvailable < 0) return setError("La cantidad disponible debe ser un número entero igual o mayor que cero.");
    if (draft.quantityAvailable > draft.quantityPurchased) return setError("La cantidad disponible no puede superar la cantidad comprada.");
    if (!Number.isFinite(draft.unitCost) || draft.unitCost <= 0 || !Number.isFinite(draft.salePrice) || draft.salePrice <= 0) return setError("El costo y el precio de venta deben ser mayores que cero.");
    if (!draft.purchaseDate) return setError("Selecciona la fecha de compra.");
    if (!product && totalCost > availableCapital) return setError(`La compra supera el capital disponible (${formatCOP(availableCapital)}).`);
    if (product && draft.quantityAvailable * draft.unitCost - product.quantityAvailable * product.unitCost > availableCapital) return setError(`El ajuste supera el capital disponible (${formatCOP(availableCapital)}).`);
    onSave({ ...draft, name: draft.name.trim(), description: draft.description.trim(), supplier: draft.supplier.trim() });
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="modal-header"><div><span className="eyebrow">{product ? "ACTUALIZA TU CATÁLOGO" : "NUEVA COMPRA"}</span><h2 id="product-modal-title">{product ? "Editar producto" : "Registrar producto"}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><InventoryIcon name="close"/></button></div><form onSubmit={submit}>
    <label>Nombre del producto<input autoFocus value={draft.name} onChange={(event) => change("name", event.target.value)} placeholder="Ej. Audífonos inalámbricos" maxLength={90}/></label>
    <div className="category-field"><label>Categoría<select value={draft.category} onChange={(event) => change("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><button type="button" className="inline-add-category" onClick={() => { setAddCategory(!addCategory); setError(""); }} aria-label="Crear categoría">+</button></div>
    {addCategory && <div className="inline-category-create"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createCategory(); } }} placeholder="Nombre de la categoría" maxLength={40}/><button type="button" onClick={createCategory}>Agregar</button></div>}
    <label>Descripción <span className="optional-field">OPCIONAL</span><textarea value={draft.description} onChange={(event) => change("description", event.target.value)} placeholder="Detalles del producto" maxLength={240} rows={2}/></label>
    <div className="form-two"><label>Cantidad comprada<input type="number" min="1" step="1" value={draft.quantityPurchased} onChange={(event) => { const quantity = event.target.value === "" ? 0 : Number(event.target.value); change("quantityPurchased", quantity); if (!product) change("quantityAvailable", quantity); }}/></label><label>Cantidad disponible<input type="number" min="0" step="1" value={draft.quantityAvailable} readOnly={!product} onChange={(event) => change("quantityAvailable", event.target.value === "" ? 0 : Number(event.target.value))}/></label></div>
    <div className="form-two"><label>Costo unitario de compra<input type="number" min="1" step="1" inputMode="numeric" value={draft.unitCost || ""} onChange={(event) => change("unitCost", Number(event.target.value))} placeholder="0"/></label><label>Precio de venta esperado<input type="number" min="1" step="1" inputMode="numeric" value={draft.salePrice || ""} onChange={(event) => change("salePrice", Number(event.target.value))} placeholder="0"/></label></div>
    {!product && <div className="purchase-preview"><span>Compra total</span><strong>{formatCOP(totalCost)}</strong><span>Disponible después de comprar</span><strong>{formatCOP(Math.max(0, availableCapital - totalCost))}</strong></div>}
    <div className="form-two"><label>Fecha de compra<input type="date" value={draft.purchaseDate} onChange={(event) => change("purchaseDate", event.target.value)}/></label><label>Proveedor <span className="optional-field">OPCIONAL</span><input value={draft.supplier} onChange={(event) => change("supplier", event.target.value)} placeholder="Nombre del proveedor" maxLength={80}/></label></div>
    {error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">{product ? "Guardar cambios" : "Registrar compra"}</button></div>
    </form></section></div>;
}

function CategoryModal({ categories, onClose, onSave }: { categories: string[]; onClose: () => void; onSave: (category: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) return setError("Escribe el nombre de la categoría.");
    if (categories.some((category) => category.toLocaleLowerCase("es-CO") === normalized.toLocaleLowerCase("es-CO"))) return setError("Esta categoría ya existe.");
    onSave(normalized);
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><div className="modal-header"><div><span className="eyebrow">ORGANIZA TU CATÁLOGO</span><h2 id="category-modal-title">Nueva categoría</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><InventoryIcon name="close"/></button></div><form onSubmit={submit}><label>Nombre de la categoría<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Bebidas" maxLength={40}/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">Crear categoría</button></div></form><div className="category-chips">{categories.map((category) => <span key={category}>{category}</span>)}</div></section></div>;
}
