// db.js – DatabaseService (OOP)
const sql = require('mssql');

// ═══════════════════════════════════════════════════
//  Clase DatabaseService
//  Encapsula TODA la lógica de acceso a la BD.
//  Para agregar un campo nuevo, solo modifica
//  _buildMainQuery() y _mapMainRow().
// ═══════════════════════════════════════════════════

class DatabaseService {

  constructor(config, machineMap) {
    this._config = config;
    this._machineMap = machineMap;
  }

  // ── Helpers privados ──

  _getNowFaceValue() {
    const s = new Date().toLocaleString('en-CA', {
      timeZone: 'America/Lima',
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).replace(', ', 'T');
    return new Date(s + 'Z');
  }

  // ── Consultas ──

  async _getActivePrograms(pool) {
    const nowFace = this._getNowFaceValue();
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
          t.color AS producto_color,
          v.canreq,
          p2.pesoneto,
          ROW_NUMBER() OVER (PARTITION BY p.maquina_id, p.lado_id ORDER BY MIN(pd.fh_inicio_plan) ASC) as rn
        FROM dbo.RET_DGT_PROGRAMACIONES p
        JOIN dbo.RET_DGT_MAQUINAS m ON m.maquina_id = p.maquina_id
        JOIN dbo.RET_DGT_LADOS l    ON l.lado_id = p.lado_id
        JOIN dbo.RET_DGT_TITULOS t  ON t.titulo_id = p.titulo_id
        JOIN dbo.RET_DGT_PLAN_DESCARGAS pd ON pd.programacion_id = p.programacion_id
        LEFT JOIN Medidores_2023.dbo.VIEW_PRD_SCADA005 v ON v.otcod = p.otcod
        LEFT JOIN Medidores_2023.dbo.VIEW_PRD_SCADA012 p2 ON p2.otcod = p.otcod
        GROUP BY 
          p.programacion_id, p.maquina_id, p.lado_id, p.otcod, p.titulo_id,
          m.codigo, l.nombre, t.nombre, t.color, v.canreq, p2.pesoneto
        HAVING MAX(pd.fh_fin_plan) > @now
      )
      SELECT * FROM CTE_Progs WHERE rn = 1;
    `;
    const result = await pool.request()
      .input('now', sql.DateTime, nowFace)
      .query(query);
    return result.recordset;
  }

  async _getPlanDetails(pool, programacionId) {
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
      .input('progId', sql.Int, programacionId)
      .query(query);
    return result.recordset;
  }

  // ── Mapeo de filas a estructura del frontend ──

  _mapMainRow(prog) {
    return {
      main: {
        ctcod: 'Ret-xx-xx',
        otcod: prog.otcod,
        pronom: prog.producto_nombre,
        color: prog.producto_color
      },
      req: {
        canreq: prog.canreq,
        pesoneto: prog.pesoneto
      }
    };
  }

  // ── Métodos públicos ──

  async readSQL1() {
    const pool = new sql.ConnectionPool(this._config);
    try {
      await pool.connect();
      const programs = await this._getActivePrograms(pool);

      const keys = Object.values(this._machineMap);
      const output = {};
      keys.forEach(k => { output[k] = []; output[`${k}req`] = []; });
      output.ret_sql = [];

      for (const prog of programs) {
        const key = this._machineMap[prog.maquina_codigo];
        if (!key) continue;

        if (prog.lado_nombre === 'A' || prog.lado_nombre === 'LADO A') {
          const mapped = this._mapMainRow(prog);
          output[key] = [mapped.main];
          output[`${key}req`] = [mapped.req];
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

  async readSQL2() {
    const pool = new sql.ConnectionPool(this._config);
    try {
      await pool.connect();
      const programs = await this._getActivePrograms(pool);

      const keys = Object.values(this._machineMap);
      const output = {};
      keys.forEach(k => {
        output[`${k}ulta`] = []; output[`${k}ultb`] = [];
        output[`${k}desca`] = []; output[`${k}descb`] = [];
        output[`${k}da`] = []; output[`${k}db`] = [];
      });

      const now = this._getNowFaceValue();

      for (const prog of programs) {
        const key = this._machineMap[prog.maquina_codigo];
        if (!key) continue;

        const plan = await this._getPlanDetails(pool, prog.programacion_id);
        if (!plan.length) continue;

        const lastDescarga = plan[plan.length - 1];
        const finPrograma = lastDescarga.fh_fin_plan;

        const current = plan.find(p => p.fh_inicio_plan <= now && p.fh_fin_plan > now);
        const next = current ? current : plan.find(p => p.fh_inicio_plan > now);

        const suffix = (prog.lado_nombre === 'A' || prog.lado_nombre === 'LADO A') ? 'a' : 'b';
        const sideKey = (prog.lado_nombre === 'A' || prog.lado_nombre === 'LADO A') ? 'A' : 'B';

        // PROX CARGA (Es la fecha fin de toda la programación: la última descarga)
        output[`${key}ult${suffix}`] = [{
          [`fechafin_${sideKey}`]: finPrograma
        }];

        // DESCARGA ACTUAL
        output[`${key}desc${suffix}`] = [{
          [`num_${sideKey}`]: current ? current.secuencia : 0,
          [`total_${sideKey}`]: plan.length,
          [`fecha_${sideKey}`]: current ? current.fh_inicio_plan : (next ? next.fh_inicio_plan : null)
        }];

        // PROX DESCARGA
        if (next) {
          const nextTime = current ? next.fh_fin_plan : next.fh_inicio_plan;
          output[`${key}d${suffix}`] = [{
            [`fecha_${sideKey}`]: nextTime
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
}

// ── Configuración por defecto ──
const DEFAULT_CONFIG = {
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || 'F1S4123$',
  server: process.env.SQL_SERVER || '200.14.242.237',
  database: process.env.SQL_DATABASE || 'ZENTRIK',
  port: parseInt(process.env.SQL_PORT) || 1433,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERT === 'true'
  }
};

const DEFAULT_MACHINE_MAP = {
  'DONGTAI 1': 'dt1',
  'DONGTAI 2': 'dt2',
  'DONGTAI 3': 'dt3',
  'DONGTAI 4': 'dt4',
  'DONGTAI 5': 'dt5',
  'DONGTAI 6': 'dt6'
};

// Exportamos una instancia por defecto y la clase para testing
const defaultInstance = new DatabaseService(DEFAULT_CONFIG, DEFAULT_MACHINE_MAP);

module.exports = {
  DatabaseService,
  readSQL1: () => defaultInstance.readSQL1(),
  readSQL2: () => defaultInstance.readSQL2()
};
