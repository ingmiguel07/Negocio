"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatCOP, type ExternalOrderRecord, type ExternalOrderStatus } from "@/lib/finance";

export type ExternalOrderDraft = Omit<ExternalOrderRecord, "id" | "payments"> & { initialPayment: number };
type PaymentStatus = "Pagado" | "Fiado" | "Abono parcial";

const paidAmount = (order: ExternalOrderRecord) => order.payments.reduce((sum, payment) => sum + payment.amount, 0);
const saleTotal = (order: ExternalOrderRecord) => order.quantity * order.unitPrice;
const orderBalance = (order: ExternalOrderRecord) => Math.max(0, saleTotal(order) - paidAmount(order));
const paymentState = (order: ExternalOrderRecord): PaymentStatus => paidAmount(order) >= saleTotal(order) ? "Pagado" : paidAmount(order) > 0 ? "Abono parcial" : "Fiado";
const localDate = () => new Date().toISOString().slice(0, 10);
const formatDate = (date: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function OrderIcon({ name, size = 18 }: { name: "plus" | "dots" | "close" | "search" | "box" | "cash"; size?: number }) {
  const path = {
    plus: <path d="M12 5v14M5 12h14"/>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9"/></>,
    cash: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path[name]}</svg>;
}

export default function ExternalOrdersModule({
  orders,
  requestedEditOrder,
  onRequestedEditHandled,
  onSave,
  onDelete,
  onPayment,
  onBackToSales,
  onNewOrder,
}: {
  orders: ExternalOrderRecord[];
  requestedEditOrder: ExternalOrderRecord | null;
  onRequestedEditHandled: () => void;
  onSave: (draft: ExternalOrderDraft, id?: string) => string | null;
  onDelete: (id: string) => void;
  onPayment: (id: string, amount: number, date: string) => string | null;
  onBackToSales: () => void;
  onNewOrder: () => void;
}) {
  const [orderStatusFilter, setOrderStatusFilter] = useState("Todos los estados");
  const [paymentFilter, setPaymentFilter] = useState("Todos los pagos");
  const [search, setSearch] = useState("");
  const [editingOrder, setEditingOrder] = useState<ExternalOrderRecord | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<ExternalOrderRecord | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<ExternalOrderRecord | null>(null);
  const [historyOrder, setHistoryOrder] = useState<ExternalOrderRecord | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [notice, setNotice] = useState("");
  const activeEditing = editingOrder ?? requestedEditOrder;

  const filtered = useMemo(() => orders.filter((order) => {
    const matchesSearch = `${order.clientName} ${order.productName} ${order.supplier}`.toLocaleLowerCase("es-CO").includes(search.toLocaleLowerCase("es-CO"));
    const matchesOrderStatus = orderStatusFilter === "Todos los estados" || order.orderStatus === orderStatusFilter;
    const matchesPayment = paymentFilter === "Todos los pagos" || paymentState(order) === paymentFilter;
    return matchesSearch && matchesOrderStatus && matchesPayment;
  }), [orders, search, orderStatusFilter, paymentFilter]);
  const invested = orders.reduce((sum, order) => sum + Math.max(0, order.quantity * order.unitCost - Math.min(paidAmount(order), order.quantity * order.unitCost)), 0);
  const receivable = orders.reduce((sum, order) => sum + orderBalance(order), 0);
  const profit = orders.reduce((sum, order) => sum + (order.unitPrice - order.unitCost) * order.quantity, 0);
  const supplierDue = orders.filter((order) => !order.supplierPaid).reduce((sum, order) => sum + order.quantity * order.unitCost, 0);
  const clientBalances = useMemo(() => {
    const map = new Map<string, { name: string; balance: number; count: number }>();
    for (const order of orders) {
      const balance = orderBalance(order);
      if (!balance) continue;
      const key = order.clientName.trim().toLocaleLowerCase("es-CO");
      const existing = map.get(key);
      map.set(key, { name: existing?.name ?? order.clientName, balance: (existing?.balance ?? 0) + balance, count: (existing?.count ?? 0) + 1 });
    }
    return [...map.values()].sort((a, b) => b.balance - a.balance);
  }, [orders]);

  function saveOrder(draft: ExternalOrderDraft) {
    const error = onSave(draft, activeEditing?.id);
    if (error) return error;
    setEditingOrder(null);
    if (requestedEditOrder) onRequestedEditHandled();
    return null;
  }
  function savePayment(amount: number, date: string) {
    if (!paymentOrder) return "Selecciona un pedido.";
    const error = onPayment(paymentOrder.id, amount, date);
    if (!error) setPaymentOrder(null);
    return error;
  }

  return <>
    <div className="section-welcome"><div><div className="eyebrow"><span className="live-dot"/> PEDIDOS A PROVEEDOR</div><h1>Pedidos sin inventario</h1><p>Controla compras externas, entregas, pagos y cuentas por cobrar.</p></div><div className="order-header-actions"><button className="button button-secondary" onClick={onBackToSales}>Ventas desde inventario</button><button className="button button-primary" onClick={onNewOrder}><OrderIcon name="plus"/> Nuevo pedido</button></div></div>
    <section className="section-stat-grid order-stat-grid"><OrderStat title="Capital comprometido" value={formatCOP(invested)} note="Costo aún no recuperado del cliente" tone="blue"/><OrderStat title="Cartera por cobrar" value={formatCOP(receivable)} note="Ventas menos pagos recibidos" tone="orange"/><OrderStat title="Ganancia de pedidos" value={formatCOP(profit)} note="Precio de venta menos costo" tone="green"/><OrderStat title="Pendiente a proveedores" value={formatCOP(supplierDue)} note="Obligaciones por pagar" tone="purple"/></section>
    <section className="panel external-orders-panel"><div className="external-orders-heading"><div><h2>Seguimiento de pedidos</h2><p>Consulta el estado de compra, entrega y pago de cada pedido.</p></div><label className="inventory-search external-order-search"><OrderIcon name="search" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, producto o proveedor..." aria-label="Buscar pedidos"/></label></div><div className="external-order-filters"><select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)} aria-label="Filtrar por estado del pedido"><option>Todos los estados</option><option>Pendiente</option><option>Comprado</option><option>Entregado</option></select><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} aria-label="Filtrar por estado del pago"><option>Todos los pagos</option><option>Pagado</option><option>Fiado</option><option>Abono parcial</option></select></div>
      {filtered.length ? <div className="external-order-table-scroll"><table className="external-order-table"><thead><tr><th>CLIENTE / PRODUCTO</th><th>PROVEEDOR</th><th>ESTADO DEL PEDIDO</th><th className="external-number">TOTAL VENTA</th><th className="external-number">RECIBIDO</th><th className="external-number">POR COBRAR</th><th>PAGO</th><th/></tr></thead><tbody>{filtered.map((order) => {
        const paid = paidAmount(order); const balance = orderBalance(order); const payState = paymentState(order);
        return <tr key={order.id}><td><div className="external-order-name"><span className="external-order-icon"><OrderIcon name="box" size={16}/></span><span><strong>{order.clientName}</strong><small>{order.productName} · {order.quantity} {order.quantity === 1 ? "unidad" : "unidades"} · {formatDate(order.date)}</small></span></div></td><td>{order.supplier}</td><td><span className={`order-state order-state-${order.orderStatus.toLocaleLowerCase("es-CO")}`}>{order.orderStatus}</span>{!order.supplierPaid && <small className="supplier-pending-note">Proveedor pendiente</small>}</td><td className="external-number external-total">{formatCOP(saleTotal(order))}</td><td className="external-number external-paid">{formatCOP(paid)}</td><td className={`external-number ${balance ? "external-due" : "external-paid"}`}>{formatCOP(balance)}</td><td><span className={`sale-status sale-status-${payState === "Pagado" ? "paid" : payState === "Fiado" ? "credit" : "partial"}`}><i/>{payState}</span></td><td className="external-order-actions"><button className="icon-button sale-menu-trigger" aria-label={`Opciones del pedido ${order.productName} de ${order.clientName}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ top: Math.min(rect.bottom + 3, window.innerHeight - 170), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) }); setMenuId(menuId === order.id ? null : order.id); }}><OrderIcon name="dots"/>{/* menu anchor */}</button>{menuId === order.id && <><button className="sales-menu-dismiss" aria-label="Cerrar menú" onClick={() => setMenuId(null)}/><div className="sales-menu" style={{ top: menuPosition.top, left: menuPosition.left }}><button onClick={() => { setEditingOrder(order); setMenuId(null); }}>Editar pedido</button><button onClick={() => { setHistoryOrder(order); setMenuId(null); }}>Historial de pagos</button>{balance > 0 && <><button onClick={() => { setPaymentOrder(order); setMenuId(null); }}>Registrar abono</button><button onClick={() => { const error = onPayment(order.id, balance, localDate()); if (error) { setNotice(error); window.setTimeout(() => setNotice(""), 3000); } setMenuId(null); }}>Marcar pagado</button></>}<button className="sales-menu-delete" onClick={() => { setDeleteOrder(order); setMenuId(null); }}>Eliminar pedido</button></div></>}</td></tr>;
      })}</tbody></table></div> : <div className="external-orders-empty"><span className="external-empty-icon"><OrderIcon name="box" size={22}/></span><strong>{orders.length ? "No encontramos pedidos" : "Todavía no hay pedidos externos"}</strong><span>{orders.length ? "Cambia los filtros o prueba otra búsqueda." : "Registra un pedido para llevar el control de la compra al proveedor y del pago del cliente."}</span><button className="empty-action" onClick={onNewOrder}><OrderIcon name="plus" size={15}/> Registrar pedido</button></div>}
      <div className="external-order-footer"><span>Mostrando {filtered.length} de {orders.length} pedidos</span><span><i/> Pedidos separados del inventario tradicional</span></div>
    </section>
    <section className="panel external-client-panel"><div className="external-orders-heading"><div><h2>Cartera por cliente</h2><p>Saldo pendiente de los pedidos sin inventario.</p></div><strong className="external-client-total">{formatCOP(receivable)}</strong></div>{clientBalances.length ? <div className="client-balance-list">{clientBalances.map((client) => <div className="client-balance-row" key={client.name.toLocaleLowerCase("es-CO")}><span className="client-avatar">{client.name.trim().slice(0,1).toLocaleUpperCase("es-CO")}</span><span className="client-balance-name"><strong>{client.name}</strong><small>{client.count} {client.count === 1 ? "pedido pendiente" : "pedidos pendientes"}</small></span><strong className="client-balance-amount">{formatCOP(client.balance)}</strong></div>)}</div> : <div className="client-balance-empty">No hay saldos pendientes por cobrar.</div>}</section>
    {notice && <div className="toast" role="status"><span>!</span>{notice}</div>}
    {(activeEditing || requestedEditOrder) && <ExternalOrderModal key={activeEditing?.id ?? "edit-order"} order={activeEditing} onClose={() => { setEditingOrder(null); if (requestedEditOrder) onRequestedEditHandled(); }} onSave={saveOrder}/>}
    {paymentOrder && <OrderPaymentModal order={paymentOrder} onClose={() => setPaymentOrder(null)} onSave={savePayment}/>}
    {historyOrder && <OrderHistoryModal order={historyOrder} onClose={() => setHistoryOrder(null)}/>}
    {deleteOrder && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteOrder(null); }}><section className="movement-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-order-title"><div className="modal-header"><div><span className="eyebrow">CONFIRMAR ACCIÓN</span><h2 id="delete-order-title">Eliminar pedido externo</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => setDeleteOrder(null)}><OrderIcon name="close"/></button></div><p className="delete-copy">¿Seguro que deseas eliminar el pedido de <strong>{deleteOrder.productName}</strong> para <strong>{deleteOrder.clientName}</strong>? Se revertirán el costo pagado al proveedor, los pagos del cliente, la cartera y la ganancia. Este pedido no afecta el inventario tradicional.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleteOrder(null)}>Cancelar</button><button className="button delete-confirm" onClick={() => { onDelete(deleteOrder.id); setDeleteOrder(null); }}>Eliminar pedido</button></div></section></div>}
  </>;
}

function OrderStat({ title, value, note, tone }: { title: string; value: string; note: string; tone: string }) {
  return <div className="section-stat order-stat"><span className={`section-stat-icon order-stat-icon ${tone}`}><OrderIcon name={tone === "green" ? "cash" : "box"} size={17}/></span><span>{title}</span><strong>{value}</strong><small>{note}</small></div>;
}

export function ExternalOrderModal({ order, onClose, onSave }: { order: ExternalOrderRecord | null; onClose: () => void; onSave: (draft: ExternalOrderDraft) => string | null }) {
  const [clientName, setClientName] = useState(order?.clientName ?? "");
  const [productName, setProductName] = useState(order?.productName ?? "");
  const [supplier, setSupplier] = useState(order?.supplier ?? "");
  const [quantity, setQuantity] = useState(order?.quantity ?? 1);
  const [unitCost, setUnitCost] = useState(order?.unitCost ?? 0);
  const [unitPrice, setUnitPrice] = useState(order?.unitPrice ?? 0);
  const [date, setDate] = useState(order?.date ?? localDate());
  const [orderStatus, setOrderStatus] = useState<ExternalOrderStatus>(order?.orderStatus ?? "Pendiente");
  const [supplierPaid, setSupplierPaid] = useState(order?.supplierPaid ?? false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order ? paymentState(order) : "Pagado");
  const [initialPayment, setInitialPayment] = useState(0);
  const [error, setError] = useState("");
  const total = quantity * unitPrice;
  const totalCost = quantity * unitCost;
  const received = order ? paidAmount(order) : paymentStatus === "Pagado" ? total : paymentStatus === "Fiado" ? 0 : initialPayment;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientName.trim()) return setError("Escribe el nombre del cliente.");
    if (!productName.trim()) return setError("Escribe el nombre del producto.");
    if (!supplier.trim()) return setError("Escribe el proveedor o la bodega.");
    if (!Number.isInteger(quantity) || quantity < 1) return setError("La cantidad debe ser un número entero mayor que cero.");
    if (!Number.isFinite(unitCost) || unitCost <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) return setError("El costo y el precio de venta deben ser mayores que cero.");
    if (!date) return setError("Selecciona la fecha del pedido.");
    if (!order && paymentStatus === "Abono parcial" && (initialPayment <= 0 || initialPayment >= total)) return setError("El abono inicial debe ser mayor que cero y menor que el total de la venta.");
    if (order && received > total) return setError(`El total no puede ser menor que los pagos recibidos (${formatCOP(received)}).`);
    const result = onSave({ clientName: clientName.trim(), productName: productName.trim(), supplier: supplier.trim(), quantity, unitCost, unitPrice, date, orderStatus, supplierPaid, initialPayment: received });
    if (result) setError(result);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal external-order-modal" role="dialog" aria-modal="true" aria-labelledby="external-order-title"><div className="modal-header"><div><span className="eyebrow">{order ? "ACTUALIZA EL PEDIDO" : "PEDIDO A PROVEEDOR"}</span><h2 id="external-order-title">{order ? "Editar pedido sin inventario" : "Nuevo pedido sin inventario"}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><OrderIcon name="close"/></button></div><form onSubmit={submit}>
    <label>Nombre del cliente<input autoFocus value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ej. María Rodríguez" maxLength={100}/></label>
    <div className="form-two"><label>Nombre del producto<input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Ej. Cargador USB-C" maxLength={100}/></label><label>Proveedor o bodega<input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Nombre del proveedor" maxLength={100}/></label></div>
    <div className="form-two"><label>Cantidad<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value === "" ? 0 : Number(event.target.value))}/></label><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label></div>
    <div className="form-two"><label>Costo unitario de compra<input type="number" inputMode="numeric" min="1" step="1" value={unitCost || ""} onChange={(event) => setUnitCost(Number(event.target.value))} placeholder="0"/></label><label>Precio unitario de venta<input type="number" inputMode="numeric" min="1" step="1" value={unitPrice || ""} onChange={(event) => setUnitPrice(Number(event.target.value))} placeholder="0"/></label></div>
    <div className="external-order-financial-preview"><span>Costo total del pedido</span><strong>{formatCOP(totalCost)}</strong><span>Total de venta</span><strong>{formatCOP(total)}</strong><span>Ganancia estimada</span><strong className={total-totalCost >= 0 ? "received-cell" : "balance-cell"}>{formatCOP(total-totalCost)}</strong></div>
    <div className="form-two"><label>Estado del pedido<select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value as ExternalOrderStatus)}><option>Pendiente</option><option>Comprado</option><option>Entregado</option></select></label><label>Pago al proveedor<select value={supplierPaid ? "Pagado" : "Pendiente de pago"} onChange={(event) => setSupplierPaid(event.target.value === "Pagado")}><option>Pagado</option><option>Pendiente de pago</option></select></label></div>
    <div className="external-order-helper">{supplierPaid ? <span>El costo queda comprometido al registrar el pedido. Marcarlo pagado no vuelve a descontarlo.</span> : <span>El costo queda comprometido desde ahora y el proveedor permanece como obligación pendiente.</span>}</div>
    {!order && <label>Estado del pago del cliente<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}><option>Pagado</option><option>Fiado</option><option>Abono parcial</option></select></label>}
    {!order && paymentStatus === "Abono parcial" && <label>Abono recibido ahora<input type="number" min="1" max={Math.max(0,total-1)} step="1" inputMode="numeric" value={initialPayment || ""} onChange={(event) => setInitialPayment(Number(event.target.value))} placeholder="Valor del abono"/></label>}
    {order && <div className="sale-edit-note">Los pagos del cliente se conservan. El total de venta debe cubrir el dinero ya recibido.</div>}
    {error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">{order ? "Guardar cambios" : "Registrar pedido"}</button></div>
    </form></section></div>;
}

export function OrderPaymentModal({ order, onClose, onSave }: { order: ExternalOrderRecord; onClose: () => void; onSave: (amount: number, date: string) => string | null }) {
  const balance = orderBalance(order);
  const [amount, setAmount] = useState(balance);
  const [date, setDate] = useState(localDate());
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return setError("Selecciona la fecha del pago.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return setError(`Ingresa un valor entre $1 y ${formatCOP(balance)}.`);
    const result = onSave(amount, date);
    if (result) setError(result);
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="order-payment-title"><div className="modal-header"><div><span className="eyebrow">CUENTA POR COBRAR</span><h2 id="order-payment-title">Registrar abono</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><OrderIcon name="close"/></button></div><form onSubmit={submit}><div className="payment-balance-box"><span>{order.clientName} · {order.productName}</span><small>Saldo pendiente</small><strong>{formatCOP(balance)}</strong></div><label>Valor recibido<input autoFocus type="number" min="1" max={balance} step="1" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))}/></label><label>Fecha del pago<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">Guardar pago</button></div></form></section></div>;
}

function OrderHistoryModal({ order, onClose }: { order: ExternalOrderRecord; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal order-history-modal" role="dialog" aria-modal="true" aria-labelledby="order-history-title"><div className="modal-header"><div><span className="eyebrow">HISTORIAL DEL CLIENTE</span><h2 id="order-history-title">Abonos de {order.clientName}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><OrderIcon name="close"/></button></div><div className="order-history-product">{order.productName} · Saldo actual <strong>{formatCOP(orderBalance(order))}</strong></div>{order.payments.length ? <div className="order-payment-history">{[...order.payments].sort((a,b) => b.date.localeCompare(a.date)).map((payment) => <div key={payment.id}><span><OrderIcon name="cash" size={16}/><span><strong>Pago recibido</strong><small>{formatDate(payment.date)}</small></span></span><strong>{formatCOP(payment.amount)}</strong></div>)}</div> : <div className="client-balance-empty">Este pedido aún no tiene abonos registrados.</div>}<div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Cerrar</button></div></section></div>;
}
