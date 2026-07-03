/* ============================================================
   store.js — Camada de dados (fonte única de verdade)

   Duas fontes, escolhidas em tempo de execução:
   - Supabase (quando NEXOS_CONFIG.USE_SUPABASE === true)
   - localStorage (fallback padrão)

   As telas não sabem qual está ativa: a API é a mesma e os
   métodos são assíncronos. Toda escrita dispara `store:changed`.
   ============================================================ */
import { uid, fromISO, toISO } from "./ui.js";
import { supa, supaEnabled } from "./db.js";

const KEYS = {
  transactions: "nexos.transactions",
  demandas: "nexos.demandas",
};

/* ---- localStorage helpers ---- */
function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  emitChanged(key);
}
function emitChanged(key) {
  window.dispatchEvent(new CustomEvent("store:changed", { detail: { key } }));
}

/* ---- Mapeamento Supabase (snake_case) <-> app (camelCase) ---- */
function fromRowTx(r) {
  return {
    id: r.id, type: r.type, title: r.title, description: r.description || "",
    date: r.date, amount: r.amount, recurring: !!r.recurring,
    recurringDay: r.recurring_day, attachment: r.attachment || null,
    createdAt: r.created_at,
  };
}
function txRow(d, { forInsert = false } = {}) {
  const r = {};
  const set = (k, v) => { if (v !== undefined) r[k] = v; };
  set("type", d.type === "entrada" ? "entrada" : (d.type === "saida" ? "saida" : undefined));
  set("title", d.title);
  set("description", d.description);
  set("date", d.date);
  set("amount", d.amount);
  if (d.recurring !== undefined) {
    r.recurring = !!d.recurring;
    r.recurring_day = d.recurring ? fromISO(d.date || d._date).getDate() : null;
  }
  if ("attachment" in d) r.attachment = d.attachment || null;
  if (forInsert) {
    if (r.type === undefined) r.type = "saida";
    if (r.description === undefined) r.description = "";
    if (r.recurring === undefined) { r.recurring = false; r.recurring_day = null; }
  }
  return r;
}
function fromRowDem(r) {
  const start = r.date_start || r.date || null;   // r.date = compat com esquema antigo
  const end = r.date_end || start;
  return {
    id: r.id, title: r.title, description: r.description || "",
    dateStart: start, dateEnd: end,
    amount: r.amount || 0, status: r.status, attachment: r.attachment || null,
    createdAt: r.created_at,
  };
}
function demRow(d, { forInsert = false } = {}) {
  const r = {};
  for (const k of ["title", "description", "amount", "status", "attachment"])
    if (k in d) r[k] = d[k];
  if ("dateStart" in d) r.date_start = d.dateStart;
  if ("dateEnd" in d) r.date_end = d.dateEnd || d.dateStart || null;
  if (forInsert) {
    if (r.description === undefined) r.description = "";
    if (r.amount === undefined) r.amount = 0;
    if (r.status === undefined) r.status = "nao_iniciada";
    if (r.date_end === undefined && r.date_start !== undefined) r.date_end = r.date_start;
  }
  return r;
}
/* Normaliza demandas antigas (campo `date`) para dateStart/dateEnd */
function normalizeDem(d) {
  return { ...d, dateStart: d.dateStart || d.date, dateEnd: d.dateEnd || d.dateStart || d.date };
}

/* ---------------- Transactions (entradas/saídas) ---------------- */
export const Transactions = {
  async all() {
    if (supaEnabled()) {
      const { data, error } = await supa().from("transactions").select("*").order("date", { ascending: true });
      if (error) { console.error("[store] transactions.all", error); return []; }
      return data.map(fromRowTx);
    }
    return read(KEYS.transactions);
  },

  async create(data) {
    if (supaEnabled()) {
      const { data: ins, error } = await supa().from("transactions").insert(txRow(data, { forInsert: true })).select().single();
      if (error) throw new Error(error.message);
      emitChanged("transactions");
      return fromRowTx(ins);
    }
    const list = read(KEYS.transactions);
    const item = {
      id: uid(),
      type: data.type === "entrada" ? "entrada" : "saida",
      title: data.title,
      description: data.description || "",
      date: data.date,
      amount: data.amount,
      recurring: !!data.recurring,
      recurringDay: data.recurring ? fromISO(data.date).getDate() : null,
      attachment: data.attachment || null,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    write(KEYS.transactions, list);
    return item;
  },

  async update(id, data) {
    if (supaEnabled()) {
      const { error } = await supa().from("transactions").update(txRow(data)).eq("id", id);
      if (error) throw new Error(error.message);
      emitChanged("transactions");
      return true;
    }
    const list = read(KEYS.transactions);
    const i = list.findIndex((t) => t.id === id);
    if (i === -1) return null;
    list[i] = {
      ...list[i], ...data,
      recurringDay: data.recurring ? fromISO(data.date || list[i].date).getDate() : null,
    };
    write(KEYS.transactions, list);
    return list[i];
  },

  async remove(id) {
    if (supaEnabled()) {
      const { error } = await supa().from("transactions").delete().eq("id", id);
      if (error) throw new Error(error.message);
      emitChanged("transactions");
      return;
    }
    write(KEYS.transactions, read(KEYS.transactions).filter((t) => t.id !== id));
  },
};

/* ---------------- Demandas ---------------- */
export const Demandas = {
  async all() {
    if (supaEnabled()) {
      const { data, error } = await supa().from("demandas").select("*").order("date_start", { ascending: true });
      if (error) { console.error("[store] demandas.all", error); return []; }
      return data.map(fromRowDem);
    }
    return read(KEYS.demandas).map(normalizeDem);
  },

  async create(data) {
    if (supaEnabled()) {
      const { data: ins, error } = await supa().from("demandas").insert(demRow(data, { forInsert: true })).select().single();
      if (error) throw new Error(error.message);
      emitChanged("demandas");
      return fromRowDem(ins);
    }
    const list = read(KEYS.demandas);
    const item = {
      id: uid(), title: data.title, description: data.description || "",
      dateStart: data.dateStart, dateEnd: data.dateEnd || data.dateStart,
      amount: data.amount || 0,
      status: data.status || "nao_iniciada", attachment: data.attachment || null,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    write(KEYS.demandas, list);
    return item;
  },

  async update(id, data) {
    if (supaEnabled()) {
      const { error } = await supa().from("demandas").update(demRow(data)).eq("id", id);
      if (error) throw new Error(error.message);
      emitChanged("demandas");
      return true;
    }
    const list = read(KEYS.demandas);
    const i = list.findIndex((d) => d.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...data };
    write(KEYS.demandas, list);
    return list[i];
  },

  async setStatus(id, status) { return this.update(id, { status }); },

  async remove(id) {
    if (supaEnabled()) {
      const { error } = await supa().from("demandas").delete().eq("id", id);
      if (error) throw new Error(error.message);
      emitChanged("demandas");
      return;
    }
    write(KEYS.demandas, read(KEYS.demandas).filter((d) => d.id !== id));
  },
};

/* ---------------- Configurações (modelo de contrato etc.) ---------------- */
const SETTINGS_KEY = "nexos.settings";
export const Settings = {
  async get(key, def = null) {
    if (supaEnabled()) {
      const { data, error } = await supa().from("settings").select("value").eq("key", key).maybeSingle();
      if (error) { console.error("[store] settings.get", error); return def; }
      return data ? data.value : def;
    }
    try { const v = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; return key in v ? v[key] : def; }
    catch { return def; }
  },
  async set(key, value) {
    if (supaEnabled()) {
      const { error } = await supa().from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      emitChanged("settings");
      return;
    }
    let v = {};
    try { v = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch {}
    v[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(v));
    emitChanged(SETTINGS_KEY);
  },
};

/* ============================================================
   Projeção de recorrências (puro — independe da fonte de dados)
   ============================================================ */
function lastDayOfMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}
function occurrenceISO(tx, year, monthIdx) {
  const day = Math.min(tx.recurringDay, lastDayOfMonth(year, monthIdx));
  return toISO(new Date(year, monthIdx, day));
}

export function occurrencesForMonth(transactions, year, monthIdx) {
  const out = [];
  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd = new Date(year, monthIdx + 1, 0);
  for (const tx of transactions) {
    if (tx.recurring) {
      const start = fromISO(tx.date);
      if (start <= monthEnd) {
        out.push({ ...tx, date: occurrenceISO(tx, year, monthIdx), _projected: true, _sourceId: tx.id });
      }
    } else {
      const d = fromISO(tx.date);
      if (d >= monthStart && d <= monthEnd) out.push({ ...tx, _sourceId: tx.id });
    }
  }
  return out;
}

export function occurrencesOnDate(transactions, iso) {
  const d = fromISO(iso);
  return occurrencesForMonth(transactions, d.getFullYear(), d.getMonth())
    .filter((o) => o.date === iso);
}

export function monthlyTotals(transactions, year, monthIdx) {
  const occ = occurrencesForMonth(transactions, year, monthIdx);
  let entradas = 0, saidas = 0;
  for (const o of occ) {
    if (o.type === "entrada") entradas += o.amount;
    else saidas += o.amount;
  }
  return { entradas, saidas, saldo: entradas - saidas, count: occ.length };
}

export function annualSeries(transactions, year) {
  const series = [];
  for (let m = 0; m < 12; m++) series.push(monthlyTotals(transactions, year, m));
  const entradas = series.reduce((s, x) => s + x.entradas, 0);
  const saidas = series.reduce((s, x) => s + x.saidas, 0);
  return { series, entradas, saidas, saldo: entradas - saidas };
}

export function dataYears(transactions) {
  const years = new Set();
  transactions.forEach((t) => years.add(fromISO(t.date).getFullYear()));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

export function readFileAsAttachment(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > 2 * 1024 * 1024) {
      return reject(new Error("Arquivo muito grande (máx. 2MB nesta fase)."));
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size });
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
