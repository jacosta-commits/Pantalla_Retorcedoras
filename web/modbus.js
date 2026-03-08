// modbus.js – ModbusService (OOP)
const ModbusRTU = require('modbus-serial');

// ═══════════════════════════════════════════════════
//  Clase ModbusService
//  Encapsula TODA la lógica de lectura Modbus.
//  La lógica interna de cálculo de rest NO cambia.
// ═══════════════════════════════════════════════════

class ModbusService {

  /**
   * @param {string} host   - IP del servidor Modbus TCP
   * @param {number} port   - Puerto del servidor Modbus
   * @param {Array}  machineRegisters - Array de { key, address, count }
   */
  constructor(host, port, machineRegisters) {
    this._host = host;
    this._port = port;
    this._machineRegisters = machineRegisters;

    // Estado interno: valores anteriores para calcular "rest"
    this._previousValues = {};
    machineRegisters.forEach(m => { this._previousValues[m.key] = 0; });
  }

  // ── Helpers privados ──

  static _convertRegistersToInt(registers) {
    const buf = Buffer.alloc(4);
    // palabra alta → índice 0, palabra baja → índice 2
    buf.writeUInt16BE(registers[1], 0);
    buf.writeUInt16BE(registers[0], 2);
    return buf.readInt32BE(0);
  }

  // ── Método público ──

  async read() {
    const client = new ModbusRTU();

    try {
      await client.connectTCP(this._host, { port: this._port });

      const result = {};

      for (const { key, address, count } of this._machineRegisters) {
        const reg = await client.readHoldingRegisters(address, count);
        const current = ModbusService._convertRegistersToInt(reg.data);
        const rest = current - this._previousValues[key];
        this._previousValues[key] = current;
        result[key] = { current, rest };
      }

      return result;

    } catch (err) {
      console.error('[MODBUS] Error:', err);
      return null;
    } finally {
      try { client.close(); } catch { /* ignora */ }
    }
  }
}

// ── Configuración por defecto (idéntica a la original) ──
const DEFAULT_REGISTERS = [
  { key: 'dt1', address: 22, count: 4 },
  { key: 'dt2', address: 2, count: 4 },
  { key: 'dt3', address: 4, count: 4 },
  { key: 'dt4', address: 12, count: 4 },
  { key: 'dt5', address: 10, count: 4 },
  { key: 'lez', address: 20, count: 4 }
];

const MODBUS_HOST = process.env.MODBUS_IP || '192.168.1.47';
const MODBUS_PORT = parseInt(process.env.MODBUS_PORT) || 502;

const defaultInstance = new ModbusService(MODBUS_HOST, MODBUS_PORT, DEFAULT_REGISTERS);

module.exports = {
  ModbusService,
  readModbusData: () => defaultInstance.read()
};
