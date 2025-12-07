import { NextResponse } from 'next/server';
import DigestFetch from 'digest-fetch';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CONFIG = {
  username: process.env.HIKUSER,
  password: process.env.HIKPASS,
  deviceIp: "172.31.0.165",
  batchSize: 30,
  maxBatches: 15,
  authRetries: 3,
  delayBetweenBatches: 100
};

const DEPARTAMENTOS = {
  1: "TI",
  2: "Teams Leaders",
  3: "Campana 5757",
  4: "Campana SAV",
  5: "Campana REFI",
  6: "Campana PL",
  7: "Campana PARLO",
  8: "Administrativo"
};

class HikvisionClient {
  constructor(deviceIp) {
    this.deviceIp = deviceIp;
    this.client = new DigestFetch(CONFIG.username, CONFIG.password, {
      disableRetry: false,
      algorithm: 'MD5'
    });
  }

  async fetchWithRetry(url, options, retryCount = 0) {
    try {
      const res = await this.client.fetch(url, options);
      
      if (res.status === 401 && retryCount < CONFIG.authRetries) {
        await new Promise(r => setTimeout(r, 500));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (retryCount < CONFIG.authRetries) {
        await new Promise(r => setTimeout(r, 800));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  async getUsersBatch(position) {
    const body = {
      UserInfoSearchCond: {
        searchID: "1",
        maxResults: CONFIG.batchSize,
        searchResultPosition: position
      }
    };

    const url = `https://${this.deviceIp}/ISAPI/AccessControl/UserInfo/Search?format=json`;

    return this.fetchWithRetry(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" }
    });
  }

  async getAllUsers() {
    let allUsers = [];
    let position = 0;
    let batchCount = 0;
    let errors = 0;

    while (batchCount < CONFIG.maxBatches && errors < 3) {
      batchCount++;

      try {
        const response = await this.getUsersBatch(position);
        const usersBatch = response?.UserInfoSearch?.UserInfo || [];

        if (usersBatch.length === 0) break;

        allUsers = [...allUsers, ...usersBatch];
        position += usersBatch.length;
        errors = 0;

        if (usersBatch.length < CONFIG.batchSize) break;
        await new Promise(r => setTimeout(r, CONFIG.delayBetweenBatches));
      } catch (error) {
        errors++;
        if (errors >= 2) position += CONFIG.batchSize;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return {
      deviceIp: this.deviceIp,
      users: allUsers,
      batches: batchCount,
      totalUsers: allUsers.length
    };
  }
}

function processUserData(user, deviceIp, index, total) {
  try {
    if (!user?.employeeNo) return null;

    const employeeId = user.employeeNo.toString().trim();
    
    // SOLO ESTE LOG - Justo lo que pediste
    console.log(`--- Procesando usuario ${index + 1}/${total}: ${employeeId} ---`);
    console.log(`📋 Datos procesados para ${employeeId}:`);
    console.log(`  Nombre: ${user.name || user.userName || 'Sin nombre'}`);
    // Fin del log específico

    const fotoPath = user.faceURL 
      ? user.faceURL
          .replace(/^https?:\/\//, '')
          .replace(/^[^\/]+\//, '')
          .replace(/@/g, '%40')
      : null;

    const grupoId = user.groupId || user.deptID;
    const departamento = DEPARTAMENTOS[grupoId] || (grupoId ? `Grupo ${grupoId}` : "No asignado");

    let genero = "No especificado";
    if (user.gender === 1 || user.gender === 'male') genero = 'Masculino';
    else if (user.gender === 2 || user.gender === 'female') genero = 'Femenino';

    let fechaCreacion = null;
    let fechaModificacion = null;
    
    if (user.Valid?.beginTime) fechaCreacion = user.Valid.beginTime.substring(0, 10);
    if (user.Valid?.endTime) fechaModificacion = user.Valid.endTime.substring(0, 10);

    const estado = user.Valid?.enable !== undefined 
      ? (user.Valid.enable ? 'Activo' : 'Inactivo') 
      : 'Desconocido';

    let tipoUsuario = 'Desconocido';
    if (user.userType === 0) tipoUsuario = 'Normal';
    else if (user.userType === 1) tipoUsuario = 'Administrador';
    else if (user.userType === 2) tipoUsuario = 'Supervisor';
    else if (typeof user.userType === 'string') tipoUsuario = user.userType;

    return {
      employeeNo: employeeId,
      nombre: (user.name || user.userName || 'Sin nombre').trim(),
      tipoUsuario,
      fechaCreacion,
      fechaModificacion,
      estado,
      departamento,
      genero,
      fotoPath,
      deviceIp
    };
  } catch (error) {
    return null;
  }
}

export async function GET(request) {
  const startTime = Date.now();
  console.log(`Iniciando consulta Hikvision (${CONFIG.deviceIp})...`);

  try {
    const client = new HikvisionClient(CONFIG.deviceIp);
    const result = await client.getAllUsers();

    const processedUsers = result.users
      .map((user, index) => processUserData(user, result.deviceIp, index, result.totalUsers))
      .filter(user => user !== null);

    const duration = Date.now() - startTime;
    console.log(`✅ Consulta completada en ${duration}ms`);
    console.log(`📊 Total usuarios: ${processedUsers.length}`);

    return NextResponse.json({
      success: true,
      stats: {
        total_users: processedUsers.length,
        device_ip: result.deviceIp,
        duration_ms: duration
      },
      data: processedUsers
    });

  } catch (error) {
    console.error('Error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      device_ip: CONFIG.deviceIp
    }, { status: 500 });
  }
}