/* ============================================================
   calendar.js — componente de calendário reutilizável

   Uso:
     const cal = new Calendar({
       onSelectDay(iso) {...},
       getDayDots(iso) { return ['entrada','saida'] }  // cores dos pontos
     });
     container.appendChild(cal.el);
     cal.render();

   Reutilizado nas telas Financeiro e Demandas (muda só getDayDots).
   ============================================================ */
import { el, icons, meses, diasSemana, toISO, fromISO } from "./ui.js";

export class Calendar {
  constructor({ onSelectDay, getDayDots, initialDate } = {}) {
    this.onSelectDay = onSelectDay || (() => {});
    this.getDayDots = getDayDots || (() => []);
    const base = initialDate ? fromISO(initialDate) : new Date();
    this.year = base.getFullYear();
    this.month = base.getMonth();
    this.selected = toISO(base);
    this.el = el("div", { class: "calendar" });
  }

  get currentMonthLabel() {
    return `${meses[this.month]} ${this.year}`;
  }

  prev() {
    this.month--;
    if (this.month < 0) { this.month = 11; this.year--; }
    this.render();
  }
  next() {
    this.month++;
    if (this.month > 11) { this.month = 0; this.year++; }
    this.render();
  }

  select(iso) {
    this.selected = iso;
    this.render();
    this.onSelectDay(iso);
  }

  render() {
    const todayISO = toISO(new Date());
    const firstDay = new Date(this.year, this.month, 1);
    const startOffset = firstDay.getDay(); // 0=Dom
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    const daysPrev = new Date(this.year, this.month, 0).getDate();

    const head = el("div", { class: "cal-head" },
      el("div", { class: "cal-title" }, this.currentMonthLabel),
      el("div", { class: "cal-nav" },
        el("button", { class: "btn btn-icon btn-secondary", "aria-label": "Mês anterior",
          onClick: () => this.prev(), html: icons.chevronL }),
        el("button", { class: "btn btn-sm btn-ghost", onClick: () => this.goToday() }, "Hoje"),
        el("button", { class: "btn btn-icon btn-secondary", "aria-label": "Próximo mês",
          onClick: () => this.next(), html: icons.chevronR }),
      )
    );

    const grid = el("div", { class: "cal-grid" });
    diasSemana.forEach((d) => grid.appendChild(el("div", { class: "cal-dow" }, d)));

    // dias do mês anterior (preenchimento)
    for (let i = startOffset - 1; i >= 0; i--) {
      grid.appendChild(this._cell(this.year, this.month - 1, daysPrev - i, true, todayISO));
    }
    // dias do mês
    for (let d = 1; d <= daysInMonth; d++) {
      grid.appendChild(this._cell(this.year, this.month, d, false, todayISO));
    }
    // completar última semana
    const totalCells = startOffset + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= trailing; d++) {
      grid.appendChild(this._cell(this.year, this.month + 1, d, true, todayISO));
    }

    this.el.replaceChildren(head, grid);
  }

  goToday() {
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth();
    this.select(toISO(now));
  }

  _cell(year, monthIdx, day, muted, todayISO) {
    const dateObj = new Date(year, monthIdx, day);
    const iso = toISO(dateObj);
    const dots = this.getDayDots(iso) || [];
    const isToday = iso === todayISO;
    const isSelected = iso === this.selected;

    const classes = ["cal-cell"];
    if (muted) classes.push("muted");
    if (isToday) classes.push("today");
    if (isSelected) classes.push("selected");

    const cell = el("div", { class: classes.join(" "), role: "button", tabindex: "0",
        onClick: () => this.select(iso) },
      el("span", { class: "num" }, String(day)),
    );
    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.select(iso); }
    });

    if (dots.length) {
      const dotsWrap = el("div", { class: "cal-dots" });
      dots.slice(0, 4).forEach((kind) =>
        dotsWrap.appendChild(el("span", { class: `cal-dot ${kind}` })));
      cell.appendChild(dotsWrap);
    }
    return cell;
  }
}
