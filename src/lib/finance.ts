export const INITIAL_CAPITAL = 5_000_000;

export type MovementType = "Ingreso" | "Gasto" | "Compra" | "Venta" | "Préstamo";

export type Movement = {
  id: string;
  type: MovementType;
  description: string;
  date: string;
  amount: number;
  /** Cost of goods sold; used to calculate actual profit on a sale. */
  cost?: number;
  /** New sale records are linked so their face value is never mistaken for cash. */
  saleId?: string;
  orderId?: string;
  paymentId?: string;
  productId?: string;
  loanId?: string;
  debtId?: string;
  status: "Completado" | "Pendiente";
};

export type SalePayment = { id: string; amount: number; date: string };
export type DebtKind = "Préstamo recibido" | "Pago pendiente a trabajador" | "Proveedor" | "Otros";
export type DebtRecord = {
  id: string;
  creditor: string;
  concept: string;
  kind: DebtKind;
  amount: number;
  date: string;
  dueDate: string;
  observations: string;
  payments: SalePayment[];
};

export type SaleRecord = {
  id: string;
  clientName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  date: string;
  payments: SalePayment[];
};

export type ExternalOrderStatus = "Pendiente" | "Comprado" | "Entregado";
export type ExternalOrderRecord = {
  id: string;
  clientName: string;
  productName: string;
  supplier: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  date: string;
  orderStatus: ExternalOrderStatus;
  supplierPaid: boolean;
  payments: SalePayment[];
};

export type InventoryProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  quantityPurchased: number;
  quantityAvailable: number;
  unitCost: number;
  salePrice: number;
  purchaseDate: string;
  supplier: string;
};

export const DEFAULT_INVENTORY_CATEGORIES = [
  "Accesorios tecnológicos",
  "Crema de leche",
  "Leche en polvo",
  "Electrolit",
  "Otros",
];

export type BusinessData = {
  movements: Movement[];
  sales: SaleRecord[];
  externalOrders: ExternalOrderRecord[];
  debts: DebtRecord[];
  inventoryCost: number;
  inventoryTrackingVersion: number;
  products: InventoryProduct[];
  inventoryCategories: string[];
  loansReceivable: number;
  otherReceivables: number;
};

export const EMPTY_BUSINESS_DATA: BusinessData = {
  movements: [],
  sales: [],
  externalOrders: [],
  debts: [],
  inventoryCost: 0,
  inventoryTrackingVersion: 1,
  products: [],
  inventoryCategories: DEFAULT_INVENTORY_CATEGORIES,
  loansReceivable: 0,
  otherReceivables: 0,
};

function normalizedText(value: string) {
  return value.trim().toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function migrateCustomerReceivables(debts: DebtRecord[], sales: SaleRecord[], externalOrders: ExternalOrderRecord[], movements: Movement[]) {
  const retainedDebts: DebtRecord[] = [];
  let migratedSales = [...sales];
  let migratedOrders = [...externalOrders];
  let migratedMovements = [...movements];

  for (const debt of debts) {
    if (debt.kind === "Préstamo recibido") { retainedDebts.push(debt); continue; }
    const concept = normalizedText(debt.concept || "");
    const creditor = normalizedText(debt.creditor || "");
    const totalPaid = debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const orderMatches = migratedOrders.filter((order) => normalizedText(order.clientName) === creditor
      && order.quantity * order.unitPrice === debt.amount
      && (normalizedText(order.productName) === concept || order.date === debt.date));
    const saleMatches = migratedSales.filter((sale) => normalizedText(sale.clientName) === creditor
      && sale.quantity * sale.unitPrice === debt.amount
      && (normalizedText(sale.productName) === concept || sale.date === debt.date));

    let targetOrder: ExternalOrderRecord | undefined;
    let targetSale: SaleRecord | undefined;
    if (orderMatches.length === 1 && saleMatches.length === 0) targetOrder = orderMatches[0];
    else if (saleMatches.length === 1 && orderMatches.length === 0) targetSale = saleMatches[0];
    else if (!orderMatches.length && !saleMatches.length && debt.kind === "Otros") {
      targetSale = {
        id: `migrated-receivable:${debt.id}`,
        clientName: debt.creditor,
        productId: `migrated-receivable:${debt.id}`,
        productName: debt.concept || "Venta fiada migrada",
        quantity: 1,
        unitPrice: debt.amount,
        unitCost: debt.amount,
        date: debt.date,
        payments: [],
      };
      migratedSales.unshift(targetSale);
    }
    if (!targetOrder && !targetSale) { retainedDebts.push(debt); continue; }

    const targetPayments = targetOrder?.payments ?? targetSale!.payments;
    const importedPayments: SalePayment[] = [];
    for (const payment of debt.payments) {
      const duplicate = targetPayments.some((item) => item.id === payment.id || (item.amount === payment.amount && item.date === payment.date));
      if (!duplicate) importedPayments.push(payment);
    }
    const targetTotal = targetOrder ? targetOrder.quantity * targetOrder.unitPrice : targetSale!.quantity * targetSale!.unitPrice;
    const combinedPaid = targetPayments.reduce((sum, payment) => sum + payment.amount, 0) + importedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    if (combinedPaid > targetTotal || (totalPaid > debt.amount && !targetOrder && !targetSale)) { retainedDebts.push(debt); continue; }
    if (targetOrder) {
      const payments = [...targetOrder.payments, ...importedPayments];
      migratedOrders = migratedOrders.map((order) => order.id === targetOrder!.id ? { ...order, payments } : order);
      targetOrder = { ...targetOrder, payments };
    } else if (targetSale) {
      const payments = [...targetSale.payments, ...importedPayments];
      migratedSales = migratedSales.map((sale) => sale.id === targetSale!.id ? { ...sale, payments } : sale);
      targetSale = { ...targetSale, payments };
    }

    const debtMovements = migratedMovements.filter((movement) => movement.debtId === debt.id);
    const originalMarker = debtMovements.find((movement) => !movement.paymentId);
    migratedMovements = migratedMovements.filter((movement) => movement.debtId !== debt.id);
    const targetMarker = migratedMovements.find((movement) => targetOrder
      ? movement.orderId === targetOrder.id && movement.type === "Venta" && !movement.paymentId
      : movement.saleId === targetSale!.id && !movement.paymentId);
    if (targetOrder) {
      const paid = targetOrder.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const marker: Movement = targetMarker
        ? { ...targetMarker, status: paid >= targetTotal ? "Completado" : "Pendiente" }
        : { id: originalMarker?.id ?? `migrated-debt-sale:${debt.id}`, type: "Venta", orderId: targetOrder.id, description: `Pedido externo: ${targetOrder.productName}`, date: targetOrder.date, amount: targetTotal, cost: targetOrder.quantity * targetOrder.unitCost, status: paid >= targetTotal ? "Completado" : "Pendiente" };
      if (!targetMarker) migratedMovements.unshift(marker);
      else migratedMovements = migratedMovements.map((movement) => movement.id === marker.id ? marker : movement);
    } else {
      const sale = targetSale!;
      const paid = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const marker: Movement = targetMarker
        ? { ...targetMarker, status: paid >= targetTotal ? "Completado" : "Pendiente" }
        : { id: originalMarker?.id ?? `migrated-debt-sale:${debt.id}`, type: "Venta", saleId: sale.id, description: `Venta fiada: ${sale.productName}`, date: sale.date, amount: targetTotal, cost: sale.quantity * sale.unitCost, status: paid >= targetTotal ? "Completado" : "Pendiente" };
      if (!targetMarker) migratedMovements.unshift(marker);
      else migratedMovements = migratedMovements.map((movement) => movement.id === marker.id ? marker : movement);
    }

    const allTargetPayments = targetOrder?.payments ?? targetSale!.payments;
    for (const payment of allTargetPayments) {
      const existingPaymentMovement = migratedMovements.find((movement) => movement.paymentId === payment.id && (targetOrder ? movement.orderId === targetOrder.id : movement.saleId === targetSale!.id));
      const relation = targetOrder ? { orderId: targetOrder.id } : { saleId: targetSale!.id };
      if (existingPaymentMovement) {
        migratedMovements = migratedMovements.map((movement) => movement.id === existingPaymentMovement.id
          ? { ...movement, type: "Ingreso" as const, debtId: undefined, ...relation, date: payment.date, amount: payment.amount, status: "Completado" as const, description: `Abono recibido de ${targetOrder?.clientName ?? targetSale!.clientName}` }
          : movement);
        continue;
      }
      const sourceMovement = debtMovements.find((movement) => movement.paymentId === payment.id);
      migratedMovements.unshift({
        id: sourceMovement?.id ?? `migrated-receivable-payment:${targetOrder?.id ?? targetSale!.id}:${payment.id}`,
        type: "Ingreso", ...relation, paymentId: payment.id,
        description: `Abono recibido de ${targetOrder?.clientName ?? targetSale!.clientName}`, date: payment.date, amount: payment.amount, status: "Completado",
      });
    }
  }
  return { debts: retainedDebts, sales: migratedSales, externalOrders: migratedOrders, movements: migratedMovements };
}

export function normalizeBusinessData(data: Partial<BusinessData>): BusinessData {
  const products = Array.isArray(data.products) ? data.products : [];
  const rawMovements = Array.isArray(data.movements) ? data.movements : [];
  const movements = rawMovements.map((movement) => {
    if (movement.type === "Préstamo" && !movement.loanId) return { ...movement, loanId: movement.id };
    if (movement.type === "Compra" && !movement.productId) {
      const matchingProduct = products.find((product) =>
        movement.description === `Compra de inventario: ${product.name}` &&
        movement.date === product.purchaseDate &&
        movement.amount === product.quantityPurchased * product.unitCost,
      );
      if (matchingProduct) return { ...movement, productId: matchingProduct.id };
    }
    return movement;
  });
  const legacyInventoryCost = movements
    .filter((movement) => movement.status === "Completado" && movement.type === "Compra")
    .reduce((total, movement) => total + movement.amount, 0);
  const receivablesMigration = migrateCustomerReceivables(
    Array.isArray(data.debts) ? data.debts : [],
    Array.isArray(data.sales) ? data.sales : [],
    Array.isArray(data.externalOrders) ? data.externalOrders : [],
    movements,
  );
  return {
    ...EMPTY_BUSINESS_DATA,
    ...data,
    movements: receivablesMigration.movements,
    sales: receivablesMigration.sales,
    externalOrders: receivablesMigration.externalOrders,
    debts: receivablesMigration.debts,
    inventoryCost: data.inventoryTrackingVersion === 1 ? data.inventoryCost ?? 0 : legacyInventoryCost,
    inventoryTrackingVersion: 1,
    products,
    inventoryCategories: Array.isArray(data.inventoryCategories) ? data.inventoryCategories : DEFAULT_INVENTORY_CATEGORIES,
  };
}

export function calculateFinance(data: BusinessData) {
  const completed = data.movements.filter((movement) => movement.status === "Completado");
  const legacySales = completed.filter((movement) => movement.type === "Venta" && !movement.saleId && !movement.orderId);
  const recoveredCapital = completed
    .filter((movement) => movement.type === "Ingreso" && !movement.saleId && !movement.orderId && !movement.debtId)
    .reduce((total, movement) => total + movement.amount, 0)
    + legacySales.reduce((total, movement) => total + (movement.cost ?? 0), 0)
    + data.sales.reduce((total, sale) => {
      const received = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
      return total + Math.min(received, sale.quantity * sale.unitCost);
    }, 0);
  const orderRecoveredCapital = data.externalOrders.reduce((total, order) => {
    const received = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return total + Math.min(received, order.quantity * order.unitCost);
  }, 0);
  const invested = data.inventoryCost;
  const profit = legacySales.reduce((total, movement) => total + Math.max(0, movement.amount - (movement.cost ?? 0)), 0)
    + data.sales.reduce((total, sale) => total + (sale.unitPrice - sale.unitCost) * sale.quantity, 0);
  const externalOrderInvestment = data.externalOrders.reduce((total, order) => {
    const cost = order.quantity * order.unitCost;
    const received = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return total + Math.max(0, cost - Math.min(received, cost));
  }, 0);
  const supplierPayables = data.externalOrders.filter((order) => !order.supplierPaid).reduce((total, order) => total + order.quantity * order.unitCost, 0);
  const loanDebts = data.debts.filter((debt) => debt.kind === "Préstamo recibido");
  const debtBalance = loanDebts.reduce((total, debt) => total + Math.max(0, debt.amount - debt.payments.reduce((sum, payment) => sum + payment.amount, 0)), 0);
  const debtPaymentsTotal = loanDebts.reduce((total, debt) => total + debt.payments.reduce((sum, payment) => sum + payment.amount, 0), 0);
  const orderProfit = data.externalOrders.reduce((total, order) => total + (order.unitPrice - order.unitCost) * order.quantity, 0);
  const receivables = data.sales.reduce((total, sale) => total + Math.max(0, sale.quantity * sale.unitPrice - sale.payments.reduce((sum, payment) => sum + payment.amount, 0)), 0)
    + data.externalOrders.reduce((total, order) => total + Math.max(0, order.quantity * order.unitPrice - order.payments.reduce((sum, payment) => sum + payment.amount, 0)), 0)
    + data.movements.filter((movement) => movement.type === "Venta" && !movement.saleId && !movement.orderId && movement.status === "Pendiente").reduce((total, movement) => total + movement.amount, 0);
  const cashFlow = completed.reduce((total, movement) => {
    if (movement.debtId && movement.type === "Gasto" && !movement.paymentId) return total;
    if (movement.type === "Ingreso") return total + movement.amount;
    if (movement.type === "Venta") return total + (movement.saleId || movement.orderId ? 0 : movement.amount);
    if (movement.type === "Compra" && movement.orderId) return total;
    if (movement.type === "Gasto" || movement.type === "Compra" || movement.type === "Préstamo") return total - movement.amount;
    return total;
  }, 0);
  const externalOrderCommittedCost = data.externalOrders.reduce((total, order) => total + order.quantity * order.unitCost, 0);
  const availableCapital = Math.max(0, INITIAL_CAPITAL + cashFlow - externalOrderCommittedCost);
  return {
    invested,
    profit: profit + orderProfit,
    receivables,
    externalOrderInvestment,
    supplierPayables,
    debtTotal: debtBalance,
    debtBalance,
    debtPaymentsTotal,
    recoveredCapital: recoveredCapital + orderRecoveredCapital,
    availableCapital,
    loansReceivable: data.loansReceivable,
    businessValue: availableCapital + invested + data.loansReceivable + data.otherReceivables + receivables - debtBalance,
  };
}

export const formatCOP = (amount: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
