// renderer.js – Tablero Retorcidos (Web) – OOP
// ═══════════════════════════════════════════════════
//  Clases: ClockManager, SettingsModal, MachinePanel,
//          SocketManager, App
// ═══════════════════════════════════════════════════

// ── Helpers DOM ──
const $ = id => document.getElementById(id);
const emptyIf = v => (v === null || v === undefined || v === '') ? '-' : v;
function setTxt(id, txt) {
  const el = $(id);
  if (el) el.innerText = emptyIf(txt);
}

// ═══════════════════════════════════════════════════
//  ClockManager – Reloj de la cabecera
// ═══════════════════════════════════════════════════
class ClockManager {
  constructor(elementId) {
    this._el = $(elementId);
    this._intervalId = null;
  }

  start() {
    this._update();
    this._intervalId = setInterval(() => this._update(), 1000);
  }

  _update() {
    if (!this._el) return;
    const now = new Date().toLocaleString('es-PE', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).replace(',', '');
    this._el.innerText = now;
  }
}

// ═══════════════════════════════════════════════════
//  SettingsModal – Modal de configuración de máquinas
// ═══════════════════════════════════════════════════
class SettingsModal {
  constructor(machines, onSave) {
    this._machines = machines;
    this._onSave = onSave;
    this._modal = $('settings-modal');
    this._list = $('machines-list');
    this._selectedMachines = JSON.parse(localStorage.getItem('selectedMachines'))
      || machines.map(m => m.key);

    this._bindEvents();
  }

  getSelectedMachines() {
    return this._selectedMachines;
  }

  _bindEvents() {
    const btn = $('settings-btn');
    const closeSpan = document.querySelector('.close-btn');
    const saveBtn = $('save-settings-btn');

    if (btn) {
      btn.onclick = () => {
        this._modal.style.display = 'block';
        this._renderCheckboxes();
      };
    }

    if (closeSpan) closeSpan.onclick = () => this._modal.style.display = 'none';

    window.onclick = (event) => {
      if (event.target === this._modal) this._modal.style.display = 'none';
    };

    if (saveBtn) {
      saveBtn.onclick = () => {
        const checkboxes = this._list.querySelectorAll('input[type="checkbox"]');
        this._selectedMachines = [];
        checkboxes.forEach(cb => {
          if (cb.checked) this._selectedMachines.push(cb.value);
        });

        localStorage.setItem('selectedMachines', JSON.stringify(this._selectedMachines));
        this._modal.style.display = 'none';
        if (this._onSave) this._onSave(this._selectedMachines);
      };
    }
  }

  _renderCheckboxes() {
    this._list.innerHTML = '';
    this._machines.forEach(({ key, label }) => {
      const isChecked = this._selectedMachines.includes(key) ? 'checked' : '';
      const html = `
        <label class="machine-option">
          <input type="checkbox" value="${key}" ${isChecked}>
          ${label}
        </label>
      `;
      this._list.insertAdjacentHTML('beforeend', html);
    });
  }
}

// ═══════════════════════════════════════════════════
//  MachinePanel – Representa un panel individual
// ═══════════════════════════════════════════════════
class MachinePanel {

  // Mapeo de colores por producto (estático, compartido)
  static COLOR_MAP = {
    '9 NY': { bg: '#7B0000', fg: '#F5F5F5' },
    '12 NY': { bg: '#6a6a6a', fg: '#F5F5F5' },
    '15 NY': { bg: '#FFFF00', fg: '#000000' },
    '18 NY': { bg: '#24a124', fg: '#F5F5F5' },
    '21 NY': { bg: '#0000A5', fg: '#F5F5F5' },
    '24 NY': { bg: '#5F3300', fg: '#F5F5F5' },
    '27 NY': { bg: '#32CD32', fg: '#000000' },
    '30 NY': { bg: '#4B0082', fg: '#F5F5F5' },
    '33 NY': { bg: '#FF8C00', fg: '#F5F5F5' },
    '36 NY': { bg: '#FFFFFF', fg: '#000000' },
    '42 NY': { bg: '#6a6a6a', fg: '#F5F5F5' },
    '48 NY': { bg: '#24a124', fg: '#F5F5F5' },
    '72 NY': { bg: '#6a6a6a', fg: '#F5F5F5' },
    '84 NY': { bg: '#5F3300', fg: '#F5F5F5' },
    '96 NY': { bg: '#FFFFFF', fg: '#000000' },
    '108 NY': { bg: '#24a124', fg: '#F5F5F5' },
    '72 PS': { bg: '#FFFFFF', fg: '#000000' },
    '120 PS': { bg: '#FFFFFF', fg: '#000000' }
  };

  constructor(key) {
    this._key = key;
    this._stopStart = null; // timestamp de inicio de parada

    // Restaurar timer persistido
    const saved = localStorage.getItem(`stopTime_${key}`);
    if (saved) this._stopStart = parseInt(saved, 10);
  }

  /**
   * Aplica el estado visual inicial desde localStorage.
   * Debe llamarse DESPUÉS de inyectar el HTML del panel.
   */
  initState() {
    const pnl = $(`pn${this._key}`);
    const lbl = $(`${this._key}-rest`);
    if (!pnl || !lbl) return;

    if (this._stopStart) {
      pnl.classList.add('stopped');
      lbl.style.display = 'block';
    } else {
      pnl.classList.remove('stopped');
      lbl.style.display = 'none';
      lbl.innerText = '-';
    }
  }

  // ── Visibilidad ──

  setVisibility(visible) {
    const panel = $(`pn${this._key}`);
    if (panel) panel.style.display = visible ? 'block' : 'none';
  }

  // ── Estado parado / andando ──

  setState(rest) {
    const pnl = $(`pn${this._key}`);
    const lbl = $(`${this._key}-rest`);
    if (!pnl || !lbl) return;

    if (rest <= 0) {
      // Máquina parada
      if (!this._stopStart) {
        this._stopStart = Date.now();
        localStorage.setItem(`stopTime_${this._key}`, this._stopStart);
      }
      pnl.classList.add('stopped');
      lbl.style.display = 'block';
    } else {
      // Máquina andando
      localStorage.removeItem(`stopTime_${this._key}`);
      this._stopStart = null;
      pnl.classList.remove('stopped');
      lbl.style.display = 'none';
      lbl.innerText = '-';
    }
  }

  updateStopTimer() {
    if (!this._stopStart) return;
    const lbl = $(`${this._key}-rest`);
    if (!lbl) return;

    const ms = Date.now() - this._stopStart;
    const totalSeconds = Math.floor(ms / 1000);
    const totalHours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      lbl.innerText = `${days}d ${hours}h ${minutes}m`;
    } else if (totalHours > 0) {
      lbl.innerText = `${totalHours}h ${minutes}m`;
    } else {
      lbl.innerText = `${minutes}m`;
    }
  }

  // ── Datos principales (OT, producto, cantidad R/P) ──

  fillMain(sql1Data) {
    const row = sql1Data[this._key]?.[0];
    const req = sql1Data[`${this._key}req`]?.[0];

    if (row) {
      setTxt(`lbl${this._key}ot`, row.otcod?.trim());
      setTxt(`lbl${this._key}prod`, row.pronom);
      this._applyProductColor(row.pronom);
    }

    const reqEl = $(`lbl${this._key}req`);
    if (reqEl) {
      if (req) {
        const r = parseFloat(req.canreq) || 0;
        const p = parseFloat(req.pesoneto) || 0;
        const diff = r - p;
        reqEl.innerHTML = `R: ${r.toFixed(2)} KGS<br>P: ${p.toFixed(2)}&nbsp;/&nbsp;${diff.toFixed(2)}`;
      } else {
        reqEl.innerHTML = '-';
      }
    }
  }

  // ── Datos de detalle (cargas, descargas) ──

  fillDetail(sql2Data) {
    const key = this._key;

    // PROX. CARGA
    const cA = MachinePanel._formatDate(sql2Data[`${key}ulta`]?.[0]?.fechafin_A);
    const cB = MachinePanel._formatDate(sql2Data[`${key}ultb`]?.[0]?.fechafin_B);
    const proxCargaEl = $(`${key}-prox-carga-data`);
    if (proxCargaEl) {
      proxCargaEl.innerHTML = (cA || cB) ? `A: ${cA || '-'}<br>B: ${cB || '-'}` : '-';
    }

    // DESCARGA ACTUAL
    const dA = sql2Data[`${key}desca`]?.[0]?.num_A;
    const dB = sql2Data[`${key}descb`]?.[0]?.num_B;
    const descActualEl = $(`${key}-descarga-actual-data`);
    if (descActualEl) {
      descActualEl.innerHTML = (dA != null || dB != null)
        ? MachinePanel._formatInline(dA, dB) : '-';
    }

    // PROX. DESCARGA
    const pA = MachinePanel._formatDate(sql2Data[`${key}da`]?.[0]?.fecha_A);
    const pB = MachinePanel._formatDate(sql2Data[`${key}db`]?.[0]?.fecha_B);
    const proxDescEl = $(`${key}-prox-descarga-data`);
    if (proxDescEl) {
      if (!pA && !pB) {
        proxDescEl.innerHTML = '-';
      } else {
        let html = `A: ${pA || '-'}`;
        if (pB) html += `<br>B: ${pB}`;
        proxDescEl.innerHTML = html;
      }
    }
  }

  // ── Helpers privados ──

  _applyProductColor(productName) {
    const el = $(`lbl${this._key}prod`);
    const code = MachinePanel._extractCode(productName);
    if (!el || !MachinePanel.COLOR_MAP[code]) return;
    const { bg, fg } = MachinePanel.COLOR_MAP[code];
    el.style.backgroundColor = bg;
    el.style.color = fg;
    el.style.padding = '2px 6px';
    el.style.borderRadius = '4px';
  }

  static _extractCode(name) {
    const nums = name?.match(/\d+/g);
    return nums ? `${nums[nums.length - 1]} NY` : '';
  }

  static _formatDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }

  static _formatInline(A, B) {
    const a = (A != null) ? `A: ${A}` : '-';
    const b = (B != null) ? `B: ${B}` : '';
    return `${a}&emsp;${b}`;
  }
}

// ═══════════════════════════════════════════════════
//  SocketManager – Conecta Socket.IO y despacha datos
// ═══════════════════════════════════════════════════
class SocketManager {
  constructor(panels) {
    this._panels = panels; // Map<key, MachinePanel>
    this._socket = io();
    this._isFirstModbus = true; // Ignora la 1ra lectura (falso positivo tras restart)
    this._bind();
  }

  _bind() {
    this._socket.on('modbus-data', (data) => {
      // Ignorar la primera lectura Modbus tras un restart del servidor
      // porque calcula rest = current - 0 = número grande (falso positivo)
      if (this._isFirstModbus) {
        this._isFirstModbus = false;
        return;
      }
      this._panels.forEach((panel, key) => {
        panel.setState(data[`${key}_rest`]);
      });
    });

    this._socket.on('sql-data', ({ sql1 = {}, sql2 = {} }) => {
      this._panels.forEach((panel) => {
        panel.fillMain(sql1);
        panel.fillDetail(sql2);
      });
    });
  }
}

// ═══════════════════════════════════════════════════
//  App – Clase principal (punto de entrada)
// ═══════════════════════════════════════════════════
class App {
  constructor() {
    this._machinesConfig = [
      { key: 'dt1', label: 'DONGTAI 1' },
      { key: 'dt2', label: 'DONGTAI 2' },
      { key: 'dt3', label: 'DONGTAI 3' },
      { key: 'dt4', label: 'DONGTAI 4' },
      { key: 'dt5', label: 'DONGTAI 5' },
      { key: 'dt6', label: 'DONGTAI 6' }
    ];

    this._panels = new Map();  // key → MachinePanel
    this._clock = null;
    this._settings = null;
    this._socketManager = null;
  }

  init() {
    // 1. Inyectar plantillas HTML
    this._injectPanels();

    // 2. Marcar tipos de sub-cuadro
    this._markSubBoxTypes();

    // 3. Crear objetos MachinePanel
    this._machinesConfig.forEach(({ key }) => {
      const panel = new MachinePanel(key);
      panel.initState();  // ← Aplica estado parado/andando desde localStorage
      this._panels.set(key, panel);
    });

    // 4. Reloj
    this._clock = new ClockManager('date-label');
    this._clock.start();

    // 5. Modal de configuración
    this._settings = new SettingsModal(this._machinesConfig, (selected) => {
      this._updateVisibility(selected);
    });
    this._updateVisibility(this._settings.getSelectedMachines());

    // 6. Timer de parada (cada segundo)
    setInterval(() => {
      this._panels.forEach(panel => panel.updateStopTimer());
    }, 1000);

    // 7. Socket.IO
    this._socketManager = new SocketManager(this._panels);
  }

  _injectPanels() {
    const container = $('machines-container');
    const template = $('machine-template').innerHTML;
    this._machinesConfig.forEach(({ key, label }) => {
      const html = template
        .replace(/\{key\}/g, key)
        .replace(/\{label\}/g, label);
      container.insertAdjacentHTML('beforeend', html);
    });
  }

  _markSubBoxTypes() {
    document.querySelectorAll('.sub-box-labeled').forEach(el => {
      const t = el.querySelector('.sub-box-title')?.textContent.trim().toUpperCase();
      if (t === 'PROX. CARGA') el.classList.add('prox-carga');
      else if (t === 'DESCARGA ACTUAL') el.classList.add('descarga-actual');
      else if (t === 'PROX. DESCARGA') el.classList.add('prox-descarga');
    });
  }

  _updateVisibility(selectedKeys) {
    this._panels.forEach((panel, key) => {
      panel.setVisibility(selectedKeys.includes(key));
    });
  }
}

// ── Arrancar la aplicación ──
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
