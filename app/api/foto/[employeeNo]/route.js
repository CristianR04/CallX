// // app/api/foto/[employeeNo]/route.js
// import { NextResponse } from 'next/server';
// import DigestFetch from 'digest-fetch';

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// const CONFIG = {
//   username: "admin",
//   password: "Tattered3483",
//   deviceIps: ["172.31.0.165", "172.31.0.164"]
// };

// class FotoService {
//   constructor() {
//     this.client = new DigestFetch(CONFIG.username, CONFIG.password);
//   }

//   async buscarFotoPorEmployeeNo(employeeNo) {
//     if (!employeeNo || employeeNo === 'N/A' || employeeNo === 'undefined') {
//       throw new Error('EmployeeNo inválido');
//     }

//     console.log(`🔍 Iniciando búsqueda de foto para: ${employeeNo}`);

//     // Intentar en cada dispositivo hasta encontrar la foto
//     for (const deviceIp of CONFIG.deviceIps) {
//       try {
//         console.log(`🔍 Buscando en dispositivo: ${deviceIp}`);
        
//         // Primero buscar información del usuario
//         const userInfo = await this.buscarUsuario(deviceIp, employeeNo);
        
//         if (!userInfo) {
//           console.log(`❌ Usuario ${employeeNo} no encontrado en ${deviceIp}`);
//           continue;
//         }

//         console.log(`✅ Usuario encontrado: ${userInfo.name || 'Sin nombre'} (${userInfo.employeeNo})`);
        
//         if (userInfo.faceURL && userInfo.faceURL.trim() !== '') {
//           console.log(`📸 FaceURL encontrada: ${userInfo.faceURL}`);
          
//           const imageUrl = userInfo.faceURL.startsWith('http') 
//             ? userInfo.faceURL 
//             : `https://${deviceIp}/${userInfo.faceURL.replace(/^\//, '')}`;
          
//           console.log(`🔗 URL de imagen construida: ${imageUrl}`);
          
//           try {
//             const foto = await this.descargarFoto(imageUrl);
//             console.log(`✅ Foto descargada correctamente desde ${deviceIp}`);
//             return foto;
//           } catch (downloadError) {
//             console.log(`❌ Error descargando foto desde ${deviceIp}:`, downloadError.message);
//             continue;
//           }
//         } else {
//           console.log(`📭 Usuario ${employeeNo} no tiene faceURL en ${deviceIp}`);
//           // Continuar con el siguiente dispositivo por si tiene foto en otro
//           continue;
//         }
//       } catch (error) {
//         console.log(`❌ Error general en ${deviceIp}:`, error.message);
//         continue;
//       }
//     }
    
//     // Si llegamos aquí, no se encontró foto en ningún dispositivo
//     console.log(`📭 Foto no encontrada para ${employeeNo} en ningún dispositivo`);
//     throw new Error('Foto no encontrada');
//   }

//   async buscarUsuario(deviceIp, employeeNo) {
//     const body = {
//       UserInfoSearchCond: {
//         searchID: "1",
//         maxResults: 1,
//         searchResultPosition: 0,
//         EmployeeNoList: [employeeNo]
//       }
//     };

//     const url = `https://${deviceIp}/ISAPI/AccessControl/UserInfo/Search?format=json`;

//     console.log(`🔍 Buscando usuario ${employeeNo} en ${deviceIp}`);

//     try {
//       const res = await this.client.fetch(url, {
//         method: "POST",
//         body: JSON.stringify(body),
//         headers: { "Content-Type": "application/json" }
//       });

//       if (!res.ok) {
//         console.log(`❌ HTTP ${res.status} buscando usuario en ${deviceIp}`);
//         return null;
//       }

//       const data = await res.json();
//       const userInfo = data?.UserInfoSearch?.UserInfo?.[0];
      
//       return userInfo;
//     } catch (error) {
//       console.log(`❌ Error de conexión con ${deviceIp}:`, error.message);
//       return null;
//     }
//   }

//   async descargarFoto(imageUrl) {
//     console.log(`📥 Descargando foto: ${imageUrl}`);
    
//     const res = await this.client.fetch(imageUrl);
    
//     if (!res.ok) {
//       throw new Error(`HTTP ${res.status} - No se pudo descargar la imagen`);
//     }

//     const buffer = await res.arrayBuffer();
    
//     if (buffer.byteLength === 0) {
//       throw new Error('Imagen vacía (0 bytes)');
//     }

//     console.log(`✅ Foto descargada: ${buffer.byteLength} bytes`);

//     return {
//       buffer: buffer,
//       contentType: res.headers.get('content-type') || 'image/jpeg'
//     };
//   }
// }

// export async function GET(request, { params }) {
//   try {
//     // IMPORTANTE: await params porque en Next.js 16 params es una Promise
//     const { employeeNo } = await params;

//     console.log(`\n🔄 ===== SOLICITUD DE FOTO PARA: ${employeeNo} =====`);

//     if (!employeeNo || employeeNo === 'undefined' || employeeNo === 'N/A') {
//       console.log('❌ EmployeeNo inválido recibido');
//       return new Response('EmployeeNo inválido', { status: 400 });
//     }

//     const fotoService = new FotoService();
//     const foto = await fotoService.buscarFotoPorEmployeeNo(employeeNo);

//     console.log(`✅ ===== FOTO ENTREGADA PARA: ${employeeNo} =====\n`);

//     return new Response(foto.buffer, {
//       headers: {
//         "Content-Type": foto.contentType,
//         "Cache-Control": "public, max-age=3600"
//       }
//     });

//   } catch (error) {
//     console.error(`❌ ===== ERROR PARA ${(await params).employeeNo}:`, error.message);
    
//     if (error.message.includes('no encontrada')) {
//       return new Response('Foto no encontrada', { 
//         status: 404,
//         headers: {
//           'Content-Type': 'application/json'
//         }
//       });
//     }
    
//     if (error.message.includes('inválido')) {
//       return new Response('EmployeeNo inválido', { status: 400 });
//     }
    
//     return new Response('Error interno del servidor', { status: 500 });
//   }
// }