"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateFinance, DEFAULT_INVENTORY_CATEGORIES, EMPTY_BUSINESS_DATA, formatCOP, normalizeBusinessData, type BusinessData, type DebtRecord, type ExternalOrderRecord, type InventoryProduct, type Movement, type SalePayment, type SaleRecord } from "@/lib/finance";
import InventoryModule from "@/components/inventory-module";
import SalesModule, { type SaleDraft } from "@/components/sales-module";
import type { ExternalOrderDraft } from "@/components/external-orders-module";
import DebtsModule, { type DebtDraft } from "@/components/debts-module";

const sections = [
  { label: "Inicio", icon: "grid" },
  { label: "Inventario", icon: "box" },
  { label: "Ventas", icon: "cart" },
  { label: "Préstamos", icon: "hand" },
  { label: "Deudas", icon: "card" },
  { label: "Movimientos", icon: "arrows" },
  { label: "Reportes", icon: "chart" },
  { label: "Configuración", icon: "settings" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9"/></>,
    cart: <><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="19" r="1"/><circle cx="18" cy="19" r="1"/></>,
    hand: <><path d="M8 11V5a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6.5 7h-1c-2.5 0-4-1-5.5-3l-3-4a1.7 1.7 0 0 1 2.7-2L8 14"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
    arrows: <><path d="M7 7h13l-3-3M17 17H4l3 3"/><path d="m17 4 3 3-3 3M7 14l-3 3 3 3"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    trend: <><path d="m4 15 6-6 4 4 6-7"/><path d="M14 6h6v6"/></>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function movementRelatedCount(movement: Movement, data: BusinessData): number {
  if (movement.debtId) return data.debts.find((debt) => debt.id === movement.debtId)?.payments.length ?? 0;
  if (movement.productId) return data.sales.filter((sale) => sale.productId === movement.productId).length;
  if (movement.orderId) return data.externalOrders.find((order) => order.id === movement.orderId)?.payments.length ?? 0;
  if (movement.type === "Préstamo") return data.movements.filter((item) => item.loanId === (movement.loanId ?? movement.id) && item.id !== movement.id).length;
  if (movement.saleId && !movement.paymentId) return data.sales.find((sale) => sale.id === movement.saleId)?.payments.length ?? 0;
  return 0;
}

const navDescriptions: Record<string, string> = {
  Inventario: "Administra tus productos, existencias y costos de compra.",
  Ventas: "Registra ventas y conoce la ganancia real de cada producto.",
  Préstamos: "Lleva el control del dinero prestado y los pagos recibidos.",
  Deudas: "Consulta tus obligaciones y fechas de pago.",
  Movimientos: "Revisa cada ingreso, gasto, compra, venta y préstamo.",
  Reportes: "Entiende cómo evoluciona tu capital y la rentabilidad del negocio.",
  Configuración: "Personaliza los datos generales de tu negocio.",
};

const monthLabels = ["May", "Jun", "Jul", "Ago", "Sep", "Oct"];

export default function DashboardShell() {
  const [section, setSection] = useState("Inicio");
  const [businessData, setBusinessData] = useState<BusinessData>(EMPTY_BUSINESS_DATA);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [movementToEdit, setMovementToEdit] = useState<Movement | null>(null);
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null);
  const [movementDeleteError, setMovementDeleteError] = useState("");
  const [requestedSaleEditId, setRequestedSaleEditId] = useState<string | null>(null);
  const [requestedOrderEditId, setRequestedOrderEditId] = useState<string | null>(null);
  const [requestedDebtEditId, setRequestedDebtEditId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState("");
  const [notice, setNotice] = useState("");
  const [resetSection, setResetSection] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("control-negocio:v1");
        if (stored) setBusinessData(normalizeBusinessData(JSON.parse(stored) as Partial<BusinessData>));
      } catch { /* Ignore invalid or unavailable local data and keep the clean start. */ }
      setCurrentDate(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem("control-negocio:v1", JSON.stringify(businessData)); } catch { /* Keep the current session usable if storage is full. */ }
  }, [businessData, ready]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const finance = useMemo(() => calculateFinance(businessData), [businessData]);
  const transactions = [...businessData.movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const activeLoans = useMemo(() => businessData.movements.filter((movement) => movement.type === "Préstamo").map((loan) => {
    const loanId = loan.loanId ?? loan.id;
    const paid = businessData.movements.filter((movement) => movement.type === "Ingreso" && movement.loanId === loanId).reduce((sum, movement) => sum + movement.amount, 0);
    return { id: loanId, description: loan.description, balance: Math.max(0, loan.amount - paid) };
  }).filter((loan) => loan.balance > 0), [businessData.movements]);
  const requestedSaleEdit = requestedSaleEditId ? businessData.sales.find((sale) => sale.id === requestedSaleEditId) ?? null : null;
  const requestedOrderEdit = requestedOrderEditId ? businessData.externalOrders.find((order) => order.id === requestedOrderEditId) ?? null : null;
  const requestedDebtEdit = requestedDebtEditId ? businessData.debts.find((debt) => debt.id === requestedDebtEditId) ?? null : null;

  function navigate(label: string) {
    setSection(label);
    setMobileOpen(false);
  }

  function clearSectionData(target: string) {
    setBusinessData((current) => {
      if (target === "Inventario") {
        const productIds = new Set(current.products.map((product) => product.id));
        const removedSaleIds = new Set(current.sales.filter((sale) => productIds.has(sale.productId)).map((sale) => sale.id));
        return {
          ...current,
          products: [],
          inventoryCost: 0,
          inventoryCategories: [...DEFAULT_INVENTORY_CATEGORIES],
          sales: current.sales.filter((sale) => !removedSaleIds.has(sale.id)),
          movements: current.movements.filter((movement) => !productIds.has(movement.productId ?? "") && !removedSaleIds.has(movement.saleId ?? "")),
        };
      }
      if (target === "Ventas") {
        const restoredByProduct = new Map<string, number>();
        for (const sale of current.sales) {
          if (!sale.productId.startsWith("migrated-receivable:")) restoredByProduct.set(sale.productId, (restoredByProduct.get(sale.productId) ?? 0) + sale.quantity);
        }
        return {
          ...current,
          sales: [],
          externalOrders: [],
          products: current.products.map((product) => restoredByProduct.has(product.id) ? { ...product, quantityAvailable: product.quantityAvailable + (restoredByProduct.get(product.id) ?? 0) } : product),
          inventoryCost: current.inventoryCost + current.sales.reduce((total, sale) => total + (sale.productId.startsWith("migrated-receivable:") ? 0 : sale.quantity * sale.unitCost), 0),
          movements: current.movements.filter((movement) => !movement.saleId && !movement.orderId && !(movement.type === "Venta" && !movement.saleId && !movement.orderId)),
        };
      }
      if (target === "Préstamos") {
        const loanIds = new Set(current.movements.filter((movement) => movement.type === "Préstamo").map((movement) => movement.loanId ?? movement.id));
        return { ...current, loansReceivable: 0, movements: current.movements.filter((movement) => movement.type !== "Préstamo" && !loanIds.has(movement.loanId ?? "")) };
      }
      if (target === "Deudas") {
        const debtIds = new Set(current.debts.map((debt) => debt.id));
        return { ...current, debts: [], movements: current.movements.filter((movement) => !debtIds.has(movement.debtId ?? "")) };
      }
      return { ...EMPTY_BUSINESS_DATA, inventoryCategories: [...DEFAULT_INVENTORY_CATEGORIES] };
    });
    setResetSection(null);
    setNotice(target === "Movimientos" ? "Secciones y movimientos reiniciados. El capital guía sigue en $5.000.000." : `Registros de ${target} eliminados y valores relacionados actualizados.`);
  }

  function addMovement(movement: Omit<Movement, "id">): string | null {
    if (movement.type === "Venta") {
      setNotice("Registra las ventas desde el módulo Ventas para actualizar inventario y cartera.");
      return "Registra las ventas desde el módulo Ventas para actualizar inventario y cartera.";
    }
    if (movement.loanId) {
      const loan = businessData.movements.find((item) => item.type === "Préstamo" && (item.loanId ?? item.id) === movement.loanId);
      const paid = businessData.movements.filter((item) => item.type === "Ingreso" && item.loanId === movement.loanId).reduce((sum, item) => sum + item.amount, 0);
      const balance = loan ? loan.amount - paid : 0;
      if (!loan || movement.amount <= 0 || movement.amount > balance) return `El abono debe ser mayor que cero y no superar el saldo de ${formatCOP(Math.max(0, balance))}.`;
    }
    const id = crypto.randomUUID();
    const newMovement = { ...movement, id, ...(movement.type === "Préstamo" ? { loanId: id } : {}) };
    setBusinessData((current) => {
      const next = { ...current, movements: [newMovement, ...current.movements] };
      if (newMovement.type === "Compra" && newMovement.status === "Completado") next.inventoryCost += newMovement.amount;
      if (newMovement.type === "Préstamo") next.loansReceivable += newMovement.amount;
      if (newMovement.type === "Ingreso" && newMovement.loanId) next.loansReceivable = Math.max(0, next.loansReceivable - newMovement.amount);
      return next;
    });
    setShowNewMovement(false);
    setNotice("Movimiento guardado correctamente");
    return null;
  }

  function saveDebt(draft: DebtDraft, id?: string): string | null {
    const current = businessData;
    if (draft.kind !== "Préstamo recibido") return "El módulo Deudas solo registra préstamos recibidos de terceros.";
    const existing = id ? current.debts.find((debt) => debt.id === id) : undefined;
    const debtId = existing?.id ?? crypto.randomUUID();
    const payments = existing?.payments ?? [];
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (!draft.creditor.trim() || !draft.concept.trim() || !Number.isFinite(draft.amount) || draft.amount <= 0) return "Completa el acreedor, el concepto y un valor válido.";
    if (draft.amount < paid) return `El total no puede ser menor que los abonos realizados (${formatCOP(paid)}).`;
    const debt: DebtRecord = { ...draft, id: debtId, payments };
    const baseMovement = current.movements.find((movement) => movement.debtId === debtId && !movement.paymentId);
    const movement: Movement = {
      id: baseMovement?.id ?? crypto.randomUUID(),
      type: draft.kind === "Préstamo recibido" ? "Ingreso" : "Gasto",
      debtId,
      description: draft.kind === "Préstamo recibido" ? `Préstamo recibido de ${draft.creditor}: ${draft.concept}` : `Obligación: ${draft.creditor} · ${draft.concept}`,
      date: draft.date,
      amount: draft.amount,
      status: draft.kind === "Préstamo recibido" || paid >= draft.amount ? "Completado" : "Pendiente",
    };
    setBusinessData({
      ...current,
      debts: existing ? current.debts.map((item) => item.id === debtId ? debt : item) : [debt, ...current.debts],
      movements: [movement, ...current.movements.filter((item) => item.id !== baseMovement?.id)],
    });
    setNotice(existing ? "Deuda actualizada y movimientos sincronizados." : "Deuda registrada correctamente.");
    return null;
  }

  function payDebt(debtId: string, amount: number, date: string): string | null {
    const current = businessData;
    const debt = current.debts.find((item) => item.id === debtId);
    if (!debt) return "No encontramos esta deuda.";
    const paid = debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(0, debt.amount - paid);
    const available = calculateFinance(current).availableCapital;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return `El abono no puede superar el saldo de ${formatCOP(balance)}.`;
    if (amount > available) return `El capital disponible es ${formatCOP(available)}; registra solo un pago efectivamente realizado.`;
    const payment: SalePayment = { id: crypto.randomUUID(), amount, date };
    const payments = [...debt.payments, payment];
    setBusinessData({
      ...current,
      debts: current.debts.map((item) => item.id === debtId ? { ...item, payments } : item),
      movements: [{ id: crypto.randomUUID(), type: "Gasto", debtId, paymentId: payment.id, description: `Abono de deuda a ${debt.creditor}`, date, amount, status: "Completado" }, ...current.movements.map((movement) => movement.debtId === debtId && !movement.paymentId ? { ...movement, status: payments.reduce((sum, item) => sum + item.amount, 0) >= debt.amount ? "Completado" as const : "Pendiente" as const } : movement)],
    });
    return null;
  }

  function deleteDebt(debtId: string) {
    const current = businessData;
    setBusinessData({ ...current, debts: current.debts.filter((debt) => debt.id !== debtId), movements: current.movements.filter((movement) => movement.debtId !== debtId) });
    setNotice("Deuda eliminada y movimientos relacionados actualizados.");
  }

  function addInventoryProduct(product: Omit<InventoryProduct, "id">) {
    const totalCost = product.quantityPurchased * product.unitCost;
    const newProduct = { ...product, id: crypto.randomUUID() };
    const purchase: Movement = {
      id: crypto.randomUUID(), type: "Compra", description: `Compra de inventario: ${product.name}`,
      date: product.purchaseDate, amount: totalCost, status: "Completado", productId: newProduct.id,
    };
    setBusinessData((current) => ({
      ...current,
      products: [...current.products, newProduct],
      movements: [purchase, ...current.movements],
      inventoryCost: current.inventoryCost + product.quantityAvailable * product.unitCost,
    }));
    setNotice("Producto y compra registrados correctamente");
  }

  function updateInventoryProduct(id: string, product: Omit<InventoryProduct, "id">) {
    setBusinessData((current) => {
      const existing = current.products.find((item) => item.id === id);
      if (!existing) return current;
      const previousValue = existing.quantityAvailable * existing.unitCost;
      const updatedValue = product.quantityAvailable * product.unitCost;
      const purchaseAmount = product.quantityPurchased * product.unitCost;
      return {
        ...current,
        products: current.products.map((item) => item.id === id ? { ...product, id } : item),
        inventoryCost: Math.max(0, current.inventoryCost + updatedValue - previousValue),
        movements: current.movements.map((movement) => movement.productId === id ? { ...movement, amount: purchaseAmount, date: product.purchaseDate, description: `Compra de inventario: ${product.name}` } : movement),
      };
    });
    setNotice("Producto actualizado correctamente");
  }

  function deleteInventoryProduct(id: string) {
    setBusinessData((current) => {
      const removed = current.products.find((item) => item.id === id);
      if (!removed) return current;
      return {
        ...current,
        products: current.products.filter((item) => item.id !== id),
        inventoryCost: Math.max(0, current.inventoryCost - removed.quantityAvailable * removed.unitCost),
      };
    });
  }

  function updateInventoryCategories(categories: string[]) {
    setBusinessData((current) => ({ ...current, inventoryCategories: categories }));
  }

  function saveSale(draft: SaleDraft, id?: string): string | null {
    const current = businessData;
    const existing = id ? current.sales.find((sale) => sale.id === id) : undefined;
    if (existing?.productId.startsWith("migrated-receivable:") && draft.productId === existing.productId) {
      const total = draft.quantity * draft.unitPrice;
      const received = existing.payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (draft.quantity < 1 || !Number.isInteger(draft.quantity) || !Number.isFinite(draft.unitPrice) || draft.unitPrice <= 0) return "Completa una cantidad y un precio válidos.";
      if (received > total) return `El total no puede ser inferior a los pagos recibidos (${formatCOP(received)}).`;
      const sale: SaleRecord = { ...existing, clientName: draft.clientName, quantity: draft.quantity, unitPrice: draft.unitPrice, date: draft.date };
      const marker = current.movements.find((movement) => movement.saleId === sale.id && !movement.paymentId);
      setBusinessData({
        ...current,
        sales: current.sales.map((item) => item.id === sale.id ? sale : item),
        movements: marker ? current.movements.map((movement) => movement.id === marker.id ? { ...movement, description: `Venta fiada: ${sale.productName}`, date: sale.date, amount: total, cost: sale.quantity * sale.unitCost, status: received >= total ? "Completado" : "Pendiente" } : movement) : current.movements,
      });
      return null;
    }
    const currentProduct = current.products.find((product) => product.id === draft.productId);
    if (!currentProduct) return "El producto ya no está disponible en el inventario.";
    const existingProduct = existing ? current.products.find((product) => product.id === existing.productId) : undefined;
    if (existing && !existingProduct) return "No se encontró el producto original; no se puede ajustar esta venta.";
    const availableAfterRestore = currentProduct.quantityAvailable + (existing?.productId === currentProduct.id ? existing.quantity : 0);
    if (draft.quantity > availableAfterRestore) return `Solo hay ${availableAfterRestore} unidades disponibles para esta venta.`;
    const total = draft.quantity * draft.unitPrice;
    const received = existing?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? draft.initialPayment;
    if (received > total) return `El total de la venta no puede ser inferior a los pagos recibidos (${formatCOP(received)}).`;

    const saleId = existing?.id ?? crypto.randomUUID();
    const saleMovementId = current.movements.find((movement) => movement.saleId === saleId && !movement.paymentId)?.id ?? crypto.randomUUID();
    const payments: SalePayment[] = existing?.payments ?? (draft.initialPayment > 0 ? [{ id: crypto.randomUUID(), amount: draft.initialPayment, date: draft.date }] : []);
    const sale: SaleRecord = {
      id: saleId, clientName: draft.clientName, productId: draft.productId,
      productName: currentProduct.name, quantity: draft.quantity, unitPrice: draft.unitPrice,
      unitCost: currentProduct.unitCost, date: draft.date, payments,
    };
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const saleMovement: Movement = {
      id: saleMovementId, type: "Venta", saleId, description: `Venta: ${sale.productName}`,
      date: sale.date, amount: sale.quantity * sale.unitPrice,
      cost: sale.quantity * sale.unitCost, status: paid >= sale.quantity * sale.unitPrice ? "Completado" : "Pendiente",
    };
    const stockChanges = new Map<string, number>();
    if (existing) stockChanges.set(existing.productId, (stockChanges.get(existing.productId) ?? 0) + existing.quantity);
    stockChanges.set(sale.productId, (stockChanges.get(sale.productId) ?? 0) - sale.quantity);
    const products = current.products.map((product) => {
      const change = stockChanges.get(product.id) ?? 0;
      return change ? { ...product, quantityAvailable: product.quantityAvailable + change } : product;
    });
    const restoredValue = existing ? existing.quantity * existingProduct!.unitCost : 0;
    const soldValue = sale.quantity * currentProduct.unitCost;
    let movements = current.movements.some((movement) => movement.id === saleMovementId)
      ? current.movements.map((movement) => movement.id === saleMovementId ? saleMovement : movement.saleId === saleId && movement.paymentId ? { ...movement, description: `Pago de venta de ${sale.clientName}` } : movement)
      : [saleMovement, ...current.movements];
    if (!existing && draft.initialPayment > 0) {
      const initialPayment = payments[0];
      movements = [{
        id: crypto.randomUUID(), type: "Ingreso", saleId, paymentId: initialPayment.id,
        description: `${initialPayment.amount < total ? "Abono" : "Pago de venta"} de ${draft.clientName}`,
        date: initialPayment.date, amount: initialPayment.amount, status: "Completado",
      }, ...movements];
    }
    setBusinessData({
      ...current,
      sales: existing ? current.sales.map((item) => item.id === saleId ? sale : item) : [sale, ...current.sales],
      products,
      inventoryCost: Math.max(0, current.inventoryCost + restoredValue - soldValue),
      movements,
    });
    return null;
  }

  function addSalePayment(saleId: string, amount: number, date: string): string | null {
    const current = businessData;
    const sale = current.sales.find((item) => item.id === saleId);
    if (!sale) return "No encontramos esta venta.";
    const received = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = sale.quantity * sale.unitPrice - received;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return `El pago debe ser mayor que cero y no superar el saldo de ${formatCOP(balance)}.`;
    const payment: SalePayment = { id: crypto.randomUUID(), amount, date };
    const payments = [...sale.payments, payment];
    const newReceived = received + amount;
    setBusinessData({
      ...current,
      sales: current.sales.map((item) => item.id === saleId ? { ...item, payments } : item),
      movements: current.movements.map((movement) => movement.saleId === saleId && !movement.paymentId
        ? { ...movement, status: newReceived >= sale.quantity * sale.unitPrice ? "Completado" as const : "Pendiente" as const }
        : movement).concat({
        id: crypto.randomUUID(), type: "Ingreso", saleId, paymentId: payment.id,
        description: `${newReceived >= sale.quantity * sale.unitPrice ? "Pago de venta" : "Abono"} de ${sale.clientName}`,
        date, amount, status: "Completado",
      }),
    });
    return null;
  }

  function deleteSale(saleId: string) {
    const current = businessData;
    const sale = current.sales.find((item) => item.id === saleId);
    if (!sale) return;
    const product = current.products.find((item) => item.id === sale.productId);
    setBusinessData({
      ...current,
      sales: current.sales.filter((item) => item.id !== saleId),
      products: product ? current.products.map((item) => item.id === sale.productId ? { ...item, quantityAvailable: item.quantityAvailable + sale.quantity } : item) : current.products,
      inventoryCost: current.inventoryCost + (product ? sale.quantity * product.unitCost : 0),
      movements: current.movements.filter((movement) => movement.saleId !== saleId),
    });
  }

  function saveExternalOrder(draft: ExternalOrderDraft, id?: string): string | null {
    const current = businessData;
    const existing = id ? current.externalOrders.find((order) => order.id === id) : undefined;
    const orderId = existing?.id ?? crypto.randomUUID();
    const existingPayments = existing?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
    const received = existing ? existingPayments : draft.initialPayment;
    const total = draft.quantity * draft.unitPrice;
    if (received > total) return `El total de venta no puede ser inferior a los pagos recibidos (${formatCOP(received)}).`;
    const previousCommittedCost = existing ? existing.quantity * existing.unitCost : 0;
    const nextCommittedCost = draft.quantity * draft.unitCost;
    const additionalCommitment = nextCommittedCost - previousCommittedCost;
    if (additionalCommitment > calculateFinance(current).availableCapital) return `El costo comprometido supera el capital disponible (${formatCOP(calculateFinance(current).availableCapital)}).`;
    const payments: SalePayment[] = existing?.payments ?? (draft.initialPayment > 0 ? [{ id: crypto.randomUUID(), amount: draft.initialPayment, date: draft.date }] : []);
    const order: ExternalOrderRecord = {
      id: orderId, clientName: draft.clientName, productName: draft.productName, supplier: draft.supplier,
      quantity: draft.quantity, unitCost: draft.unitCost, unitPrice: draft.unitPrice, date: draft.date,
      orderStatus: draft.orderStatus, supplierPaid: draft.supplierPaid, payments,
    };
    const saleMovementId = current.movements.find((movement) => movement.orderId === orderId && movement.type === "Venta")?.id ?? crypto.randomUUID();
    const purchaseMovementId = current.movements.find((movement) => movement.orderId === orderId && movement.type === "Compra")?.id ?? crypto.randomUUID();
    const saleMovement: Movement = {
      id: saleMovementId, type: "Venta", orderId, description: `Pedido externo: ${order.productName}`,
      date: order.date, amount: total, cost: order.quantity * order.unitCost,
      status: received >= total ? "Completado" : "Pendiente",
    };
    const purchaseMovement: Movement = {
      id: purchaseMovementId, type: "Compra", orderId, description: `${order.supplierPaid ? "Compra externa pagada" : "Capital comprometido · proveedor pendiente"}: ${order.productName} · ${order.supplier}`,
      date: order.date, amount: order.quantity * order.unitCost, status: order.supplierPaid ? "Completado" : "Pendiente",
    };
    let movements = current.movements.filter((movement) => movement.orderId !== orderId);
    const previousOrderMovements = current.movements.filter((movement) => movement.orderId === orderId);
    const paymentMovements = previousOrderMovements.filter((movement) => movement.paymentId).map((movement) => ({
      ...movement,
      description: `Pago de pedido de ${order.clientName}`,
    }));
    if (!existing && draft.initialPayment > 0) {
      const payment = payments[0];
      paymentMovements.push({
        id: crypto.randomUUID(), type: "Ingreso", orderId, paymentId: payment.id,
        description: `${payment.amount < total ? "Abono" : "Pago de pedido"} de ${order.clientName}`,
        date: payment.date, amount: payment.amount, status: "Completado",
      });
    }
    movements = [saleMovement, purchaseMovement, ...paymentMovements, ...movements];
    setBusinessData({
      ...current,
      externalOrders: existing ? current.externalOrders.map((item) => item.id === orderId ? order : item) : [order, ...current.externalOrders],
      movements,
    });
    setNotice(existing ? "Pedido externo actualizado." : "Pedido externo registrado.");
    return null;
  }

  function addExternalOrderPayment(orderId: string, amount: number, date: string): string | null {
    const current = businessData;
    const order = current.externalOrders.find((item) => item.id === orderId);
    if (!order) return "No encontramos este pedido.";
    const received = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = order.quantity * order.unitPrice - received;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return `El abono debe ser mayor que cero y no superar el saldo de ${formatCOP(balance)}.`;
    const payment: SalePayment = { id: crypto.randomUUID(), amount, date };
    const payments = [...order.payments, payment];
    const newReceived = received + amount;
    setBusinessData({
      ...current,
      externalOrders: current.externalOrders.map((item) => item.id === orderId ? { ...item, payments } : item),
      movements: current.movements.map((movement) => movement.orderId === orderId && movement.type === "Venta"
        ? { ...movement, status: newReceived >= order.quantity * order.unitPrice ? "Completado" as const : "Pendiente" as const }
        : movement).concat({
        id: crypto.randomUUID(), type: "Ingreso", orderId, paymentId: payment.id,
        description: `${newReceived >= order.quantity * order.unitPrice ? "Pago de pedido" : "Abono"} de ${order.clientName}`,
        date, amount, status: "Completado",
      }),
    });
    return null;
  }

  function deleteExternalOrder(orderId: string) {
    const current = businessData;
    setBusinessData({
      ...current,
      externalOrders: current.externalOrders.filter((order) => order.id !== orderId),
      movements: current.movements.filter((movement) => movement.orderId !== orderId),
    });
  }

  function openMovementEditor(movement: Movement) {
    if (movement.debtId && !movement.paymentId && businessData.debts.some((debt) => debt.id === movement.debtId && debt.kind === "Préstamo recibido")) {
      setRequestedDebtEditId(movement.debtId);
      setSection("Deudas");
      setMobileOpen(false);
      return;
    }
    if (movement.orderId && !movement.paymentId && businessData.externalOrders.some((order) => order.id === movement.orderId)) {
      setRequestedOrderEditId(movement.orderId);
      setSection("Ventas");
      setMobileOpen(false);
      return;
    }
    if (movement.saleId && !movement.paymentId && businessData.sales.some((sale) => sale.id === movement.saleId)) {
      setRequestedSaleEditId(movement.saleId);
      setSection("Ventas");
      setMobileOpen(false);
      return;
    }
    setMovementToEdit(movement);
  }

  function saveMovementEdit(updated: Pick<Movement, "description" | "date" | "amount" | "status">): string | null {
    const current = businessData;
    const original = current.movements.find((movement) => movement.id === movementToEdit?.id);
    if (!original) return "No encontramos este movimiento.";
    if (!Number.isFinite(updated.amount) || updated.amount <= 0 || !updated.description.trim() || !updated.date) return "Completa una descripción, una fecha y un valor válido.";

    if (original.debtId && original.paymentId) {
      const debt = current.debts.find((item) => item.id === original.debtId);
      if (!debt) return "La deuda asociada ya no existe.";
      const payment = debt.payments.find((item) => item.id === original.paymentId);
      if (!payment) return "El abono asociado ya no existe.";
      const otherPaid = debt.payments.filter((item) => item.id !== payment.id).reduce((sum, item) => sum + item.amount, 0);
      if (otherPaid + updated.amount > debt.amount) return `El total de abonos no puede superar la deuda de ${formatCOP(debt.amount)}.`;
      const extraCashNeeded = updated.amount - payment.amount;
      if (extraCashNeeded > calculateFinance(current).availableCapital) return `El capital disponible es ${formatCOP(calculateFinance(current).availableCapital)}.`;
      const payments = debt.payments.map((item) => item.id === payment.id ? { ...item, amount: updated.amount, date: updated.date } : item);
      setBusinessData({
        ...current,
        debts: current.debts.map((item) => item.id === debt.id ? { ...item, payments } : item),
        movements: current.movements.map((item) => item.id === original.id ? { ...item, description: updated.description.trim(), date: updated.date, amount: updated.amount, status: "Completado" } : item.debtId === debt.id && !item.paymentId ? { ...item, status: payments.reduce((sum, paymentItem) => sum + paymentItem.amount, 0) >= debt.amount ? "Completado" as const : "Pendiente" as const } : item),
      });
      setMovementToEdit(null);
      return null;
    }

    if (original.orderId && original.paymentId) {
      const order = current.externalOrders.find((item) => item.id === original.orderId);
      if (!order) return "El pedido externo asociado ya no existe.";
      const payment = order.payments.find((item) => item.id === original.paymentId);
      if (!payment) return "El abono asociado ya no existe.";
      const otherPayments = order.payments.filter((item) => item.id !== payment.id).reduce((sum, item) => sum + item.amount, 0);
      if (otherPayments + updated.amount > order.quantity * order.unitPrice) return `El pago no puede superar el saldo del pedido (${formatCOP(order.quantity * order.unitPrice - otherPayments)}).`;
      const payments = order.payments.map((item) => item.id === payment.id ? { ...item, amount: updated.amount, date: updated.date } : item);
      const newPaid = payments.reduce((sum, item) => sum + item.amount, 0);
      setBusinessData({
        ...current,
        externalOrders: current.externalOrders.map((item) => item.id === order.id ? { ...item, payments } : item),
        movements: current.movements.map((item) => item.id === original.id
          ? { ...item, description: updated.description.trim(), date: updated.date, amount: updated.amount }
          : item.orderId === order.id && item.type === "Venta"
            ? { ...item, status: newPaid >= order.quantity * order.unitPrice ? "Completado" : "Pendiente" }
            : item),
      });
      setMovementToEdit(null);
      return null;
    }

    if (original.saleId && original.paymentId) {
      const sale = current.sales.find((item) => item.id === original.saleId);
      if (!sale) {
        setBusinessData({ ...current, movements: current.movements.map((item) => item.id === original.id ? { ...item, ...updated, description: updated.description.trim() } : item) });
        setMovementToEdit(null);
        return null;
      }
      const payment = sale.payments.find((item) => item.id === original.paymentId);
      if (!payment) return "El pago asociado ya no existe.";
      const otherPayments = sale.payments.filter((item) => item.id !== payment.id).reduce((sum, item) => sum + item.amount, 0);
      if (otherPayments + updated.amount > sale.quantity * sale.unitPrice) return `El pago no puede superar el saldo de ${formatCOP(sale.quantity * sale.unitPrice - otherPayments)}.`;
      const payments = sale.payments.map((item) => item.id === payment.id ? { ...item, amount: updated.amount, date: updated.date } : item);
      const newPaid = payments.reduce((sum, item) => sum + item.amount, 0);
      setBusinessData({
        ...current,
        sales: current.sales.map((item) => item.id === sale.id ? { ...item, payments } : item),
        movements: current.movements.map((item) => item.id === original.id
          ? { ...item, description: updated.description.trim(), date: updated.date, amount: updated.amount }
          : item.saleId === sale.id && !item.paymentId
            ? { ...item, status: newPaid >= sale.quantity * sale.unitPrice ? "Completado" : "Pendiente" }
            : item),
      });
      setMovementToEdit(null);
      return null;
    }

    if (original.loanId && original.type === "Ingreso") {
      const loan = current.movements.find((item) => item.type === "Préstamo" && (item.loanId ?? item.id) === original.loanId);
      const payments = current.movements.filter((item) => item.type === "Ingreso" && item.loanId === original.loanId && item.id !== original.id).reduce((sum, item) => sum + item.amount, 0);
      if (!loan || payments + updated.amount > loan.amount) return `El abono no puede superar el saldo del préstamo (${formatCOP(Math.max(0, (loan?.amount ?? 0) - payments))}).`;
      setBusinessData({
        ...current,
        loansReceivable: Math.max(0, current.loansReceivable + original.amount - updated.amount),
        movements: current.movements.map((item) => item.id === original.id ? { ...item, ...updated, description: updated.description.trim() } : item),
      });
      setMovementToEdit(null);
      return null;
    }

    if (original.type === "Préstamo") {
      const loanId = original.loanId ?? original.id;
      const paid = current.movements.filter((item) => item.type === "Ingreso" && item.loanId === loanId).reduce((sum, item) => sum + item.amount, 0);
      if (updated.amount < paid) return `El valor del préstamo no puede ser inferior a los abonos ya recibidos (${formatCOP(paid)}).`;
      setBusinessData({
        ...current,
        loansReceivable: Math.max(0, current.loansReceivable + updated.amount - original.amount),
        movements: current.movements.map((item) => item.id === original.id ? { ...item, ...updated, description: updated.description.trim() } : item),
      });
      setMovementToEdit(null);
      return null;
    }

    if (original.type === "Compra" && original.productId) {
      const product = current.products.find((item) => item.id === original.productId);
      if (product) {
        if (updated.status !== "Completado") return "Una compra que creó existencias debe permanecer completada. Ajusta las existencias desde Inventario.";
        const unitCost = updated.amount / product.quantityPurchased;
        setBusinessData({
          ...current,
          products: current.products.map((item) => item.id === product.id ? { ...item, unitCost } : item),
          inventoryCost: Math.max(0, current.inventoryCost + product.quantityAvailable * (unitCost - product.unitCost)),
          movements: current.movements.map((item) => item.id === original.id ? { ...item, ...updated, description: updated.description.trim(), productId: product.id } : item),
        });
        setMovementToEdit(null);
        return null;
      }
    }

    let inventoryCost = current.inventoryCost;
    if (original.type === "Compra") {
      const previousInventoryEffect = original.status === "Completado" ? original.amount : 0;
      const nextInventoryEffect = updated.status === "Completado" ? updated.amount : 0;
      inventoryCost = Math.max(0, inventoryCost + nextInventoryEffect - previousInventoryEffect);
    }
    setBusinessData({
      ...current,
      inventoryCost,
      movements: current.movements.map((item) => item.id === original.id ? { ...item, ...updated, description: updated.description.trim() } : item),
    });
    setMovementToEdit(null);
    return null;
  }

  function deleteMovement(id: string): string | null {
    const current = businessData;
    const movement = current.movements.find((item) => item.id === id);
    if (!movement) return "No encontramos este movimiento.";
    if (movement.debtId && movement.paymentId) {
      const debt = current.debts.find((item) => item.id === movement.debtId);
      const payments = debt?.payments.filter((payment) => payment.id !== movement.paymentId) ?? [];
      setBusinessData({
        ...current,
        debts: debt ? current.debts.map((item) => item.id === debt.id ? { ...item, payments } : item) : current.debts,
        movements: current.movements.filter((item) => item.id !== movement.id).map((item) => debt && item.debtId === debt.id && !item.paymentId ? { ...item, status: payments.reduce((sum, payment) => sum + payment.amount, 0) >= debt.amount ? "Completado" as const : "Pendiente" as const } : item),
      });
      return null;
    }
    if (movement.debtId && !movement.paymentId) {
      if (current.debts.some((debt) => debt.id === movement.debtId)) deleteDebt(movement.debtId);
      else setBusinessData({ ...current, movements: current.movements.filter((item) => item.debtId !== movement.debtId) });
      return null;
    }
    if (movement.orderId && movement.paymentId) {
      const order = current.externalOrders.find((item) => item.id === movement.orderId);
      if (!order) { setBusinessData({ ...current, movements: current.movements.filter((item) => item.id !== movement.id) }); return null; }
      const payments = order.payments.filter((payment) => payment.id !== movement.paymentId);
      const received = payments.reduce((sum, payment) => sum + payment.amount, 0);
      setBusinessData({
        ...current,
        externalOrders: current.externalOrders.map((item) => item.id === order.id ? { ...item, payments } : item),
        movements: current.movements.filter((item) => item.id !== movement.id).map((item) => item.orderId === order.id && item.type === "Venta"
          ? { ...item, status: received >= order.quantity * order.unitPrice ? "Completado" : "Pendiente" }
          : item),
      });
      return null;
    }
    if (movement.orderId && !movement.paymentId) { deleteExternalOrder(movement.orderId); return null; }
    if (movement.saleId && movement.paymentId) {
      const sale = current.sales.find((item) => item.id === movement.saleId);
      if (!sale) {
        setBusinessData({ ...current, movements: current.movements.filter((item) => item.id !== movement.id) });
        return null;
      }
      const payments = sale.payments.filter((payment) => payment.id !== movement.paymentId);
      const received = payments.reduce((sum, payment) => sum + payment.amount, 0);
      setBusinessData({
        ...current,
        sales: current.sales.map((item) => item.id === sale.id ? { ...item, payments } : item),
        movements: current.movements.filter((item) => item.id !== movement.id).map((item) => item.saleId === sale.id && !item.paymentId
          ? { ...item, status: received >= sale.quantity * sale.unitPrice ? "Completado" : "Pendiente" }
          : item),
      });
      return null;
    }
    if (movement.saleId && !movement.paymentId) {
      if (current.sales.some((sale) => sale.id === movement.saleId)) deleteSale(movement.saleId);
      else setBusinessData({ ...current, movements: current.movements.filter((item) => item.saleId !== movement.saleId) });
      return null;
    }
    if (movement.type === "Préstamo") {
      const loanId = movement.loanId ?? movement.id;
      const linkedPayments = current.movements.filter((item) => item.type === "Ingreso" && item.loanId === loanId);
      const outstanding = Math.max(0, movement.amount - linkedPayments.reduce((sum, item) => sum + item.amount, 0));
      setBusinessData({
        ...current,
        loansReceivable: Math.max(0, current.loansReceivable - outstanding),
        movements: current.movements.filter((item) => item.id !== movement.id && item.loanId !== loanId),
      });
      return null;
    }
    if (movement.type === "Ingreso" && movement.loanId) {
      setBusinessData({
        ...current,
        loansReceivable: current.loansReceivable + movement.amount,
        movements: current.movements.filter((item) => item.id !== movement.id),
      });
      return null;
    }
    if (movement.type === "Compra" && movement.productId) {
      const product = current.products.find((item) => item.id === movement.productId);
      const linkedSales = current.sales.filter((sale) => sale.productId === movement.productId);
      const saleIds = new Set(linkedSales.map((sale) => sale.id));
      setBusinessData({
        ...current,
        products: current.products.filter((item) => item.id !== movement.productId),
        sales: current.sales.filter((sale) => sale.productId !== movement.productId),
        inventoryCost: Math.max(0, current.inventoryCost - (product ? product.quantityAvailable * product.unitCost : 0)),
        movements: current.movements.filter((item) => item.id !== movement.id && (!item.saleId || !saleIds.has(item.saleId))),
      });
      return null;
    }
    const inventoryEffect = movement.type === "Compra" && movement.status === "Completado" ? movement.amount : 0;
    setBusinessData({
      ...current,
      inventoryCost: Math.max(0, current.inventoryCost - inventoryEffect),
      movements: current.movements.filter((item) => item.id !== movement.id),
    });
    return null;
  }

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><span /><span /><span /><span /></span><span className="brand-name">control<span>negocio</span></span></div>
        <div className="workspace"><div className="workspace-icon">CN</div><div className="workspace-copy"><strong>Mi negocio</strong><span>Cuenta personal</span></div><span className="workspace-chevron">⌄</span></div>
        <div className="nav-caption">MENÚ PRINCIPAL</div>
        <nav className="nav-list" aria-label="Navegación principal">
          {sections.map((item) => <button key={item.label} className={`nav-item ${section === item.label ? "nav-item-active" : ""}`} onClick={() => navigate(item.label)}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.label === "Deudas" && finance.debtTotal > 0 && <span className="nav-count">{businessData.debts.filter((debt) => debt.kind === "Préstamo recibido" && debt.amount > debt.payments.reduce((sum, payment) => sum + payment.amount, 0)).length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-spark">✳</div><strong>Un negocio saludable<br />empieza con claridad.</strong><span>Tu información está guardada en este dispositivo.</span><button onClick={() => setNotice("Los datos se guardan automáticamente en este dispositivo.")}>Entendido <Icon name="chevron" size={14} /></button></div><div className="user-profile"><div className="avatar">CN</div><div className="user-info"><strong>Mi cuenta</strong><span>Administrador</span></div><button className="icon-button profile-menu" aria-label="Opciones de cuenta"><Icon name="dots" /></button></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="mobile-menu icon-button" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button><div className="breadcrumb"><span>Mi negocio</span><Icon name="chevron" size={14} /><strong>{section}</strong></div><div className="topbar-actions">{["Inventario", "Ventas", "Préstamos", "Deudas", "Movimientos"].includes(section) && <button className="button button-secondary section-reset-button" onClick={() => setResetSection(section)}><Icon name="close" size={16}/> Limpiar sección</button>}<div className="search-box"><Icon name="search" size={18} /><input aria-label="Buscar" placeholder="Buscar en tu negocio..." /><kbd>⌘ K</kbd></div><button className="icon-button notification-button" aria-label="Notificaciones" onClick={() => setNotice("No tienes notificaciones nuevas.")}><Icon name="bell" /><i /></button><div className="top-avatar">CN</div></div></header>

        <div className="page-content">
          {section === "Inicio" ? <>
            <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> RESUMEN DE TU NEGOCIO</div><h1>Buenos días, <span>bienvenido.</span></h1><p className="welcome-subtitle">Aquí tienes un resumen claro de cómo va tu negocio.</p></div><div className="welcome-actions"><span className="date-label">{currentDate}</span><button className="button button-secondary" onClick={() => setNotice("El reporte estará disponible cuando tengas movimientos registrados.")}><Icon name="download" size={17} /> Exportar</button><button className="button button-primary" onClick={() => setShowNewMovement(true)}><Icon name="plus" size={18} /> Nuevo movimiento</button></div></div>

            {!businessData.movements.length && <div className="clean-data-note"><span className="note-icon">✦</span><span><strong>Tu espacio está listo.</strong> Empezarás con tus datos reales, sin movimientos de demostración.</span><button aria-label="Ocultar aviso" onClick={(event) => event.currentTarget.parentElement?.remove()}><Icon name="close" size={15} /></button></div>}

            <section className="metric-grid" aria-label="Resumen financiero">
              <MetricCard label="Capital inicial" value={formatCOP(5_000_000)} detail="Tu base de inversión" icon="wallet" iconTone="blue" />
              <MetricCard label="Capital recuperado" value={formatCOP(finance.recoveredCapital)} detail="Capital que regresó en ingresos y ventas" icon="coins" iconTone="mint" />
              <MetricCard label="Capital disponible" value={formatCOP(finance.availableCapital)} detail="Dinero disponible hoy" icon="coins" iconTone="green" trend="available" />
              <MetricCard label="Invertido en inventario" value={formatCOP(finance.invested)} detail="A costo de compra" icon="cube" iconTone="purple" />
              <MetricCard label="Capital comprometido" value={formatCOP(finance.externalOrderInvestment)} detail="Costo de pedidos aún no recuperado" icon="box" iconTone="blue" />
              <MetricCard label="Cartera pendiente" value={formatCOP(finance.receivables)} detail="Ventas y pedidos menos pagos recibidos" icon="coins" iconTone="orange" />
              <MetricCard label="Préstamos por recuperar" value={formatCOP(finance.loansReceivable)} detail="Dinero pendiente de cobro" icon="hand" iconTone="orange" />
              <MetricCard label="Ganancias acumuladas" value={formatCOP(finance.profit)} detail="Ventas menos costo del producto" icon="chart" iconTone="mint" />
              <MetricCard label="Deudas pendientes" value={formatCOP(finance.debtTotal)} detail="Dinero recibido de terceros por devolver" icon="debt" iconTone="red" onClick={() => navigate("Deudas")} />
            </section>

            <section className="overview-grid">
              <div className="panel performance-panel"><div className="panel-heading"><div><div className="panel-title-row"><h2>Rendimiento del negocio</h2><button className="select-pill" onClick={() => setNotice("La gráfica se activará con tus datos reales.")}>Últimos 6 meses <span>⌄</span></button></div><p>Una vista de tu evolución financiera</p></div><button className="icon-button panel-menu" aria-label="Más opciones"><Icon name="dots" /></button></div><div className="chart-legend"><span className="legend-line" /> Valor del negocio <span className="legend-dot" /> Ganancias</div><div className="chart-wrap"><div className="y-axis"><span>$6M</span><span>$4M</span><span>$2M</span><span>$0</span></div><div className="chart"><div className="chart-gridlines"><i /><i /><i /><i /></div><div className="chart-empty"><span>Registra tus movimientos para ver la evolución de tu negocio.</span></div><div className="x-axis">{monthLabels.map((month) => <span key={month}>{month}</span>)}</div></div></div><div className="chart-footer"><span><i className="foot-dot blue" /> Capital, inventario y cartera</span><span><i className="foot-dot green" /> Utilidad neta</span><span className="chart-hint">Se actualizará con tus movimientos <span>↗</span></span></div></div>

              <div className="panel allocation-panel"><div className="panel-heading"><div><h2>Distribución del capital</h2><p>Así está compuesto tu negocio</p></div><button className="icon-button panel-menu" aria-label="Más opciones"><Icon name="dots" /></button></div><div className="allocation-main"><div className="donut" style={{ background: `conic-gradient(#7183ed 0deg ${finance.businessValue ? finance.availableCapital / finance.businessValue * 360 : 360}deg, #b9a7e5 ${finance.businessValue ? finance.availableCapital / finance.businessValue * 360 : 360}deg ${finance.businessValue ? (finance.availableCapital + finance.invested) / finance.businessValue * 360 : 360}deg, #7fc4a0 ${finance.businessValue ? (finance.availableCapital + finance.invested) / finance.businessValue * 360 : 360}deg ${finance.businessValue ? (finance.availableCapital + finance.invested + finance.externalOrderInvestment) / finance.businessValue * 360 : 360}deg, #efad69 ${finance.businessValue ? (finance.availableCapital + finance.invested + finance.externalOrderInvestment) / finance.businessValue * 360 : 360}deg 360deg)` }}><div className="donut-center"><span>Valor total</span><strong>{formatCOP(finance.businessValue)}</strong></div></div></div><div className="allocation-list"><AllocationRow color="blue" label="Capital disponible" value={finance.availableCapital} /><AllocationRow color="purple" label="Inventario" value={finance.invested} /><AllocationRow color="mint" label="Comprometido en pedidos" value={finance.externalOrderInvestment} /><AllocationRow color="orange" label="Por recuperar" value={finance.loansReceivable} /></div><button className="text-link" onClick={() => navigate("Reportes")}>Ver detalle del capital <Icon name="chevron" size={16} /></button></div>
            </section>

            <section className="panel transactions-panel"><div className="transactions-heading"><div><h2>Movimientos recientes</h2><p>Un registro claro de la actividad de tu negocio</p></div><button className="text-link" onClick={() => navigate("Movimientos")}>Ver todos <Icon name="chevron" size={16} /></button></div>{transactions.length ? <div className="table-scroll"><table><thead><tr><th>DETALLE</th><th>TIPO</th><th>FECHA</th><th>ESTADO</th><th className="amount-col">VALOR</th><th /></tr></thead><tbody>{transactions.map((movement) => <MovementRow key={movement.id} movement={movement} onEdit={openMovementEditor} onDelete={(item) => { setMovementDeleteError(""); setMovementToDelete(item); }} />)}</tbody></table></div> : <div className="empty-activity"><div className="empty-illustration"><span className="empty-paper"><i /><i /><i /></span><span className="empty-plus"><Icon name="plus" size={14} /></span></div><strong>Aún no hay movimientos</strong><span>Cuando registres tu primera actividad, aparecerá aquí.</span><button className="empty-action" onClick={() => setShowNewMovement(true)}><Icon name="plus" size={16} /> Registrar movimiento</button></div>}</section>
            <footer className="page-footer"><span>CONTROL NEGOCIO <span className="footer-sep">·</span> Gestión clara, decisiones inteligentes.</span><span><i /> Tus datos se guardan en este dispositivo</span></footer>
          </> : section === "Inventario" ? <InventoryModule products={businessData.products} protectedProductIds={[...new Set(businessData.sales.map((sale) => sale.productId))]} categories={businessData.inventoryCategories} availableCapital={finance.availableCapital} onAdd={addInventoryProduct} onUpdate={updateInventoryProduct} onDelete={deleteInventoryProduct} onCategoriesChange={updateInventoryCategories} /> : section === "Ventas" ? <SalesModule sales={businessData.sales} legacySales={businessData.movements.filter((movement) => movement.type === "Venta" && !movement.saleId && !movement.orderId)} externalOrders={businessData.externalOrders} products={businessData.products} requestedEditSale={requestedSaleEdit} requestedEditOrder={requestedOrderEdit} onRequestedEditHandled={() => setRequestedSaleEditId(null)} onRequestedOrderEditHandled={() => setRequestedOrderEditId(null)} onSave={saveSale} onSaveOrder={saveExternalOrder} onDelete={deleteSale} onDeleteOrder={deleteExternalOrder} onPayment={addSalePayment} onOrderPayment={addExternalOrderPayment} onEditLegacy={openMovementEditor} onDeleteLegacy={(item) => { setMovementDeleteError(""); setMovementToDelete(item); }} /> : section === "Deudas" ? <DebtsModule debts={businessData.debts} availableCapital={finance.availableCapital} requestedEditDebt={requestedDebtEdit} onRequestedEditHandled={() => setRequestedDebtEditId(null)} onSave={saveDebt} onPay={payDebt} onDelete={deleteDebt} /> : <SectionView section={section} data={businessData} onAdd={() => setShowNewMovement(true)} onHome={() => navigate("Inicio")} onEdit={openMovementEditor} onDelete={(item) => { setMovementDeleteError(""); setMovementToDelete(item); }} />}
        </div>
      </main>
      {showNewMovement && <NewMovementModal loans={activeLoans} onClose={() => setShowNewMovement(false)} onSave={addMovement} />}
      {movementToEdit && <MovementEditorModal movement={movementToEdit} onClose={() => setMovementToEdit(null)} onSave={saveMovementEdit} />}
      {movementToDelete && <MovementDeleteDialog movement={movementToDelete} relatedCount={movementRelatedCount(movementToDelete, businessData)} error={movementDeleteError} onClose={() => { setMovementToDelete(null); setMovementDeleteError(""); }} onConfirm={() => { const error = deleteMovement(movementToDelete.id); if (error) setMovementDeleteError(error); else { setMovementToDelete(null); setNotice("Movimiento eliminado y valores actualizados."); } }} />}
      {resetSection && <ResetSectionDialog section={resetSection} onClose={() => setResetSection(null)} onConfirm={() => clearSectionData(resetSection)} />}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  );
}

function ResetSectionDialog({ section, onClose, onConfirm }: { section: string; onClose: () => void; onConfirm: () => void }) {
  const descriptions: Record<string, string> = {
    Inventario: "Se eliminarán los productos, sus compras y las ventas hechas desde esos productos. Las categorías volverán a las opciones iniciales.",
    Ventas: "Se eliminarán ventas, cartera, abonos y pedidos externos. Las unidades vendidas volverán al inventario. Los movimientos relacionados se retirarán.",
    Préstamos: "Se eliminarán los préstamos entregados y sus abonos. Los movimientos relacionados también se retirarán.",
    Deudas: "Se eliminarán los préstamos recibidos, sus pagos y los movimientos relacionados.",
    Movimientos: "Se reiniciarán todos los registros de Inventario, Ventas, Préstamos, Deudas y Movimientos para empezar de nuevo.",
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal reset-section-modal" role="dialog" aria-modal="true" aria-labelledby="reset-section-title"><div className="modal-header"><div><span className="eyebrow">REINICIO DE REGISTROS</span><h2 id="reset-section-title">Limpiar {section.toLocaleLowerCase("es-CO")}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close"/></button></div><p className="delete-copy">{descriptions[section]} Esta acción no se puede deshacer.</p><div className="reset-capital-note">El capital inicial guía de {formatCOP(5_000_000)} se conserva.</div><div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button delete-confirm" onClick={onConfirm}>Sí, limpiar sección</button></div></section></div>;
}

function MetricCard({ label, value, detail, icon, iconTone, trend, onClick }: { label: string; value: string; detail: string; icon: string; iconTone: string; trend?: string; onClick?: () => void }) {
  const content = <><div className={`metric-icon ${iconTone}`}><MetricIcon name={icon} /></div><div className="metric-label">{label}{!onClick && <span className="info-dot" aria-label={`Información: ${detail}`}>i</span>}</div><strong className="metric-value">{value}</strong><div className="metric-bottom">{trend && <span className="tiny-trend"><Icon name="trend" size={13} /> Capital base</span>}{!trend && <span>{detail}</span>}</div></>;
  return onClick ? <button type="button" className="metric-card metric-card-action" onClick={onClick} aria-label={`${label}: ${value}. Ver deudas`}>{content}</button> : <article className="metric-card">{content}</article>;
}

function MetricIcon({ name }: { name: string }) {
  if (name === "wallet") return <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 9h18M16 14h2"/><path d="M6 6V4h12v2"/></svg>;
  if (name === "coins") return <svg viewBox="0 0 24 24"><ellipse cx="10" cy="6" rx="6" ry="3"/><path d="M4 6v5c0 1.7 2.7 3 6 3s6-1.3 6-3V6M4 11v5c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4"/><path d="M15 12c3.3 0 6 1.3 6 3s-2.7 3-6 3-6-1.3-6-3"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-2"/></svg>;
  if (name === "cube") return <svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9"/></svg>;
  if (name === "hand") return <Icon name="hand" size={23} />;
  if (name === "chart") return <Icon name="chart" size={22} />;
  if (name === "debt") return <svg viewBox="0 0 24 24"><path d="M10.3 3.9 2.5 17.4A1.8 1.8 0 0 0 4 20h16a1.8 1.8 0 0 0 1.5-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></svg>;
  return <svg viewBox="0 0 24 24"><path d="M4 21V5l8-3 8 3v16M2 21h20"/><path d="M9 21v-6h6v6M9 7h1M14 7h1M9 11h1M14 11h1"/></svg>;
}

function AllocationRow({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="allocation-row"><span className={`allocation-swatch ${color}`} /><span>{label}</span><strong>{formatCOP(value)}</strong></div>;
}

function MovementRow({ movement, onEdit, onDelete }: { movement: Movement; onEdit: (movement: Movement) => void; onDelete: (movement: Movement) => void }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const icons: Record<string, string> = { Ingreso: "↓", Gasto: "↗", Compra: "▧", Venta: "↗", Préstamo: "↗" };
  const tone = movement.type === "Ingreso" || movement.type === "Venta" ? "positive" : movement.type === "Préstamo" ? "loan" : "negative";
  const isUncollectedSale = movement.type === "Venta" && Boolean(movement.saleId || movement.orderId);
  const debtObligation = movement.debtId && !movement.paymentId && movement.type === "Gasto";
  const debtReceipt = movement.debtId && !movement.paymentId && movement.type === "Ingreso";
  const amountPrefix = debtObligation ? "" : tone === "positive" && !isUncollectedSale ? "+" : tone === "positive" ? "" : "−";
  const movementNote = debtObligation ? "Obligación registrada · aún no ha salido de caja" : debtReceipt ? "Préstamo recibido · pendiente de devolución" : isUncollectedSale ? "Valor de venta · revisa el estado de pago" : "Movimiento registrado";
  return <tr><td><div className="movement-name"><span className={`movement-icon ${tone}`}>{icons[movement.type]}</span><span><strong>{movement.description}</strong><small>{movementNote}</small></span></div></td><td><span className={`type-badge ${tone}`}>{movement.type}</span></td><td className="date-cell">{new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${movement.date}T12:00:00Z`))}</td><td><span className={`status-badge ${movement.status === "Completado" ? "status-done" : "status-pending"}`}><i />{movement.status}</span></td><td className={`amount-cell ${tone}`}>{amountPrefix}{formatCOP(movement.amount)}</td><td className="movement-menu-cell"><button className="icon-button row-menu" aria-label={`Opciones de ${movement.description}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPosition({ top: Math.min(rect.bottom + 3, window.innerHeight - 110), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) }); setOpen(!open); }}><Icon name="dots" size={18} /></button>{open && <><button className="sales-menu-dismiss" aria-label="Cerrar menú" onClick={() => setOpen(false)}/><div className="sales-menu movement-menu" style={{ top: position.top, left: position.left }}><button onClick={() => { setOpen(false); onEdit(movement); }}>Editar movimiento</button><button className="sales-menu-delete" onClick={() => { setOpen(false); onDelete(movement); }}>Eliminar movimiento</button></div></>}</td></tr>;
}

function SectionView({ section, data, onAdd, onHome, onEdit, onDelete }: { section: string; data: BusinessData; onAdd: () => void; onHome: () => void; onEdit: (movement: Movement) => void; onDelete: (movement: Movement) => void }) {
  const summary = calculateFinance(data);
  const items: Record<string, { title: string; value: string; label: string }[]> = {
    Inventario: [{ title: "Valor en inventario", value: formatCOP(summary.invested), label: "A costo de compra" }, { title: "Productos", value: "0", label: "Sin productos registrados" }, { title: "Bajo inventario", value: "0", label: "Sin alertas" }],
    Ventas: [{ title: "Ganancia acumulada", value: formatCOP(summary.profit), label: "Precio de venta menos costo" }, { title: "Ventas registradas", value: String(data.movements.filter((m) => m.type === "Venta").length), label: "En total" }, { title: "Ventas por cobrar", value: formatCOP(data.otherReceivables), label: "Pagos pendientes" }],
    Préstamos: [{ title: "Por recuperar", value: formatCOP(summary.loansReceivable), label: "Capital prestado pendiente" }, { title: "Préstamos activos", value: String(data.movements.filter((m) => m.type === "Préstamo").length), label: "En total" }, { title: "Capital disponible", value: formatCOP(summary.availableCapital), label: "Disponible hoy" }],
    Deudas: [{ title: "Deudas pendientes", value: formatCOP(summary.debtTotal), label: "Préstamos recibidos por devolver" }, { title: "Total pagado", value: formatCOP(summary.debtPaymentsTotal), label: "Abonos hechos a terceros" }, { title: "Deudas activas", value: String(data.debts.filter((debt) => debt.kind === "Préstamo recibido" && debt.amount > debt.payments.reduce((sum, payment) => sum + payment.amount, 0)).length), label: "Con saldo pendiente" }],
    Movimientos: [{ title: "Movimientos", value: String(data.movements.length), label: "Actividad registrada" }, { title: "Ingresos recibidos", value: formatCOP(data.movements.filter((m) => m.status === "Completado" && (m.type === "Ingreso" || (m.type === "Venta" && !m.saleId && !m.orderId))).reduce((n,m) => n + m.amount, 0)), label: "Pagos realmente recibidos" }, { title: "Gastos y compras pagados", value: formatCOP(data.movements.filter((m) => m.status === "Completado" && (m.type === "Gasto" && (!m.debtId || Boolean(m.paymentId)) || m.type === "Compra" || m.type === "Préstamo")).reduce((n,m) => n + m.amount, 0)), label: "Salidas de efectivo" }],
    Reportes: [{ title: "Valor del negocio", value: formatCOP(summary.businessValue), label: "Activos y efectivo menos obligaciones" }, { title: "Capital disponible", value: formatCOP(summary.availableCapital), label: "Dinero libre después de compromisos" }, { title: "Capital comprometido", value: formatCOP(summary.externalOrderInvestment), label: "Costo de pedidos aún no recuperado" }, { title: "Deudas totales", value: formatCOP(summary.debtTotal), label: "Obligaciones pendientes" }, { title: "Cartera pendiente", value: formatCOP(summary.receivables), label: "Ventas menos pagos recibidos" }, { title: "Ganancia acumulada", value: formatCOP(summary.profit), label: "Venta menos costo" }, { title: "Capital inicial", value: formatCOP(5_000_000), label: "Base del negocio" }],
    Configuración: [{ title: "Capital inicial", value: formatCOP(5_000_000), label: "Valor de referencia" }, { title: "Almacenamiento", value: "Local", label: "Este dispositivo" }, { title: "Moneda", value: "COP", label: "Peso colombiano" }],
  };
  const entries = data.movements.filter((m) => section === "Movimientos" || (section === "Préstamos" && (m.type === "Préstamo" || Boolean(m.loanId))));
  return <><div className="section-welcome"><div><div className="eyebrow"><span className="live-dot" /> CONTROL NEGOCIO</div><h1>{section}</h1><p>{navDescriptions[section]}</p></div><div className="section-actions">{section !== "Configuración" && <button className="button button-primary" onClick={onAdd}><Icon name="plus" size={18} /> Nuevo movimiento</button>}</div></div><section className="section-stat-grid">{(items[section] ?? []).map((item, index) => <div className="section-stat" key={item.title}><span className={`section-stat-icon stat-${index}`}>{[<Icon name="chart" key="c" />, <Icon name="box" key="b" />, <Icon name="trend" key="t" />][index]}</span><span>{item.title}</span><strong>{item.value}</strong><small>{item.label}</small></div>)}</section><section className="panel section-content"><div className="transactions-heading"><div><h2>{section === "Configuración" ? "Preferencias" : section === "Movimientos" ? "Todos los movimientos" : `Actividad de ${section.toLowerCase()}`}</h2><p>{section === "Configuración" ? "Los datos financieros permanecen en este dispositivo." : "Los registros aparecerán aquí a medida que uses tu negocio."}</p></div>{section !== "Configuración" && <button className="button button-small" onClick={onAdd}><Icon name="plus" size={16} /> Registrar</button>}</div>{section === "Configuración" ? <div className="settings-row"><div className="settings-initial">$</div><div><strong>Capital inicial de referencia</strong><span>Este es el capital con el que comienza tu negocio.</span></div><strong className="settings-value">{formatCOP(5_000_000)}</strong></div> : entries.length ? <div className="table-scroll"><table><thead><tr><th>DETALLE</th><th>TIPO</th><th>FECHA</th><th>ESTADO</th><th className="amount-col">VALOR</th><th/></tr></thead><tbody>{entries.map((movement) => <MovementRow key={movement.id} movement={movement} onEdit={onEdit} onDelete={onDelete} />)}</tbody></table></div> : <div className="empty-activity section-empty"><div className="empty-illustration"><span className="empty-paper"><i /><i /><i /></span><span className="empty-plus"><Icon name="plus" size={14} /></span></div><strong>Aún no tienes registros</strong><span>Agrega información para comenzar a llevar el control.</span><button className="empty-action" onClick={onAdd}><Icon name="plus" size={16} /> Crear primer registro</button></div>}</section><button className="back-home" onClick={onHome}><Icon name="chevron" size={16} /> Volver al resumen</button><footer className="page-footer"><span>CONTROL NEGOCIO <span className="footer-sep">·</span> Gestión clara, decisiones inteligentes.</span><span><i /> Tus datos se guardan en este dispositivo</span></footer></>;
}

function MovementEditorModal({ movement, onClose, onSave }: { movement: Movement; onClose: () => void; onSave: (movement: Pick<Movement, "description" | "date" | "amount" | "status">) => string | null }) {
  const [description, setDescription] = useState(movement.description);
  const [date, setDate] = useState(movement.date);
  const [amount, setAmount] = useState(String(movement.amount));
  const [status, setStatus] = useState<Movement["status"]>(movement.status);
  const [error, setError] = useState("");
  const lockedStatus = Boolean(movement.saleId || movement.loanId || movement.productId || movement.debtId);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onSave({ description, date, amount: Number(amount), status });
    if (result) setError(result);
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="edit-movement-title"><div className="modal-header"><div><span className="eyebrow">ACTUALIZA EL REGISTRO</span><h2 id="edit-movement-title">Editar movimiento</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close"/></button></div><form onSubmit={submit}><label>Tipo de movimiento<input value={movement.type} readOnly/></label><label>Descripción<input autoFocus value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120}/></label><div className="form-two"><label>Valor<input type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)}/></label><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label></div><label>Estado<select value={status} disabled={lockedStatus} onChange={(event) => setStatus(event.target.value as Movement["status"])}><option>Completado</option><option>Pendiente</option></select>{lockedStatus && <small className="form-hint">El estado está ligado a inventario, ventas, préstamos o deudas.</small>}</label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">Guardar cambios</button></div></form></section></div>;
}

function MovementDeleteDialog({ movement, relatedCount, error, onClose, onConfirm }: { movement: Movement; relatedCount: number; error: string; onClose: () => void; onConfirm: () => void }) {
  const cascadeText = movement.debtId && !movement.paymentId
    ? " También se eliminarán los pagos de esta deuda y se ajustarán el capital y el saldo pendiente."
    : movement.debtId && movement.paymentId
      ? " El abono se quitará del historial y el capital disponible y saldo de la deuda se actualizarán."
      : relatedCount > 0 && movement.productId
    ? ` También se anularán ${relatedCount} ${relatedCount === 1 ? "venta asociada" : "ventas asociadas"}, sus pagos y movimientos.`
    : movement.orderId && !movement.paymentId
      ? " Se revertirá el pago al proveedor y los pagos o saldos del cliente asociados a este pedido externo. No se modificarán las existencias del inventario tradicional."
    : movement.orderId && movement.paymentId
      ? " El abono se retirará del historial del cliente y el saldo por cobrar aumentará."
    : movement.saleId && !movement.paymentId
      ? ` Se devolverán al inventario las unidades de esta venta${relatedCount > 0 ? ` y se retirarán ${relatedCount} ${relatedCount === 1 ? "pago asociado" : "pagos asociados"}` : ""}.`
    : relatedCount > 0 && movement.type === "Préstamo"
      ? ` También se eliminarán ${relatedCount} ${relatedCount === 1 ? "abono asociado" : "abonos asociados"}.`
      : "";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-movement-title"><div className="modal-header"><div><span className="eyebrow">CONFIRMAR ACCIÓN</span><h2 id="delete-movement-title">Eliminar movimiento</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close"/></button></div><p className="delete-copy">¿Estás seguro de que deseas eliminar este movimiento? Esta acción actualizará los valores de tu negocio y no se puede deshacer{cascadeText}</p><div className="delete-movement-summary"><span>{movement.description}</span><strong>{formatCOP(movement.amount)}</strong></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button delete-confirm" onClick={onConfirm}>Eliminar movimiento</button></div></section></div>;
}

function NewMovementModal({ loans, onClose, onSave }: { loans: { id: string; description: string; balance: number }[]; onClose: () => void; onSave: (movement: Omit<Movement, "id">) => string | null }) {
  const [type, setType] = useState<Movement["type"] | "Abono de préstamo">("Ingreso");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loanId, setLoanId] = useState(loans[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<Movement["status"]>("Completado");
  const [error, setError] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!description.trim() || !numericAmount || numericAmount < 0) return setError("Completa una descripción y un valor válido.");
    const movement = type === "Abono de préstamo"
      ? { type: "Ingreso" as const, loanId, description: description.trim() || "Abono de préstamo", amount: numericAmount, date, status: "Completado" as const }
      : { type, description: description.trim(), amount: numericAmount, date, status };
    const result = onSave(movement);
    if (result) setError(result);
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="eyebrow">REGISTRO DEL NEGOCIO</span><h2 id="modal-title">Nuevo movimiento</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close" /></button></div><form onSubmit={submit}><label>Tipo de movimiento<select value={type} onChange={(event) => setType(event.target.value as Movement["type"] | "Abono de préstamo")}>{["Ingreso", "Gasto", "Compra", "Préstamo", "Abono de préstamo"].map((value) => <option key={value}>{value}</option>)}</select></label>{type === "Abono de préstamo" && <label>Préstamo<select value={loanId} onChange={(event) => setLoanId(event.target.value)}>{loans.map((loan) => <option key={loan.id} value={loan.id}>{loan.description} · {formatCOP(loan.balance)} pendiente</option>)}</select></label>}<label>Descripción<input autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === "Abono de préstamo" ? "Ej. Abono recibido" : "Ej. Pago de proveedor"} /></label><div className="form-two"><label>Valor<input inputMode="numeric" type="number" min="1" max={type === "Abono de préstamo" ? loans.find((loan) => loan.id === loanId)?.balance : undefined} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>{type === "Abono de préstamo" ? <label>Estado<input value="Completado" readOnly/></label> : <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as Movement["status"])}><option>Completado</option><option>Pendiente</option></select></label>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">Guardar movimiento</button></div></form></section></div>;
}
