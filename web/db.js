// db.js
const sql = require('mssql');

// === Configuración de conexión (ZENTRIK) ===
const config = {
  user: 'sa',
  password: 'F1S4123$',
  server: '200.14.242.237',
  database: 'ZENTRIK',
  options: {
    encrypt: true, // Según .env de Retorcedoras_Prod
    trustServerCertificate: true
  }
};

// Mapeo de códigos de máquina a claves del frontend
const MACHINE_MAP = {
  'DONGTAI 1': 'dt1',
  'DONGTAI 2': 'dt2',
  'DONGTAI 3': 'dt3',
  'DONGTAI 4': 'dt4',
  'DONGTAI 5': 'dt5',
  'DONGTAI 6': 'dt6'
};

// Helper para obtener la hora actual de Perú como "Face Value" en UTC.
function getNowFaceValue() {
  const s = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Lima',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(', ', 'T');
  return new Date(s + 'Z');
}

// Helper para obtener datos de programación activa
async function getActivePrograms(pool) {
  const nowFace = getNowFaceValue();

  // Trae la programación activa (o la siguiente inmediata) para cada máquina/lado
  // Se une con TITULOS para nombre producto y VIEW_PRD_SCADA005 para requerimiento
  const query = `
    WITH CTE_Progs AS (
      SELECT 
        p.programacion_id,
        p.maquina_id,
        p.lado_id,
        p.otcod,
        p.titulo_id,
        m.codigo AS maquina_codigo,
        l.nombre AS lado_nombre,
        t.nombre AS producto_nombre,
        v.canreq,
        -- Ordenamos por fecha de inicio ASC para tomar la más próxima (o la actual)
        ROW_NUMBER() OVER (PARTITION BY p.maquina_id, p.lado_id ORDER BY MIN(pd.fh_inicio_plan) ASC) as rn
      FROM dbo.RET_DGT_PROGRAMACIONES p
      JOIN dbo.RET_DGT_MAQUINAS m ON m.maquina_id = p.maquina_id
      JOIN dbo.RET_DGT_LADOS l    ON l.lado_id = p.lado_id
      JOIN dbo.RET_DGT_TITULOS t  ON t.titulo_id = p.titulo_id
      JOIN dbo.RET_DGT_PLAN_DESCARGAS pd ON pd.programacion_id = p.programacion_id
      LEFT JOIN Medidores_2023.dbo.VIEW_PRD_SCADA005 v ON v.otcod = p.otcod
      GROUP BY 
        p.programacion_id, p.maquina_id, p.lado_id, p.otcod, p.titulo_id,
        m.codigo, l.nombre, t.nombre, v.canreq
      HAVING MAX(pd.fh_fin_plan) > @now
    )
    SELECT * FROM CTE_Progs WHERE rn = 1;
  `;
  const result = await pool.request()
    .input('now', sql.DateTime, nowFace)
    .query(query);
  return result.recordset;
}

// Helper para obtener detalles del plan (tiempos)
async function getPlanDetails(pool, programacion_id) {
  const query = `
    SELECT 
      plan_descarga_id,
      secuencia,
      fh_inicio_plan,
      fh_fin_plan
    FROM dbo.RET_DGT_PLAN_DESCARGAS
    WHERE programacion_id = @progId
    ORDER BY secuencia ASC
  `;
  const result = await pool.request()
    .input('progId', sql.Int, programacion_id)
    .query(query);
  return result.recordset;
}

async function readSQL1() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    const programs = await getActivePrograms(pool);

    // Estructura de salida inicial vacía
    const output = {
      dt1: [], dt1req: [],
      dt2: [], dt2req: [],
      dt3: [], dt3req: [],
      dt4: [], dt4req: [],
      dt5: [], dt5req: [],
      dt6: [], dt6req: [],
      ret_sql: [] // No usado en lógica nueva, se deja vacío o se simula
    };

    // Llenar datos
    for (const prog of programs) {
      const key = MACHINE_MAP[prog.maquina_codigo];
      if (!key) continue;

      // Solo nos interesa LADO A para la info principal (OT, Producto) 
      // o si la lógica original mostraba info combinada.
      // El frontend original parece mostrar 1 OT por máquina (asume misma OT en ambos lados o prioriza uno).
      // Vamos a usar LADO A (lado_id=1 usualmente, o nombre='A') como principal para el encabezado.

      if (prog.lado_nombre === 'A' || prog.lado_nombre === 'LADO A') {
        output[key] = [{
          ctcod: 'Ret-xx-xx', // Dummy, no se usa en renderer
          otcod: prog.otcod,
          pronom: prog.producto_nombre
        }];
        output[`${key}req`] = [{
          canreq: prog.canreq
        }];
      }
    }

    return output;
  } catch (err) {
    console.error("[DB] Error en readSQL1:", err);
    return {};
  } finally {
    await pool.close();
  }
}

async function readSQL2() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    const programs = await getActivePrograms(pool);

    const output = {
      dt1ulta: [], dt1ultb: [], dt1desca: [], dt1descb: [], dt1da: [], dt1db: [],
      dt2ulta: [], dt2ultb: [], dt2desca: [], dt2descb: [], dt2da: [], dt2db: [],
      dt3ulta: [], dt3ultb: [], dt3desca: [], dt3descb: [], dt3da: [], dt3db: [],
      dt4ulta: [], dt4ultb: [], dt4desca: [], dt4descb: [], dt4da: [], dt4db: [],
      dt5ulta: [], dt5ultb: [], dt5desca: [], dt5descb: [], dt5da: [], dt5db: [],
      dt6ulta: [], dt6ultb: [], dt6desca: [], dt6descb: [], dt6da: [], dt6db: []
    };

    const now = getNowFaceValue();

    for (const prog of programs) {
      const key = MACHINE_MAP[prog.maquina_codigo];
      if (!key) continue;

      const plan = await getPlanDetails(pool, prog.programacion_id);
      if (!plan.length) continue;

      // 1. Próxima Carga (Fin del programa) -> dtXulta / dtXultb
      // El frontend espera: [{ fechafin_A: ISOString }]
      const lastDescarga = plan[plan.length - 1];
      const finPrograma = lastDescarga.fh_fin_plan; // Date

      // 2. Descarga Actual -> dtXdesca / dtXdescb
      // Buscar la secuencia donde NOW está entre inicio y fin
      const current = plan.find(p => p.fh_inicio_plan <= now && p.fh_fin_plan > now);
      // Si no hay actual (estamos antes o después), null

      // 3. Próxima Descarga -> dtXda / dtXdb
      // Es el FIN de la descarga actual (o el inicio de la siguiente si no hay actual?)
      // El frontend usa 'fecha_A' de este campo para mostrar la hora.
      // Si hay current, es current.fh_fin_plan.
      // Si no, buscamos la primera futura.
      const next = current ? current : plan.find(p => p.fh_inicio_plan > now);

      const suffix = (prog.lado_nombre === 'A' || prog.lado_nombre === 'LADO A') ? 'a' : 'b'; // 'a' o 'b'
      const sideKey = (prog.lado_nombre === 'A' || prog.lado_nombre === 'LADO A') ? 'A' : 'B';

      // Mapeo a estructura antigua

      // PROX CARGA (Ahora muestra la SIGUIENTE descarga, igual que PROX DESCARGA)
      // Antes mostraba finPrograma. El usuario pidió que muestre lo mismo que prox descarga.
      output[`${key}ult${suffix}`] = [{
        [`fechafin_${sideKey}`]: next ? next.fh_fin_plan : finPrograma
      }];

      // DESCARGA ACTUAL
      if (current) {
        output[`${key}desc${suffix}`] = [{
          [`num_${sideKey}`]: current.secuencia,
          [`fecha_${sideKey}`]: current.fh_inicio_plan // Solo para cumplir estructura, no se muestra
        }];
      }

      // PROX DESCARGA (Hora fin de la actual o inicio de la siguiente)
      if (next) {
        // Si es current, mostramos su fin. Si es futura, mostramos su fin (o inicio? renderer dice PROX DESCARGA)
        // Renderer: "PROX. DESCARGA" -> muestra fecha_A.
        // Si estoy en la descarga 5, la "próxima descarga" (el evento de sacar la bobina) ocurre al final de la 5.
        // Entonces usamos fh_fin_plan.
        output[`${key}d${suffix}`] = [{
          [`fecha_${sideKey}`]: next.fh_fin_plan
        }];
      }
    }

    return output;

  } catch (err) {
    console.error("[DB] Error en readSQL2:", err);
    return {};
  } finally {
    await pool.close();
  }
}

module.exports = { readSQL1, readSQL2 };
