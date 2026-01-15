// renderer.js  –  tablero Retorcidos (Web)

window.addEventListener('DOMContentLoaded', () => {

  // --- 1. Configuración dinámica de máquinas ---
  const machinesConfig = [
    { key: 'dt1', label: 'DONGTAI 1' },
    { key: 'dt2', label: 'DONGTAI 2' },
    { key: 'dt3', label: 'DONGTAI 3' },
    { key: 'dt4', label: 'DONGTAI 4' },
    { key: 'dt5', label: 'DONGTAI 5' },
    { key: 'lez', label: 'LEZZENI' }
  ];

  // --- 1.1 Cargar selección guardada ---
  let selectedMachines = JSON.parse(localStorage.getItem('selectedMachines')) || machinesConfig.map(m => m.key);

  // Inyecta cada panel usando la plantilla del HTML
  const container = document.getElementById('machines-container');
  const template = document.getElementById('machine-template').innerHTML;

  machinesConfig.forEach(({ key, label }) => {
    const html = template
      .replace(/\{key\}/g, key)
      .replace(/\{label\}/g, label);
    container.insertAdjacentHTML('beforeend', html);
  });

  // Aplicar visibilidad inicial
  updateVisibility();

  // Una vez creados los paneles, arranca la lógica
  initPanelLogic(machinesConfig);
  initSettingsLogic(machinesConfig);

  function updateVisibility() {
    machinesConfig.forEach(({ key }) => {
      const panel = document.getElementById(`pn${key}`);
      if (panel) {
        if (selectedMachines.includes(key)) {
          panel.style.display = 'block';
        } else {
          panel.style.display = 'none';
        }
      }
    });
  }

  // --- Lógica del Modal de Configuración ---
  function initSettingsLogic(machines) {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const closeSpan = document.querySelector('.close-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const list = document.getElementById('machines-list');

    // Abrir modal
    if (btn) {
      btn.onclick = () => {
        modal.style.display = 'block';
        renderCheckboxes();
      };
    }

    // Cerrar modal
    if (closeSpan) closeSpan.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
      if (event.target == modal) modal.style.display = 'none';
    };

    // Renderizar checkboxes
    function renderCheckboxes() {
      list.innerHTML = '';
      machines.forEach(({ key, label }) => {
        const isChecked = selectedMachines.includes(key) ? 'checked' : '';
        const html = `
          <label class="machine-option">
            <input type="checkbox" value="${key}" ${isChecked}>
            ${label}
          </label>
        `;
        list.insertAdjacentHTML('beforeend', html);
      });
    }

    // Guardar selección
    if (saveBtn) {
      saveBtn.onclick = () => {
        const checkboxes = list.querySelectorAll('input[type="checkbox"]');
        selectedMachines = [];
        checkboxes.forEach(cb => {
          if (cb.checked) selectedMachines.push(cb.value);
        });

        localStorage.setItem('selectedMachines', JSON.stringify(selectedMachines));
        updateVisibility();
        modal.style.display = 'none';
      };
    }
  }
});


function initPanelLogic(machines) {

  // 0. Marca los tipos de sub-cuadro
  document.querySelectorAll('.sub-box-labeled').forEach(el => {
    const t = el.querySelector('.sub-box-title')?.textContent.trim().toUpperCase();
    if (t === 'PROX. CARGA') el.classList.add('prox-carga');
    else if (t === 'DESCARGA ACTUAL') el.classList.add('descarga-actual');
    else if (t === 'PROX. DESCARGA') el.classList.add('prox-descarga');
  });

  // 1. Reloj cabecera
  function updateDate() {
    const now = new Date().toLocaleString('es-PE', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).replace(',', '');
    document.getElementById('date-label').innerText = now;
  }
  updateDate();
  setInterval(updateDate, 1000);

  // 2. Helpers DOM
  const $ = id => document.getElementById(id);
  const emptyIf = v => (v === null || v === undefined || v === '') ? '-' : v;
  function setTxt(id, txt) {
    const el = $(id);
    if (el) el.innerText = emptyIf(txt);
  }

  // 3. Mapeos de color y PRODUCT_IDS (incluye dt5)
  const COLOR_MAP = {
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
  const PRODUCT_IDS = machines.reduce((acc, { key }) => {
    acc[key] = `lbl${key}prod`;
    return acc;
  }, {});

  // 4. Extrae el código "NN NY"
  function extractCode(name) {
    const nums = name?.match(/\d+/g);
    return nums ? `${nums[nums.length - 1]} NY` : '';
  }

  // 5. Pinta el fondo/texto del producto
  function applyProductColor(key, code) {
    const el = $(PRODUCT_IDS[key]);
    if (!el || !COLOR_MAP[code]) return;
    const { bg, fg } = COLOR_MAP[code];
    el.style.backgroundColor = bg;
    el.style.color = fg;
    el.style.padding = '2px 6px';
    el.style.borderRadius = '4px';
  }

  // 6. Formatea fecha ISO + offset si es necesario
  function formatDateWithOffset(val) {
    if (!val) return null;
    const d = new Date(val);
    const iso = d.toISOString();
    return iso.slice(0, 16).replace('T', ' ');
  }

  // 7. Formatea inline A/B
  function formatInline(A, B) {
    const a = (A != null) ? `A: ${A}` : '-';
    const b = (B != null) ? `B: ${B}` : '';
    return `${a}&emsp;${b}`;
  }

  // 8. STOP timers
  const stopTimers = {};
  function setPanelState(key, rest) {
    const pnl = $(`pn${key}`), lbl = $(`${key}-rest`);
    if (!pnl || !lbl) return;
    if (rest <= 0) {
      stopTimers[key] ??= Date.now();
      pnl.classList.add('stopped');
      lbl.style.display = 'block';
    } else {
      delete stopTimers[key];
      pnl.classList.remove('stopped');
      lbl.style.display = 'none';
      lbl.innerText = '-';
    }
  }
  setInterval(() => {
    for (let k in stopTimers) {
      const lbl = $(`${k}-rest`);
      if (lbl) {
        const ms = Date.now() - stopTimers[k];
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
    }
  }, 1000);


  // 9. Escucha MODBUS (Socket.io)
  // if (window.electronAPI?.onModbusData) { ... } -> Reemplazado por socket
  const socket = io();

  socket.on('modbus-data', (data) => {
    machines.forEach(({ key }) => {
      setPanelState(key, data[`${key}_rest`]);
    });
  });

  // 10. Escucha SQL (Socket.io)
  socket.on('sql-data', ({ sql1 = {}, sql2 = {} }) => {

    // Rellena OT / PROD / REQ
    function fillMain(key) {
      const row = sql1[key]?.[0],
        req = sql1[`${key}req`]?.[0];
      if (row) {
        setTxt(`lbl${key}ot`, row.otcod?.trim());
        setTxt(`lbl${key}prod`, row.pronom);
        applyProductColor(key, extractCode(row.pronom));
      }
      setTxt(`lbl${key}req`, req ? `R: ${parseFloat(req.canreq).toFixed(2)} KGS` : '-');
    }

    // Rellena sub-cuadros de detalle
    function detail(key) {
      // PROX. CARGA
      const cA = formatDateWithOffset(sql2[`${key}ulta`]?.[0]?.fechafin_A),
        cB = formatDateWithOffset(sql2[`${key}ultb`]?.[0]?.fechafin_B);
      $(`${key}-prox-carga-data`).innerHTML =
        (cA || cB) ? `A: ${cA || '-'}<br>B: ${cB || '-'}` : '-';

      // DESCARGA ACTUAL
      const dA = sql2[`${key}desca`]?.[0]?.num_A,
        dB = sql2[`${key}descb`]?.[0]?.num_A;
      $(`${key}-descarga-actual-data`).innerHTML =
        (dA != null || dB != null) ? formatInline(dA, dB) : '-';

      // PROX. DESCARGA
      const pA = formatDateWithOffset(sql2[`${key}da`]?.[0]?.fecha_A),
        pB = formatDateWithOffset(sql2[`${key}db`]?.[0]?.fecha_A);
      if (!pA && !pB) {
        $(`${key}-prox-descarga-data`).innerHTML = '-';
      } else {
        let html = `A: ${pA || '-'}`;
        if (pB) html += `<br>B: ${pB}`;
        $(`${key}-prox-descarga-data`).innerHTML = html;
      }
    }

    // Para cada máquina, ejecuta llenado
    machines.forEach(({ key }) => {
      fillMain(key);
      detail(key);
    });
  });

}
