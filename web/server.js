const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Funciones propias (reutilizamos las existentes)
const { readModbusData } = require('./modbus');
const { readSQL1, readSQL2 } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 4020;

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(__dirname));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ————————————————————  LOGICA DE POLLING  ————————————————————

// ------------------   SQL  ------------------
async function sendSqlData() {
    try {
        const sql1Result = await readSQL1();
        const sql2Result = await readSQL2();

        // console.log('🔍 SQL1:', JSON.stringify(sql1Result, null, 2));
        // console.log('🔍 SQL2:', JSON.stringify(sql2Result, null, 2));

        io.emit('sql-data', {
            sql1: sql1Result,
            sql2: sql2Result
        });
    } catch (err) {
        console.error('Error en SQL_1 & SQL_2:', err);
    }
}

// ------------------  MODBUS  ------------------
let modbusInitialized = false;

async function startModbusLoop() {
    // "Priming" inicial: lee Modbus una vez para poblar dt*_temp
    if (!modbusInitialized) {
        await readModbusData();
        modbusInitialized = true;
    }

    // Bucle cada 5 s
    setInterval(async () => {
        try {
            const modbusResult = await readModbusData();

            // Si readModbusData falla retorna null, validamos
            if (modbusResult) {
                const restData = {
                    dt1_rest: modbusResult.dt1.rest,
                    dt2_rest: modbusResult.dt2.rest,
                    dt3_rest: modbusResult.dt3.rest,
                    dt4_rest: modbusResult.dt4.rest,
                    dt5_rest: modbusResult.dt5.rest,
                    lez_rest: modbusResult.lez.rest
                };
                io.emit('modbus-data', restData);
            }
        } catch (err) {
            console.error('Error en MODBUS:', err);
        }
    }, 5000);
}

// Iniciar bucles
sendSqlData(); // Primera ejecución inmediata
setInterval(sendSqlData, 10000); // Repite cada 10 s

startModbusLoop();

// ————————————————————  SOCKET.IO  ————————————————————
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Opcional: enviar datos inmediatamente al conectar
    // sendSqlData(); 

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// ————————————————————  START SERVER  ————————————————————
server.listen(PORT, () => {
    console.log(`✅ Servidor Web listo en http://localhost:${PORT}`);
});
