// modbus.js
const ModbusRTU = require('modbus-serial');

// Valores anteriores para calcular “rest”
let dt1_temp = 0,
    dt2_temp = 0,
    dt3_temp = 0,
    dt4_temp = 0,
    dt5_temp = 0,
    lez_temp = 0;

// Convierte 2 registros (32 bit) a entero con signo (Big-Endian)
function convertRegistersToInt(registers) {
  const buf = Buffer.alloc(4);
  // palabra alta → índice 0, palabra baja → índice 2
  buf.writeUInt16BE(registers[1], 0);
  buf.writeUInt16BE(registers[0], 2);
  return buf.readInt32BE(0);
}

async function readModbusData() {
  const client = new ModbusRTU();

  try {
    // Conexión al servidor Modbus TCP
    await client.connectTCP('192.168.1.47', { port: 502 });

    // ---------------------  DONGTAI 1  ---------------------
    const regDt1 = await client.readHoldingRegisters(22, 4);
    const dt1Cur = convertRegistersToInt(regDt1.data);
    const dt1Rest = dt1Cur - dt1_temp;

    // ---------------------  DONGTAI 2  ---------------------
    const regDt2 = await client.readHoldingRegisters(2, 4);
    const dt2Cur = convertRegistersToInt(regDt2.data);
    const dt2Rest = dt2Cur - dt2_temp;

    // ---------------------  DONGTAI 3  ---------------------
    const regDt3 = await client.readHoldingRegisters(4, 4);
    const dt3Cur = convertRegistersToInt(regDt3.data);
    const dt3Rest = dt3Cur - dt3_temp;

    // ---------------------  DONGTAI 4  ---------------------
    const regDt4 = await client.readHoldingRegisters(12, 4);
    const dt4Cur = convertRegistersToInt(regDt4.data);
    const dt4Rest = dt4Cur - dt4_temp;

    // ---------------------  DONGTAI 5  ---------------------
    // Dirección de partida = 10, cantidad = 4 registros
    const regDt5 = await client.readHoldingRegisters(10, 4);
    const dt5Cur = convertRegistersToInt(regDt5.data);
    const dt5Rest = dt5Cur - dt5_temp;

    // ---------------------  LEZZENI  ------------------------
    const regLez = await client.readHoldingRegisters(20, 4);
    const lezCur = convertRegistersToInt(regLez.data);
    const lezRest = lezCur - lez_temp;

    // Actualiza “temporales” para la siguiente lectura
    dt1_temp = dt1Cur;
    dt2_temp = dt2Cur;
    dt3_temp = dt3Cur;
    dt4_temp = dt4Cur;
    dt5_temp = dt5Cur;
    lez_temp = lezCur;

    // Devuelve estructura para el renderer
    return {
      dt1: { current: dt1Cur, rest: dt1Rest },
      dt2: { current: dt2Cur, rest: dt2Rest },
      dt3: { current: dt3Cur, rest: dt3Rest },
      dt4: { current: dt4Cur, rest: dt4Rest },
      dt5: { current: dt5Cur, rest: dt5Rest },
      lez: { current: lezCur, rest: lezRest }
    };

  } catch (err) {
    console.error('[MODBUS] Error:', err);
    return null;
  } finally {
    try { client.close(); } catch { /* ignora */ }
  }
}

module.exports = { readModbusData };
