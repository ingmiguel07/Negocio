"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatCOP, type ExternalOrderRecord, type InventoryProduct, type Movement, type SaleRecord } from "@/lib/finance";
import ExternalOrdersModule, { ExternalOrderModal, OrderPaymentModal, type ExternalOrderDraft } from "@/components/external-orders-module";

export type SaleDraft = Omit<SaleRecord, "id" | "payments"> & { initialPayment: number };
type PaymentState = "Pagado" | "Fiado" | "Abono parcial";

function SalesIcon({ name, size = 18 }: { name: "plus" | "dots" | "close" | "cart" | "search" | "cash"; size?: number }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14"/>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    cart: <><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="19" r="1"/><circle cx="18" cy="19" r="1"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    cash: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function getPaid(sale: SaleRecord) { return sale.payments.reduce((sum, payment) => sum + payment.amount, 0); }
function getTotal(sale: SaleRecord) { return sale.quantity * sale.unitPrice; }
function getBalance(sale: SaleRecord) { return Math.max(0, getTotal(sale) - getPaid(sale)); }
function getPaymentState(sale: SaleRecord): PaymentState { const paid = getPaid(sale); return paid >= getTotal(sale) ? "Pagado" : paid > 0 ? "Abono parcial" : "Fiado"; }
function dateLabel(date: string) { return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }

export default function SalesModule({
  sales,
  legacySales,
  externalOrders,
  products,
  requestedEditSale,
  requestedEditOrder,
  onRequestedEditHandled,
  onRequestedOrderEditHandled,
  onSave,
  onSaveOrder,
  onDelete,
  onDeleteOrder,
  onPayment,
  onOrderPayment,
  onEditLegacy,
  onDeleteLegacy,
}: {
  sales: SaleRecord[];
  legacySales: Movement[];
  externalOrders: ExternalOrderRecord[];
  products: InventoryProduct[];
  requestedEditSale: SaleRecord | null;
  requestedEditOrder: ExternalOrderRecord | null;
  onRequestedEditHandled: () => void;
  onRequestedOrderEditHandled: () => void;
  onSave: (draft: SaleDraft, id?: string) => string | null;
  onSaveOrder: (draft: ExternalOrderDraft, id?: string) => string | null;
  onDelete: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onPayment: (id: string, amount: number, date: string) => string | null;
  onOrderPayment: (id: string, amount: number, date: string) => string | null;
  onEditLegacy: (movement: Movement) => void;
  onDeleteLegacy: (movement: Movement) => void;
}) {
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [paymentSale, setPaymentSale] = useState<SaleRecord | null>(null);
  const [deleteSale, setDeleteSale] = useState<SaleRecord | null>(null);
  const [menuSaleId, setMenuSaleId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [menuLegacyId, setMenuLegacyId] = useState<string | null>(null);
  const [menuOrderId, setMenuOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<ExternalOrderRecord | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<ExternalOrderRecord | null>(null);
  const [detailOrder, setDetailOrder] = useState<ExternalOrderRecord | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<ExternalOrderRecord | null>(null);
  const [saleFilter, setSaleFilter] = useState("Todas las ventas");
  const [search, setSearch] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"sales" | "orders">("sales");
  const [showEntrySelector, setShowEntrySelector] = useState(false);
  const [entryMode, setEntryMode] = useState<"inventory" | "external">("inventory");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const currentTab = requestedEditSale ? "sales" : requestedEditOrder ? "orders" : activeTab;
  const activeEditingSale = editingSale ?? requestedEditSale;
  const sortedSales = useMemo(() => [...sales].sort((a, b) => b.date.localeCompare(a.date)), [sales]);
  const visibleSales = sortedSales.filter((sale) => saleFilter !== "externas" && (saleFilter !== "inventario" || !sale.productId.startsWith("migrated-receivable:")) && (saleFilter !== "fiadas" || getBalance(sale) > 0) && (saleFilter !== "pagadas" || getBalance(sale) === 0) && `${sale.clientName} ${sale.productName}`.toLocaleLowerCase("es-CO").includes(search.toLocaleLowerCase("es-CO")));
  const visibleExternalOrders = [...externalOrders].sort((a, b) => b.date.localeCompare(a.date)).filter((order) => saleFilter !== "inventario" && (saleFilter !== "fiadas" || order.quantity * order.unitPrice > order.payments.reduce((sum, payment) => sum + payment.amount, 0)) && (saleFilter !== "pagadas" || order.quantity * order.unitPrice <= order.payments.reduce((sum, payment) => sum + payment.amount, 0)) && `${order.clientName} ${order.productName}`.toLocaleLowerCase("es-CO").includes(search.toLocaleLowerCase("es-CO")));
  const visibleLegacySales = legacySales.filter((sale) => saleFilter !== "externas" && (saleFilter !== "fiadas" || sale.status === "Pendiente") && (saleFilter !== "pagadas" || sale.status === "Completado") && `${sale.description} Venta anterior`.toLocaleLowerCase("es-CO").includes(search.toLocaleLowerCase("es-CO")));
  const totalSold = sales.reduce((sum, sale) => sum + getTotal(sale), 0) + externalOrders.reduce((sum, order) => sum + order.quantity * order.unitPrice, 0) + legacySales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalReceived = sales.reduce((sum, sale) => sum + getPaid(sale), 0) + externalOrders.reduce((sum, order) => sum + order.payments.reduce((paid, payment) => paid + payment.amount, 0), 0) + legacySales.filter((sale) => sale.status === "Completado").reduce((sum, sale) => sum + sale.amount, 0);
  const totalReceivables = sales.reduce((sum, sale) => sum + getBalance(sale), 0) + externalOrders.reduce((sum, order) => sum + Math.max(0, order.quantity * order.unitPrice - order.payments.reduce((paid, payment) => paid + payment.amount, 0)), 0) + legacySales.filter((sale) => sale.status === "Pendiente").reduce((sum, sale) => sum + sale.amount, 0);
  const totalProfit = sales.reduce((sum, sale) => sum + (sale.unitPrice - sale.unitCost) * sale.quantity, 0) + externalOrders.reduce((sum, order) => sum + (order.unitPrice - order.unitCost) * order.quantity, 0) + legacySales.filter((sale) => sale.status === "Completado").reduce((sum, sale) => sum + Math.max(0, sale.amount - (sale.cost ?? 0)), 0);
  const customerBalances = useMemo(() => {
    const balances = new Map<string, { name: string; balance: number; count: number }>();
    for (const sale of sales) {
      const balance = getBalance(sale);
      if (!balance) continue;
      const key = sale.clientName.trim().toLocaleLowerCase("es-CO");
      const existing = balances.get(key);
      balances.set(key, { name: existing?.name ?? sale.clientName, balance: (existing?.balance ?? 0) + balance, count: (existing?.count ?? 0) + 1 });
    }
    for (const order of externalOrders) {
      const balance = Math.max(0, order.quantity * order.unitPrice - order.payments.reduce((sum, payment) => sum + payment.amount, 0));
      if (!balance) continue;
      const key = order.clientName.trim().toLocaleLowerCase("es-CO");
      const existing = balances.get(key);
      balances.set(key, { name: existing?.name ?? order.clientName, balance: (existing?.balance ?? 0) + balance, count: (existing?.count ?? 0) + 1 });
    }
    const legacyBalance = legacySales.filter((sale) => sale.status === "Pendiente").reduce((sum, sale) => sum + sale.amount, 0);
    const legacyCount = legacySales.filter((sale) => sale.status === "Pendiente").length;
    if (legacyBalance > 0) balances.set("__legacy__", { name: "Ventas anteriores sin cliente", balance: legacyBalance, count: legacyCount });
    return [...balances.values()].sort((a, b) => b.balance - a.balance);
  }, [sales, externalOrders, legacySales]);

  function saveSale(draft: SaleDraft) {
    const error = onSave(draft, activeEditingSale?.id);
    if (error) return error;
    setShowSaleForm(false);
    setEditingSale(null);
    if (requestedEditSale) { setActiveTab("sales"); onRequestedEditHandled(); }
    return null;
  }

  function savePayment(amount: number, date: string) {
    if (!paymentSale) return "Selecciona una venta.";
    const error = onPayment(paymentSale.id, amount, date);
    if (!error) setPaymentSale(null);
    return error;
  }

  function saveOrder(draft: ExternalOrderDraft) {
    const error = onSaveOrder(draft);
    if (error) return error;
    setShowOrderForm(false);
    return null;
  }

  function saveEditedOrder(draft: ExternalOrderDraft) {
    if (!editingOrder) return "Selecciona un pedido para editar.";
    const error = onSaveOrder(draft, editingOrder.id);
    if (!error) setEditingOrder(null);
    return error;
  }

  function saveOrderPayment(amount: number, date: string) {
    if (!paymentOrder) return "Selecciona un pedido.";
    const error = onOrderPayment(paymentOrder.id, amount, date);
    if (!error) setPaymentOrder(null);
    return error;
  }

  if (currentTab === "orders") return <>
    <ExternalOrdersModule orders={externalOrders} requestedEditOrder={requestedEditOrder} onRequestedEditHandled={() => { onRequestedOrderEditHandled(); setActiveTab("orders"); }} onSave={onSaveOrder} onDelete={onDeleteOrder} onPayment={onOrderPayment} onBackToSales={() => setActiveTab("sales")} onNewOrder={() => { setEntryMode("external"); setShowEntrySelector(true); }}/>
    {showEntrySelector && <SaleEntrySelector mode={entryMode} onModeChange={setEntryMode} onClose={() => setShowEntrySelector(false)} onContinue={() => { setShowEntrySelector(false); if (entryMode === "inventory") { setActiveTab("sales"); setEditingSale(null); setShowSaleForm(true); } else setShowOrderForm(true); }}/ >}
    {showOrderForm && <ExternalOrderModal order={null} onClose={() => setShowOrderForm(false)} onSave={saveOrder}/>}
  </>;

  return <>
    <div className="section-welcome"><div><div className="eyebrow"><span className="live-dot"/> VENTAS Y CARTERA</div><h1>Ventas</h1><p>Registra ventas, controla los pagos y consulta tus cuentas por cobrar.</p></div><button className="button button-primary" onClick={() => { setEntryMode("inventory"); setShowEntrySelector(true); }}><SalesIcon name="plus"/> Nueva venta</button></div>
    <div className="sales-mode-tabs" role="tablist" aria-label="Modalidad de venta"><button role="tab" aria-selected="true" className="sales-mode-tab active" onClick={() => setActiveTab("sales")}><SalesIcon name="cart" size={16}/> Ventas desde inventario</button><button role="tab" aria-selected="false" className="sales-mode-tab" onClick={() => setActiveTab("orders")}><span className="orders-tab-glyph">↗</span> Pedidos sin inventario{externalOrders.length > 0 && <span className="sales-tab-count">{externalOrders.length}</span>}</button></div>
    <section className="section-stat-grid sales-stat-grid">
      <SalesStat label="Ventas registradas" value={formatCOP(totalSold)} foot={`${sales.length + externalOrders.length + legacySales.length} ${sales.length + externalOrders.length + legacySales.length === 1 ? "venta" : "ventas"}`} icon="cart" tone="blue"/>
      <SalesStat label="Dinero recibido" value={formatCOP(totalReceived)} foot="Pagos y abonos reales" icon="cash" tone="green"/>
      <SalesStat label="Cartera pendiente" value={formatCOP(totalReceivables)} foot={`${customerBalances.length} ${customerBalances.length === 1 ? "cliente" : "clientes"} con saldo`} icon="balance" tone="orange"/>
      <SalesStat label="Ganancia de ventas" value={formatCOP(totalProfit)} foot="Venta total menos costo" icon="profit" tone="purple"/>
    </section>
    <section className="panel sales-panel">
      <div className="sales-heading"><div><h2>Registro de ventas</h2><p>Ventas de inventario y pedidos externos con sus pagos enlazados.</p></div><div className="sales-list-filters"><select aria-label="Filtrar ventas" value={saleFilter} onChange={(event) => setSaleFilter(event.target.value)}><option value="Todas las ventas">Todas las ventas</option><option value="inventario">Desde inventario</option><option value="externas">Externas</option><option value="fiadas">Fiadas / con saldo</option><option value="pagadas">Pagadas</option></select><label className="inventory-search sales-search"><SalesIcon name="search" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente o producto..." aria-label="Buscar ventas"/></label></div></div>
      {visibleSales.length || visibleLegacySales.length || visibleExternalOrders.length ? <div className="sales-table-scroll"><table className="sales-table"><thead><tr><th>CLIENTE / PRODUCTO</th><th>FECHA</th><th className="sales-number">TOTAL VENTA</th><th className="sales-number">RECIBIDO</th><th className="sales-number">PENDIENTE</th><th>ESTADO</th><th className="sales-actions-head">ACCIONES</th></tr></thead><tbody>{visibleSales.map((sale) => {
        const paid = getPaid(sale); const balance = getBalance(sale); const state = getPaymentState(sale);
        return <tr key={sale.id}><td><div className="sales-item"><span className="sales-product-icon"><SalesIcon name="cart" size={16}/></span><span><strong>{sale.clientName}</strong><small>{sale.productName} · {sale.quantity} {sale.quantity === 1 ? "unidad" : "unidades"} · <span className="sale-origin-badge inventory-sale-badge">Inventario</span></small></span></div></td><td>{dateLabel(sale.date)}</td><td className="sales-number sales-total-cell">{formatCOP(getTotal(sale))}</td><td className="sales-number received-cell">{formatCOP(paid)}</td><td className={`sales-number ${balance ? "balance-cell" : "received-cell"}`}>{formatCOP(balance)}</td><td><span className={`sale-status sale-status-${state === "Pagado" ? "paid" : state === "Fiado" ? "credit" : "partial"}`}><i/>{state}</span></td><td className="sales-action-cell"><button className="icon-button sale-menu-trigger" aria-label={`Opciones de venta de ${sale.clientName}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ top: Math.min(rect.bottom + 3, window.innerHeight - 150), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) }); setMenuSaleId(menuSaleId === sale.id ? null : sale.id); }}><SalesIcon name="dots"/></button>{menuSaleId === sale.id && <><button className="sales-menu-dismiss" aria-label="Cerrar menú" onClick={() => setMenuSaleId(null)}/><div className="sales-menu" style={{ top: menuPosition.top, left: menuPosition.left }}><button onClick={() => { setEditingSale(sale); setShowSaleForm(true); setMenuSaleId(null); }}>Editar venta</button>{balance > 0 && <><button onClick={() => { setPaymentSale(sale); setMenuSaleId(null); }}>Registrar abono</button><button onClick={() => { const error = onPayment(sale.id, balance, new Date().toISOString().slice(0, 10)); if (error) { setActionNotice(error); window.setTimeout(() => setActionNotice(""), 3000); } setMenuSaleId(null); }}>Marcar pagada</button></>}<button className="sales-menu-delete" onClick={() => { setDeleteSale(sale); setMenuSaleId(null); }}>Eliminar venta</button></div></>}</td></tr>;
      })}{visibleLegacySales.map((sale) => <tr key={`legacy-${sale.id}`}><td><div className="sales-item"><span className="sales-product-icon legacy-sale-icon"><SalesIcon name="cart" size={16}/></span><span><strong>Cliente sin registrar</strong><small>{sale.description || "Venta anterior"}</small></span></div></td><td>{dateLabel(sale.date)}</td><td className="sales-number sales-total-cell">{formatCOP(sale.amount)}</td><td className="sales-number received-cell">{formatCOP(sale.status === "Completado" ? sale.amount : 0)}</td><td className={`sales-number ${sale.status === "Pendiente" ? "balance-cell" : "received-cell"}`}>{formatCOP(sale.status === "Pendiente" ? sale.amount : 0)}</td><td><span className={`sale-status sale-status-${sale.status === "Completado" ? "paid" : "credit"}`}><i/>{sale.status === "Completado" ? "Pagado" : "Pendiente"}</span></td><td className="sales-action-cell"><button className="icon-button sale-menu-trigger" aria-label={`Opciones de ${sale.description}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ top: Math.min(rect.bottom + 3, window.innerHeight - 110), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) }); setMenuLegacyId(menuLegacyId === sale.id ? null : sale.id); }}><SalesIcon name="dots"/></button>{menuLegacyId === sale.id && <><button className="sales-menu-dismiss" aria-label="Cerrar menú" onClick={() => setMenuLegacyId(null)}/><div className="sales-menu" style={{ top: menuPosition.top, left: menuPosition.left }}><button onClick={() => { setMenuLegacyId(null); onEditLegacy(sale); }}>Editar movimiento</button><button className="sales-menu-delete" onClick={() => { setMenuLegacyId(null); onDeleteLegacy(sale); }}>Eliminar movimiento</button></div></>}</td></tr>)}{visibleExternalOrders.map((order) => {
        const total = order.quantity * order.unitPrice; const received = order.payments.reduce((sum, payment) => sum + payment.amount, 0); const balance = Math.max(0, total - received); const status: PaymentState = received >= total ? "Pagado" : received > 0 ? "Abono parcial" : "Fiado";
        return <tr key={`external-${order.id}`}><td><div className="sales-item"><span className="sales-product-icon external-sale-icon">↗</span><span><strong>{order.clientName}</strong><small>{order.productName} · {order.quantity} {order.quantity === 1 ? "unidad" : "unidades"} · <span className="sale-origin-badge">Pedido externo</span></small></span></div></td><td>{dateLabel(order.date)}</td><td className="sales-number sales-total-cell">{formatCOP(total)}</td><td className="sales-number received-cell">{formatCOP(received)}</td><td className={`sales-number ${balance ? "balance-cell" : "received-cell"}`}>{formatCOP(balance)}</td><td><span className={`sale-status sale-status-${status === "Pagado" ? "paid" : status === "Fiado" ? "credit" : "partial"}`}><i/>{status}</span></td><td className="sales-action-cell"><button className="icon-button sale-menu-trigger" aria-label={`Opciones de venta externa ${order.productName} de ${order.clientName}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ top: Math.min(rect.bottom + 3, window.innerHeight - 170), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) }); setMenuOrderId(menuOrderId === order.id ? null : order.id); }}><SalesIcon name="dots"/></button>{menuOrderId === order.id && <><button className="sales-menu-dismiss" aria-label="Cerrar menú" onClick={() => setMenuOrderId(null)}/><div className="sales-menu" style={{ top: menuPosition.top, left: menuPosition.left }}><button onClick={() => { setDetailOrder(order); setMenuOrderId(null); }}>Ver detalle e historial</button>{balance > 0 && <button onClick={() => { setPaymentOrder(order); setMenuOrderId(null); }}>Registrar abono</button>}<button onClick={() => { setEditingOrder(order); setMenuOrderId(null); }}>Editar venta</button><button className="sales-menu-delete" onClick={() => { setDeleteOrder(order); setMenuOrderId(null); }}>Eliminar venta</button></div></>}</td></tr>;
      })}</tbody></table></div> : <div className="sales-empty"><span className="sales-empty-icon"><SalesIcon name="cart" size={22}/></span><strong>{sales.length || legacySales.length || externalOrders.length ? "No encontramos ventas" : "Aún no hay ventas registradas"}</strong><span>{sales.length || legacySales.length || externalOrders.length ? "Intenta con otro cliente o producto." : products.length ? "Registra la primera venta para actualizar el inventario y controlar los pagos." : "Agrega productos al inventario antes de registrar una venta."}</span>{products.length > 0 && <button className="empty-action" onClick={() => setShowEntrySelector(true)}><SalesIcon name="plus" size={15}/> Registrar primera venta</button>}</div>}
      <div className="sales-table-footer"><span>Mostrando {visibleSales.length + visibleLegacySales.length + visibleExternalOrders.length} de {sales.length + legacySales.length + externalOrders.length} ventas</span><span><i/> Pagos y movimientos sincronizados</span></div>
    </section>
    <section className="panel client-balance-panel"><div className="sales-heading"><div><h2>Cartera por cliente</h2><p>Saldo pendiente acumulado de las ventas fiadas y abonos.</p></div><strong className="client-balance-total">{formatCOP(totalReceivables)}</strong></div>{customerBalances.length ? <div className="client-balance-list">{customerBalances.map((customer) => <div className="client-balance-row" key={customer.name.toLocaleLowerCase("es-CO")}><span className="client-avatar">{customer.name.trim().slice(0, 1).toLocaleUpperCase("es-CO")}</span><span className="client-balance-name"><strong>{customer.name}</strong><small>{customer.count} {customer.count === 1 ? "venta pendiente" : "ventas pendientes"}</small></span><strong className="client-balance-amount">{formatCOP(customer.balance)}</strong></div>)}</div> : <div className="client-balance-empty">No hay saldos pendientes por cobrar.</div>}</section>

    {actionNotice && <div className="toast" role="status"><span>!</span>{actionNotice}</div>}
    {showEntrySelector && <SaleEntrySelector mode={entryMode} onModeChange={setEntryMode} onClose={() => setShowEntrySelector(false)} onContinue={() => { setShowEntrySelector(false); if (entryMode === "inventory") { setEditingSale(null); setShowSaleForm(true); } else { setActiveTab("orders"); setShowOrderForm(true); } }}/ >}
    {(showSaleForm || activeEditingSale) && <SaleModal key={activeEditingSale?.id ?? "new-sale"} sale={activeEditingSale} products={products} onClose={() => { setShowSaleForm(false); setEditingSale(null); if (requestedEditSale) { setActiveTab("sales"); onRequestedEditHandled(); } }} onSave={saveSale}/>}
    {paymentSale && <PaymentModal sale={paymentSale} onClose={() => setPaymentSale(null)} onSave={savePayment}/>}
    {paymentOrder && <OrderPaymentModal order={paymentOrder} onClose={() => setPaymentOrder(null)} onSave={saveOrderPayment}/>}
    {editingOrder && <ExternalOrderModal key={`edit-${editingOrder.id}`} order={editingOrder} onClose={() => setEditingOrder(null)} onSave={saveEditedOrder}/>}
    {detailOrder && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailOrder(null); }}><section className="movement-modal external-order-detail" role="dialog" aria-modal="true" aria-labelledby="sale-detail-title"><div className="modal-header"><div><span className="eyebrow">PEDIDO EXTERNO · {detailOrder.orderStatus.toLocaleUpperCase("es-CO")}</span><h2 id="sale-detail-title">Detalle de la venta</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => setDetailOrder(null)}><SalesIcon name="close"/></button></div><div className="order-detail-grid"><span>Cliente</span><strong>{detailOrder.clientName}</strong><span>Producto</span><strong>{detailOrder.productName} · {detailOrder.quantity} unidades</strong><span>Fecha</span><strong>{dateLabel(detailOrder.date)}</strong><span>Proveedor</span><strong>{detailOrder.supplier || "Sin proveedor"}</strong><span>Costo de adquisición</span><strong>{formatCOP(detailOrder.unitCost * detailOrder.quantity)}{detailOrder.supplierPaid ? " · Pagado" : " · Pendiente"}</strong><span>Venta total</span><strong>{formatCOP(detailOrder.unitPrice * detailOrder.quantity)}</strong><span>Ganancia estimada</span><strong>{formatCOP((detailOrder.unitPrice - detailOrder.unitCost) * detailOrder.quantity)}</strong><span>Recibido / saldo</span><strong>{formatCOP(detailOrder.payments.reduce((sum, payment) => sum + payment.amount, 0))} / {formatCOP(Math.max(0, detailOrder.quantity * detailOrder.unitPrice - detailOrder.payments.reduce((sum, payment) => sum + payment.amount, 0)))}</strong></div><div className="order-detail-history"><h3>Historial de pagos</h3>{detailOrder.payments.length ? detailOrder.payments.map((payment) => <div key={payment.id}><span>{dateLabel(payment.date)}</span><strong>{formatCOP(payment.amount)}</strong></div>) : <p>No hay pagos registrados.</p>}</div><div className="modal-actions"><button className="button button-secondary" onClick={() => setDetailOrder(null)}>Cerrar</button>{detailOrder.quantity * detailOrder.unitPrice > detailOrder.payments.reduce((sum, payment) => sum + payment.amount, 0) && <button className="button button-primary" onClick={() => { setPaymentOrder(detailOrder); setDetailOrder(null); }}>Registrar abono</button>}</div></section></div>}
    {deleteOrder && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteOrder(null); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="delete-external-sale-title"><div className="modal-header"><div><span className="eyebrow">CONFIRMAR ACCIÓN</span><h2 id="delete-external-sale-title">Eliminar venta externa</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => setDeleteOrder(null)}><SalesIcon name="close"/></button></div><p className="delete-copy">Se eliminará la venta de <strong>{deleteOrder.clientName}</strong> y sus pagos relacionados. Se actualizarán el saldo por cobrar, el costo del proveedor, el capital y la ganancia. El inventario tradicional no cambia.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleteOrder(null)}>Cancelar</button><button className="button delete-confirm" onClick={() => { onDeleteOrder(deleteOrder.id); setDeleteOrder(null); }}>Eliminar venta</button></div></section></div>}
    {deleteSale && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteSale(null); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="delete-sale-title"><div className="modal-header"><div><span className="eyebrow">CONFIRMAR ACCIÓN</span><h2 id="delete-sale-title">Eliminar venta</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => setDeleteSale(null)}><SalesIcon name="close"/></button></div><p className="delete-copy">Se eliminará la venta de <strong>{deleteSale.clientName}</strong>, se devolverán {deleteSale.quantity} {deleteSale.quantity === 1 ? "unidad" : "unidades"} al inventario y se retirarán sus pagos y movimientos asociados. La cartera y las ganancias se recalcularán.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleteSale(null)}>Cancelar</button><button className="button delete-confirm" onClick={() => { onDelete(deleteSale.id); setDeleteSale(null); }}>Eliminar venta</button></div></section></div>}
  </>;
}

function SalesStat({ label, value, foot, icon, tone }: { label: string; value: string; foot: string; icon: string; tone: string }) {
  return <div className="section-stat sales-stat"><span className={`section-stat-icon sales-stat-icon ${tone}`}>{icon === "cart" ? <SalesIcon name="cart" size={18}/> : icon === "cash" ? <SalesIcon name="cash" size={18}/> : icon === "balance" ? <span>$</span> : <span>↗</span>}</span><span>{label}</span><strong>{value}</strong><small>{foot}</small></div>;
}

function SaleEntrySelector({ mode, onModeChange, onClose, onContinue }: { mode: "inventory" | "external"; onModeChange: (mode: "inventory" | "external") => void; onClose: () => void; onContinue: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal sale-entry-selector" role="dialog" aria-modal="true" aria-labelledby="sale-entry-title"><div className="modal-header"><div><span className="eyebrow">NUEVA OPERACIÓN</span><h2 id="sale-entry-title">¿Cómo registrarás esta venta?</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><SalesIcon name="close"/></button></div><label>Modalidad de venta<select value={mode} onChange={(event) => onModeChange(event.target.value as "inventory" | "external")}><option value="inventory">Venta desde inventario</option><option value="external">Pedido sin inventario</option></select></label><div className="sale-entry-description">{mode === "inventory" ? "Descuenta productos de las existencias actuales." : "Registra la compra al proveedor y la venta al cliente sin modificar las existencias tradicionales."}</div><div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" onClick={onContinue}>Continuar</button></div></section></div>;
}

function SaleModal({ sale, products, onClose, onSave }: { sale: SaleRecord | null; products: InventoryProduct[]; onClose: () => void; onSave: (draft: SaleDraft) => string | null }) {
  const [clientName, setClientName] = useState(sale?.clientName ?? "");
  const [productId, setProductId] = useState(sale?.productId ?? products.find((product) => product.quantityAvailable > 0)?.id ?? "");
  const selected = products.find((product) => product.id === productId);
  const historicalReceivable = Boolean(sale?.productId.startsWith("migrated-receivable:") && sale.productId === productId);
  const [quantity, setQuantity] = useState(sale?.quantity ?? 1);
  const [unitPrice, setUnitPrice] = useState(sale?.unitPrice ?? selected?.salePrice ?? 0);
  const [date, setDate] = useState(sale?.date ?? new Date().toISOString().slice(0, 10));
  const [paymentState, setPaymentState] = useState<PaymentState>(sale ? getPaymentState(sale) : "Pagado");
  const [initialPayment, setInitialPayment] = useState(sale ? getPaid(sale) : 0);
  const [error, setError] = useState("");
  const total = quantity * unitPrice;
  const unitCost = selected?.unitCost ?? sale?.unitCost ?? 0;
  const availableForThisSale = (selected?.quantityAvailable ?? 0) + (sale?.productId === productId ? sale.quantity : 0);

  function chooseProduct(id: string) {
    setProductId(id);
    const next = products.find((product) => product.id === id);
    if (next) setUnitPrice(next.salePrice);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientName.trim()) return setError("Escribe el nombre del cliente.");
    if (!selected && !historicalReceivable) return setError("Selecciona un producto del inventario.");
    if (!Number.isInteger(quantity) || quantity < 1) return setError("La cantidad vendida debe ser un número entero mayor que cero.");
    if (quantity > availableForThisSale) return setError(`Solo hay ${availableForThisSale} unidades disponibles para esta venta.`);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return setError("El precio de venta debe ser mayor que cero.");
    if (!date) return setError("Selecciona la fecha de venta.");
    if (sale && total < getPaid(sale)) return setError(`El total no puede ser menor que los pagos recibidos (${formatCOP(getPaid(sale))}).`);
    if (!sale && paymentState === "Abono parcial" && (initialPayment <= 0 || initialPayment >= total)) return setError("El abono inicial debe ser mayor que cero y menor que el total.");
    const received = sale ? getPaid(sale) : paymentState === "Pagado" ? total : paymentState === "Fiado" ? 0 : initialPayment;
    const saveError = onSave({ clientName: clientName.trim(), productId, productName: selected?.name ?? sale?.productName ?? "Venta histórica", quantity, unitPrice, unitCost, date, initialPayment: received });
    if (saveError) setError(saveError);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal sale-modal" role="dialog" aria-modal="true" aria-labelledby="sale-modal-title"><div className="modal-header"><div><span className="eyebrow">{sale ? "ACTUALIZA LA OPERACIÓN" : "NUEVA OPERACIÓN"}</span><h2 id="sale-modal-title">{sale ? "Editar venta" : "Registrar venta"}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><SalesIcon name="close"/></button></div><form onSubmit={submit}>
    <label>Nombre del cliente<input autoFocus value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ej. María Rodríguez" maxLength={100}/></label>
    <label>{historicalReceivable ? "Producto registrado" : "Producto del inventario"}<select value={productId} onChange={(event) => chooseProduct(event.target.value)}><option value="">Selecciona un producto</option>{historicalReceivable && sale && <option value={sale.productId}>{sale.productName} · cartera migrada</option>}{products.filter((product) => product.quantityAvailable > 0 || (sale?.productId === product.id)).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.quantityAvailable + (sale?.productId === product.id ? sale.quantity : 0)} disponibles</option>)}</select></label>
    {selected && <div className="sale-stock-info"><span>Existencias disponibles para esta operación</span><strong>{availableForThisSale} unidades</strong></div>}
    <div className="form-two"><label>Cantidad vendida<input type="number" min="1" max={availableForThisSale} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value === "" ? 0 : Number(event.target.value))}/></label><label>Precio de venta unitario<input type="number" min="1" step="1" inputMode="numeric" value={unitPrice || ""} onChange={(event) => setUnitPrice(Number(event.target.value))} placeholder="0"/></label></div>
    <div className="sale-price-preview"><span>Costo unitario (inventario)</span><strong>{formatCOP(unitCost)}</strong><span>Total de la venta</span><strong>{formatCOP(total)}</strong><span>Ganancia de la venta</span><strong className={total - quantity * unitCost >= 0 ? "received-cell" : "balance-cell"}>{formatCOP(total - quantity * unitCost)}</strong></div>
    <div className="form-two"><label>Fecha de venta<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>{sale ? <label>Estado del pago<span className={`sale-status form-sale-status sale-status-${getPaymentState(sale) === "Pagado" ? "paid" : getPaymentState(sale) === "Fiado" ? "credit" : "partial"}`}><i/>{getPaymentState(sale)} · {formatCOP(getPaid(sale))} recibido</span></label> : <label>Estado de pago<select value={paymentState} onChange={(event) => setPaymentState(event.target.value as PaymentState)}><option>Pagado</option><option>Fiado</option><option>Abono parcial</option></select></label>}</div>
    {!sale && paymentState === "Abono parcial" && <label>Abono recibido ahora<input type="number" min="1" max={Math.max(0,total-1)} step="1" inputMode="numeric" value={initialPayment || ""} onChange={(event) => setInitialPayment(Number(event.target.value))} placeholder="Valor del abono"/></label>}
    {sale && <div className="sale-edit-note">Los pagos ya recibidos se conservan. El total de la venta debe cubrirlos.</div>}
    {error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">{sale ? "Guardar cambios" : "Confirmar venta"}</button></div>
    </form></section></div>;
}

function PaymentModal({ sale, onClose, onSave }: { sale: SaleRecord; onClose: () => void; onSave: (amount: number, date: string) => string | null }) {
  const balance = getBalance(sale);
  const [amount, setAmount] = useState(balance);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return setError("Selecciona la fecha del pago.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return setError(`Ingresa un valor entre $1 y ${formatCOP(balance)}.`);
    const saveError = onSave(amount, date);
    if (saveError) setError(saveError);
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div className="modal-header"><div><span className="eyebrow">CUENTA POR COBRAR</span><h2 id="payment-title">Registrar abono</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><SalesIcon name="close"/></button></div><form onSubmit={submit}><div className="payment-balance-box"><span>{sale.clientName} · {sale.productName}</span><small>Saldo pendiente</small><strong>{formatCOP(balance)}</strong></div><label>Valor recibido<input autoFocus type="number" min="1" max={balance} step="1" inputMode="numeric" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))}/></label><label>Fecha del pago<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">Guardar pago</button></div></form></section></div>;
}
