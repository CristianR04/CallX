// app/api/users/route.js
import { NextResponse } from 'next/server';
import DigestFetch from 'digest-fetch';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CONFIG = {
  username: "admin",
  password: "Tattered3483",
  deviceIp: ["172.31.0.165", "172.31.0.164"],
  batchSize: 30,
  maxBatches: 15,
  authRetryAttempts: 3,
  delayBetweenBatches: 300
};

class AuthManager {
  static createDigestClient() {
    return new DigestFetch(CONFIG.username, CONFIG.password, {
      disableRetry: false,
      algorithm: 'MD5'
    });
  }
}

class UserInfoClient {
  constructor(deviceIp) {
    this.deviceIp = deviceIp;
    this.refreshClient();
  }

  refreshClient() {
    this.client = AuthManager.createDigestClient();
  }

  async searchUsersBatch(searchResultPosition = 0, maxResults = CONFIG.batchSize, retryCount = 0) {
    const body = {
      UserInfoSearchCond: {
        searchID: "1",
        maxResults: maxResults,
        searchResultPosition: searchResultPosition
      }
    };

    const url = `https://${this.deviceIp}/ISAPI/AccessControl/UserInfo/Search?format=json`;

    try {
      const res = await this.client.fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
      });

      if (res.status === 401 && retryCount < CONFIG.authRetryAttempts) {
        this.refreshClient();
        await new Promise(r => setTimeout(r, 500));
        return this.searchUsersBatch(searchResultPosition, maxResults, retryCount + 1);
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Error ${res.status}: ${err}`);
      }

      return await res.json();

    } catch (err) {
      if (retryCount < CONFIG.authRetryAttempts &&
        (err.message.includes('401') || err.message.includes('network'))) {
        this.refreshClient();
        await new Promise(r => setTimeout(r, 800));
        return this.searchUsersBatch(searchResultPosition, maxResults, retryCount + 1);
      }
      throw err;
    }
  }
}

class UserQueryService {
  constructor(userInfoClient) {
    this.client = userInfoClient;
    this.deviceIp = userInfoClient.deviceIp;
  }

  async getAllUsersWithPagination() {
    let allRawResponses = [];
    let currentPos = 0;
    let batchCount = 0;
    let consecutiveErrors = 0;

    while (batchCount < CONFIG.maxBatches && consecutiveErrors < 3) {
      batchCount++;

      try {
        const response = await this.client.searchUsersBatch(currentPos);
        const usersBatch = response?.UserInfoSearch?.UserInfo || [];

        allRawResponses.push({
          batch: batchCount,
          raw: response
        });

        if (usersBatch.length === 0) break;

        currentPos += usersBatch.length;
        consecutiveErrors = 0;

        if (usersBatch.length < CONFIG.batchSize) break;

        await new Promise(r => setTimeout(r, CONFIG.delayBetweenBatches));

      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= 2) {
          currentPos += CONFIG.batchSize;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return {
      deviceIp: this.deviceIp,
      rawResponses: allRawResponses,
      stats: {
        batchesAttempted: batchCount,
        consecutiveErrors
      }
    };
  }
}

class MultiDeviceUserService {
  constructor() {
    this.deviceServices = CONFIG.deviceIp.map(ip => {
      const client = new UserInfoClient(ip);
      return new UserQueryService(client);
    });
  }

  async getAllUsersFromAllDevices() {
    const results = [];

    for (const service of this.deviceServices) {
      try {
        const data = await service.getAllUsersWithPagination();
        results.push(data);
      } catch (err) {
        results.push({
          deviceIp: service.deviceIp,
          error: err.message,
          rawResponses: [],
          stats: {}
        });
      }
    }

    return { results };
  }
}

export async function GET(request) {
  try {
    console.log('🔄 INICIANDO CONSULTA DE USUARIOS HIKVISION (MODO RAW)...');
    
    const multi = new MultiDeviceUserService();
    const result = await multi.getAllUsersFromAllDevices();

    // Devolver el JSON COMPLETO de Hikvision sin transformar
    const responseData = {
      success: true,
      message: "RESPUESTA RAW COMPLETA DE HIKVISION - SIN TRANSFORMAR",
      timestamp: new Date().toISOString(),
      devices: CONFIG.deviceIp,
      hikvisionRawData: result.results, // Datos crudos completos
      stats: {
        totalDevices: CONFIG.deviceIp.length,
        successfulDevices: result.results.filter(device => !device.error).length,
        devicesWithErrors: result.results.filter(device => device.error).length
      }
    };

    console.log('✅ CONSULTA RAW COMPLETADA');

    // Log detallado de la estructura del primer usuario del primer dispositivo
    result.results.forEach((device, deviceIndex) => {
      if (device.rawResponses && device.rawResponses.length > 0) {
        device.rawResponses.forEach((batch, batchIndex) => {
          const users = batch.raw?.UserInfoSearch?.UserInfo;
          if (users && users.length > 0) {
            console.log(`\n🔍 DISPOSITIVO ${deviceIndex + 1}, BATCH ${batchIndex + 1}:`);
            console.log(`📊 Total usuarios en este batch: ${users.length}`);
            
            // Mostrar estructura del primer usuario
            const firstUser = users[0];
            console.log('🧩 ESTRUCTURA DEL PRIMER USUARIO (primer batch):');
            console.log(JSON.stringify(firstUser, null, 2));
            
            // Mostrar todas las claves disponibles en el primer usuario
            console.log('🔑 CLAVES DISPONIBLES EN EL PRIMER USUARIO:');
            if (firstUser) {
              Object.keys(firstUser).forEach(key => {
                console.log(`   - ${key}: ${JSON.stringify(firstUser[key])}`);
              });
            }
            
            // Buscar campos que puedan ser correo o teléfono
            console.log('🔎 BUSCANDO CAMPOS DE CORREO Y TELÉFONO:');
            const emailLikeFields = Object.keys(firstUser).filter(key => 
              key.toLowerCase().includes('mail') || key.toLowerCase().includes('email')
            );
            const phoneLikeFields = Object.keys(firstUser).filter(key => 
              key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel') || key.toLowerCase().includes('mobile')
            );
            
            console.log('   Campos similares a correo:', emailLikeFields);
            console.log('   Campos similares a teléfono:', phoneLikeFields);
            
            // Mostrar valores de esos campos
            emailLikeFields.forEach(field => {
              console.log(`   ${field}: ${firstUser[field]}`);
            });
            phoneLikeFields.forEach(field => {
              console.log(`   ${field}: ${firstUser[field]}`);
            });
          }
        });
      }
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ ERROR EN CONSULTA RAW DE USUARIOS:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}