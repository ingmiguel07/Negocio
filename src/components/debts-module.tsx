"use client";

import { useState, type FormEvent } from "react";
import { formatCOP, type DebtKind, type DebtRecord } from "@/lib/finance";

export type DebtDraft = Omit<DebtRecord, "id" | "payments">;
const localDate = () => new Date().toISOString().slice(0, 10);
const paidAmount = (debt: DebtRecord) => debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
const balanceOf = (debt: DebtRecord) => Math.max(0, debt.amount - paidAmount(debt));
const stateOf = (debt: DebtRecord) => balanceOf(debt) === 0 ? "Pagada" : paidAmount(debt) > 0 ? "Abono parcial" : "Pendiente";
const dateLabel = (date: string) => date ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Sin fecha";

function DebtIcon({ name }: { name: "plus" | "dots" | "close" | "cash" | "alert" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14"/>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    cash: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
    alert: <><path d="M10.3 3.9 2.5 17.4A1.8 1.8 0 0 0 4 20h16a1.8 1.8 0 0 0 1.5-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></>,
  };
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function DebtsModule({ debts, availableCapital, requestedEditDebt, onRequestedEditHandled, onSave, onPay, onDelete }: {
  debts: DebtRecord[];
  availableCapital: number;
  requestedEditDebt: DebtRecord | null;
  onRequestedEditHandled: () => void;
  onSave: (draft: DebtDraft, id?: string) => string | null;
  onPay: (id: string, amount: number, date: string) => string | null;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<DebtRecord | null>(null);
  const [paying, setPaying] = useState<DebtRecord | null>(null);
  const [history, setHistory] = useState<DebtRecord | null>(null);
  const [deleting, setDeleting] = useState<DebtRecord | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [filter, setFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [today] = useState(localDate);
  const activeEditing = editing ?? requestedEditDebt;
  const loanDebts = debts.filter((debt) => debt.kind === "Préstamo recibido");
  const activeDebts = loanDebts.filter((debt) => balanceOf(debt) > 0);
  const totalPending = activeDebts.reduce((sum, debt) => sum + balanceOf(debt), 0);
  const totalPaid = loanDebts.reduce((sum, debt) => sum + paidAmount(debt), 0);
  const dueLimitDate = new Date(`${today}T12:00:00Z`); dueLimitDate.setUTCDate(dueLimitDate.getUTCDate() + 30);
  const dueLimit = dueLimitDate.toISOString().slice(0, 10);
  const dueSoon = loanDebts.filter((debt) => balanceOf(debt) > 0 && debt.dueDate && debt.dueDate >= today && debt.dueDate <= dueLimit).length;
  const filteredDebts = loanDebts.filter((debt) => {
    const matchesSearch = `${debt.creditor} ${debt.concept} ${debt.kind}`.toLocaleLowerCase("es-CO").includes(search.toLocaleLowerCase("es-CO"));
    return matchesSearch && (filter === "Todas" || (filter === "Activas" && balanceOf(debt) > 0) || (filter === "Pagadas" && balanceOf(debt) === 0));
  });

  function saveDebt(draft: DebtDraft) {
    const result = onSave(draft, activeEditing?.id);
    if (!result) { setEditing(null); if (requestedEditDebt) onRequestedEditHandled(); }
    return result;
  }
  function payDebt(amount: number, date: string) {
    if (!paying) return "Selecciona una deuda.";
    const result = onPay(paying.id, amount, date);
    if (!result) setPaying(null);
    return result;
  }

  return <>
    <div className="section-welcome"><div><div className="eyebrow"><span className="live-dot"/> PRÉSTAMOS RECIBIDOS</div><h1>Deudas</h1><p>Controla el dinero recibido de personas o entidades externas y las devoluciones realizadas.</p></div><button className="button button-primary" onClick={() => setEditing({ id: "", creditor: "", concept: "", kind: "Préstamo recibido", amount: 0, date: localDate(), dueDate: "", observations: "", payments: [] })}><DebtIcon name="plus"/> Registrar préstamo</button></div>
    <section className="section-stat-grid debt-stat-grid"><DebtStat title="Deudas pendientes" value={formatCOP(totalPending)} note="Saldo que debes devolver" tone="red"/><DebtStat title="Total pagado" value={formatCOP(totalPaid)} note="Abonos hechos a terceros" tone="green"/><DebtStat title="Deudas activas" value={String(activeDebts.length)} note="Con saldo por devolver" tone="orange"/><DebtStat title="Próximos vencimientos" value={String(dueSoon)} note="En los próximos 30 días" tone="purple"/></section>
    <section className="panel debts-panel"><div className="debts-heading"><div><h2>Historial de préstamos</h2><p>El préstamo aumenta el capital disponible y crea una obligación por el mismo valor.</p></div><div className="debts-tools"><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar deudas"><option>Todas</option><option>Activas</option><option>Pagadas</option></select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar prestamista o concepto" aria-label="Buscar deudas"/></div></div>
      {filteredDebts.length ? <div className="debts-table-scroll"><table className="debts-table"><thead><tr><th>ACREEDOR / CONCEPTO</th><th>TIPO</th><th>VENCIMIENTO</th><th className="debt-number">VALOR TOTAL</th><th className="debt-number">PAGADO</th><th className="debt-number">PENDIENTE</th><th>ESTADO</th><th/></tr></thead><tbody>{filteredDebts.map((debt) => {
        const balance = balanceOf(debt); const state = stateOf(debt);
        return <tr key={debt.id}><td><div className="debt-name"><span className="debt-icon"><DebtIcon name={debt.kind === "Préstamo recibido" ? "cash" : "alert"}/></span><span><strong>{debt.creditor}</strong><small>{debt.concept} · registrada {dateLabel(debt.date)}</small></span></div></td><td>{debt.kind}</td><td>{dateLabel(debt.dueDate)}</td><td className="debt-number">{formatCOP(debt.amount)}</td><td className="debt-number debt-paid">{formatCOP(paidAmount(debt))}</td><td className={`debt-number ${balance ? "debt-balance" : "debt-paid"}`}>{formatCOP(balance)}</td><td><span className={`debt-status ${balance ? "debt-status-open" : "debt-status-paid"}`}><i/>{state}</span></td><td className="debt-actions"><button className="icon-button sale-menu-trigger" aria-label={`Opciones de deuda de ${debt.creditor}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ top: Math.min(rect.bottom + 3, window.innerHeight - 150), left: Math.max(8, Math.min(rect.right - 165, window.innerWidth - 173)) }); setMenuId(menuId === debt.id ? null : debt.id); }}><DebtIcon name="dots"/></button>{menuId === debt.id && <><button className="sales-menu-dismiss" aria-label="Cerrar menú" onClick={() => setMenuId(null)}/><div className="sales-menu" style={{ top: menuPosition.top, left: menuPosition.left }}><button onClick={() => { setHistory(debt); setMenuId(null); }}>Ver historial de abonos</button>{balance > 0 && <button onClick={() => { setPaying(debt); setMenuId(null); }}>Registrar abono</button>}<button onClick={() => { setEditing(debt); setMenuId(null); }}>Editar deuda</button><button className="sales-menu-delete" onClick={() => { setDeleting(debt); setMenuId(null); }}>Eliminar deuda</button></div></>}</td></tr>;
      })}</tbody></table></div> : <div className="debt-empty"><DebtIcon name="alert"/><strong>{loanDebts.length ? "No hay préstamos con este filtro" : "Aún no has recibido préstamos"}</strong><span>Registra el dinero recibido de una persona o entidad para ver su saldo e historial.</span></div>}
      <div className="debts-footer"><span>{filteredDebts.length} de {loanDebts.length} préstamos</span><span><i/> Los saldos se actualizan con cada abono</span></div>
    </section>

    {activeEditing && <DebtModal key={activeEditing.id || "new-debt"} debt={activeEditing.id ? activeEditing : null} onClose={() => { setEditing(null); if (requestedEditDebt) onRequestedEditHandled(); }} onSave={saveDebt}/>}
    {paying && <DebtPaymentModal debt={paying} availableCapital={availableCapital} onClose={() => setPaying(null)} onSave={payDebt}/>}
    {history && <DebtHistoryModal debt={history} onClose={() => setHistory(null)}/>}
    {deleting && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleting(null); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="delete-debt-title"><div className="modal-header"><div><span className="eyebrow">CONFIRMAR ACCIÓN</span><h2 id="delete-debt-title">Eliminar deuda</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => setDeleting(null)}><DebtIcon name="close"/></button></div><p className="delete-copy">Se eliminará la deuda de <strong>{deleting.creditor}</strong> y sus abonos vinculados. El capital, los movimientos y el saldo pendiente se recalcularán.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleting(null)}>Cancelar</button><button className="button delete-confirm" onClick={() => { onDelete(deleting.id); setDeleting(null); }}>Eliminar deuda</button></div></section></div>}
    {error && <div className="toast" role="status"><span>!</span>{error}<button onClick={() => setError("")}>Cerrar</button></div>}
  </>;
}

function DebtStat({ title, value, note, tone }: { title: string; value: string; note: string; tone: string }) {
  return <div className="section-stat debt-stat"><span className={`section-stat-icon debt-stat-icon ${tone}`}><DebtIcon name={tone === "green" ? "cash" : "alert"}/></span><span>{title}</span><strong>{value}</strong><small>{note}</small></div>;
}

function DebtModal({ debt, onClose, onSave }: { debt: DebtRecord | null; onClose: () => void; onSave: (draft: DebtDraft) => string | null }) {
  const [creditor, setCreditor] = useState(debt?.creditor ?? ""); const [concept, setConcept] = useState(debt?.concept ?? ""); const kind: DebtKind = "Préstamo recibido"; const [amount, setAmount] = useState(debt?.amount ?? 0); const [date, setDate] = useState(debt?.date ?? localDate()); const [dueDate, setDueDate] = useState(debt?.dueDate ?? ""); const [observations, setObservations] = useState(debt?.observations ?? ""); const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!creditor.trim() || !concept.trim()) return setError("Completa el acreedor y el concepto."); if (!Number.isFinite(amount) || amount <= 0) return setError("El valor debe ser mayor que cero."); const paid = debt ? paidAmount(debt) : 0; if (amount < paid) return setError(`El total no puede ser menor que los abonos realizados (${formatCOP(paid)}).`); if (!date) return setError("Selecciona la fecha de registro."); if (dueDate && dueDate < date) return setError("La fecha límite no puede ser anterior al registro."); const result = onSave({ creditor: creditor.trim(), concept: concept.trim(), kind, amount, date, dueDate, observations: observations.trim() }); if (result) setError(result); }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal debt-modal" role="dialog" aria-modal="true" aria-labelledby="debt-modal-title"><div className="modal-header"><div><span className="eyebrow">{debt ? "ACTUALIZA EL PRÉSTAMO" : "NUEVO PRÉSTAMO"}</span><h2 id="debt-modal-title">{debt ? "Editar préstamo" : "Registrar préstamo"}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><DebtIcon name="close"/></button></div><form onSubmit={submit}><label>Acreedor o beneficiario<input autoFocus value={creditor} onChange={(event) => setCreditor(event.target.value)} maxLength={100} placeholder="Nombre de la persona o empresa"/></label><label>Concepto<input value={concept} onChange={(event) => setConcept(event.target.value)} maxLength={140} placeholder="Motivo del préstamo"/></label><div className="form-two"><label>Valor recibido<input type="number" min="1" step="1" value={amount || ""} onChange={(event) => setAmount(event.target.value === "" ? 0 : Number(event.target.value))} placeholder="0"/></label><label>Fecha del préstamo<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label></div><label>Fecha acordada de devolución<input type="date" min={date} value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label><label>Observaciones opcionales<textarea value={observations} onChange={(event) => setObservations(event.target.value)} maxLength={400} rows={3} placeholder="Notas sobre esta deuda"/></label><div className="debt-form-note">El dinero recibido aumenta el capital disponible y queda como saldo que debes devolver. Los abonos se descuentan cuando se realizan.</div>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">{debt ? "Guardar cambios" : "Guardar deuda"}</button></div></form></section></div>;
}

function DebtPaymentModal({ debt, availableCapital, onClose, onSave }: { debt: DebtRecord; availableCapital: number; onClose: () => void; onSave: (amount: number, date: string) => string | null }) {
  const [amount, setAmount] = useState(Math.min(balanceOf(debt), availableCapital)); const [date, setDate] = useState(localDate()); const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!Number.isFinite(amount) || amount <= 0 || amount > balanceOf(debt)) return setError(`El abono no puede superar el saldo de ${formatCOP(balanceOf(debt))}.`); if (amount > availableCapital) return setError(`El capital disponible es ${formatCOP(availableCapital)}.`); const result = onSave(amount, date); if (result) setError(result); }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="debt-payment-title"><div className="modal-header"><div><span className="eyebrow">PAGO REALIZADO</span><h2 id="debt-payment-title">Registrar abono</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><DebtIcon name="close"/></button></div><form onSubmit={submit}><div className="payment-balance-box"><span>Saldo pendiente de {debt.creditor}</span><strong>{formatCOP(balanceOf(debt))}</strong><small>Capital disponible: {formatCOP(availableCapital)}</small></div><label>Valor del abono<input type="number" min="1" max={Math.min(balanceOf(debt), availableCapital)} step="1" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))}/></label><label>Fecha del pago<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary">Guardar abono</button></div></form></section></div>;
}

function DebtHistoryModal({ debt, onClose }: { debt: DebtRecord; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="debt-history-title"><div className="modal-header"><div><span className="eyebrow">{debt.creditor}</span><h2 id="debt-history-title">Historial de abonos</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><DebtIcon name="close"/></button></div><div className="order-history-product"><span>Saldo actual</span><strong>{formatCOP(balanceOf(debt))}</strong></div><div className="order-payment-history">{debt.payments.length ? debt.payments.map((payment) => <div key={payment.id}><span><DebtIcon name="cash"/><span><strong>Abono realizado</strong><small>{dateLabel(payment.date)}</small></span></span><strong>{formatCOP(payment.amount)}</strong></div>) : <p className="client-balance-empty">Aún no hay pagos registrados.</p>}</div><div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Cerrar</button></div></section></div>;
}
