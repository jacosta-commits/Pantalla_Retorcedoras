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
      this._applyProductColor(row.pronom, row.color);
    } else {
      setTxt(`lbl${this._key}ot`, '-');
      setTxt(`lbl${this._key}prod`, '-');
      const prodEl = $(`lbl${this._key}prod`);
      if (prodEl) {
        prodEl.style.backgroundColor = 'transparent';
        prodEl.style.color = 'inherit';
      }
    }

    const reqEl = $(`lbl${this._key}req`);
    if (reqEl) {
      if (req) {
        const r = parseFloat(req.canreq) || 0;
        const p = parseFloat(req.pesoneto) || 0;
        const diff = r - p;
        reqEl.innerHTML = `REQ: ${r.toFixed(2)} KGS<div class="pend-line">PEND: ${diff.toFixed(2)} KGS</div>`;
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
    const tA = sql2Data[`${key}desca`]?.[0]?.total_A;
    const dB = sql2Data[`${key}descb`]?.[0]?.num_B;
    const tB = sql2Data[`${key}descb`]?.[0]?.total_B;

    const descActualEl = $(`${key}-descarga-actual-data`);
    if (descActualEl) {
      descActualEl.innerHTML = MachinePanel._formatInline(dA, tA, dB, tB);
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

    // Guardar fechas para cálculo de alerta global
    this._nextLoadDates = {
      a: sql2Data[`${key}ulta`]?.[0]?.fechafin_A,
      b: sql2Data[`${key}ultb`]?.[0]?.fechafin_B
    };
  }

  getNextLoadTimes() {
    const times = [];
    if (this._nextLoadDates?.a) times.push(new Date(this._nextLoadDates.a));
    if (this._nextLoadDates?.b) times.push(new Date(this._nextLoadDates.b));
    return times;
  }

  setBlinking(active) {
    const el = $(`${this._key}-prox-carga-data`)?.parentElement;
    if (el && el.classList.contains('prox-carga')) {
      if (active) el.classList.add('alert-blink');
      else el.classList.remove('alert-blink');
    }
  }

  // ── Helpers privados ──

  _applyProductColor(productName, dbColor) {
    const el = $(`lbl${this._key}prod`);
    if (!el) return;

    let bg = 'transparent'; // default fallback for new titles without color yet
    let fg = '#F5F5F5';

    if (dbColor) {
      bg = dbColor;
      fg = this._getContrastColor(dbColor);
    } else {
      const code = MachinePanel._extractCode(productName);
      if (MachinePanel.COLOR_MAP[code]) {
        bg = MachinePanel.COLOR_MAP[code].bg;
        fg = MachinePanel.COLOR_MAP[code].fg;
      }
    }

    el.style.backgroundColor = bg;
    el.style.color = fg;
    el.style.padding = '2px 6px';
    el.style.borderRadius = '4px';
  }

  _getContrastColor(hexcolor) {
    if (!hexcolor) return '#000000';
    hexcolor = hexcolor.replace('#', '');
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
    var r = parseInt(hexcolor.substr(0, 2), 16);
    var g = parseInt(hexcolor.substr(2, 2), 16);
    var b = parseInt(hexcolor.substr(4, 2), 16);
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
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

  static _formatInline(A, totalA, B, totalB) {
    const a = (totalA > 0) ? `A: ${A} / ${totalA}` : '-';
    const b = (totalB > 0) ? `B: ${B} / ${totalB}` : '';
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
      this._updateAlerts();
    });
  }

  _updateAlerts() {
    const alertThresholdMs = 2 * 60 * 60 * 1000; // 2 horas en ms
    const clashingKeys = new Set();
    const allMachineData = [];

    // 1. Recolectar todos los tiempos de todas las máquinas
    this._panels.forEach((panel, key) => {
      const times = panel.getNextLoadTimes();
      times.forEach(t => allMachineData.push({ key, time: t.getTime() }));
    });

    // 2. Comparar cada par de máquinas diferentes
    for (let i = 0; i < allMachineData.length; i++) {
      for (let j = i + 1; j < allMachineData.length; j++) {
        const m1 = allMachineData[i];
        const m2 = allMachineData[j];

        // Solo comparar si son máquinas distintas
        if (m1.key !== m2.key) {
          const diff = Math.abs(m1.time - m2.time);
          if (diff <= alertThresholdMs) {
            clashingKeys.add(m1.key);
            clashingKeys.add(m2.key);
          }
        }
      }
    }

    // 3. Aplicar el parpadeo
    this._panels.forEach((panel, key) => {
      panel.setBlinking(clashingKeys.has(key));
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
