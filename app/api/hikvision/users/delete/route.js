// // app/api/hikvision/users/delete/route.js
// import { NextResponse } from 'next/server';
// import DigestFetch from 'digest-fetch';

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// const DEVICES = [
//   { ip: "172.31.0.165", username: "admin", password: "Tattered3483" },
//   { ip: "172.31.0.164", username: "admin", password: "Tattered3483" }
// ];

// // Función auxiliar para eliminar usuario en un dispositivo
// async function deleteUserFromDevice(device, employeeNo) {
//   console.log(`🔄 ELIMINANDO USUARIO ${employeeNo} DEL DISPOSITIVO: ${device.ip}`);
  
//   try {
//     const client = new DigestFetch(device.username, device.password, {
//       disableRetry: false,
//       algorithm: 'MD5'
//     });

//     // FORMATO 1: Basado en la documentación común de Hikvision
//     const payload1 = {
//       UserInfoDelCond: {
//         EmployeeNoList: [employeeNo.toString()]
//       }
//     };

//     // FORMATO 2: Alternativo (menos común)
//     const payload2 = {
//       UserInfoDelCond: {
//         EmployeeNoList: employeeNo.toString()
//       }
//     };

//     // Lista de endpoints y métodos a probar
//     const attempts = [
//       {
//         method: 'PUT',
//         url: `https://${device.ip}/ISAPI/AccessControl/UserInfo/Delete?format=json`,
//         payload: payload1,
//         description: 'PUT con formato 1'
//       },
//       {
//         method: 'POST',
//         url: `https://${device.ip}/ISAPI/AccessControl/UserInfo/Delete?format=json`,
//         payload: payload1,
//         description: 'POST con formato 1'
//       },
//       {
//         method: 'PUT',
//         url: `https://${device.ip}/ISAPI/AccessControl/UserInfo/Delete`,
//         payload: payload1,
//         description: 'PUT sin formato'
//       },
//       {
//         method: 'PUT',
//         url: `https://${device.ip}/ISAPI/AccessControl/UserInfo/Delete?format=json`,
//         payload: payload2,
//         description: 'PUT con formato 2'
//       },
//       // Intentar con DELETE method (aunque es menos común)
//       {
//         method: 'DELETE',
//         url: `https://${device.ip}/ISAPI/AccessControl/UserInfo/Record/${employeeNo}?format=json`,
//         payload: null,
//         description: 'DELETE por ID'
//       }
//     ];

//     // Probar cada intento hasta que uno funcione
//     for (const attempt of attempts) {
//       console.log(`🔍 Probando: ${attempt.description} - ${attempt.method} ${attempt.url}`);
      
//       const options = {
//         method: attempt.method,
//         headers: { 
//           "Content-Type": "application/json",
//           "Accept": "application/json"
//         }
//       };

//       // Solo agregar body si no es null
//       if (attempt.payload) {
//         options.body = JSON.stringify(attempt.payload);
//       }

//       try {
//         const response = await client.fetch(attempt.url, options);
//         const responseText = await response.text();
        
//         console.log(`📥 Respuesta de ${device.ip} (${attempt.description}):`, {
//           status: response.status,
//           statusText: response.statusText,
//           bodyPreview: responseText.substring(0, 300)
//         });

//         // Verificar si la respuesta es HTML
//         if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
//           console.log(`❌ HTML recibido, intentando siguiente método...`);
//           continue;
//         }

//         // Intentar parsear como JSON
//         try {
//           const parsedResponse = JSON.parse(responseText);
          
//           // Verificar códigos de éxito de Hikvision
//           if (response.ok) {
//             const statusCode = parsedResponse.statusCode || 
//                              parsedResponse.ResponseStatus?.statusCode ||
//                              parsedResponse.status;
            
//             // Códigos de éxito típicos
//             if (statusCode === 0 || statusCode === 1 || statusCode === 200) {
//               return {
//                 success: true,
//                 message: "Usuario eliminado exitosamente",
//                 deviceIp: device.ip,
//                 method: attempt.method,
//                 response: parsedResponse
//               };
//             } else if (statusCode === 6) {
//               // Código 6 = Invalid Content - probar siguiente método
//               console.log(`⚠️ Código 6 (Invalid Content), probando siguiente...`);
//               continue;
//             }
//           }
//         } catch (jsonError) {
//           // Si no es JSON pero el status es 200/204, asumir éxito
//           if (response.status === 200 || response.status === 204) {
//             return {
//               success: true,
//               message: "Usuario eliminado exitosamente",
//               deviceIp: device.ip,
//               method: attempt.method,
//               rawResponse: responseText
//             };
//           }
//         }
//       } catch (fetchError) {
//         console.log(`❌ Error en intento ${attempt.description}:`, fetchError.message);
//         // Continuar con el siguiente intento
//       }
      
//       // Pequeña pausa entre intentos
//       await new Promise(resolve => setTimeout(resolve, 300));
//     }

//     // Si llegamos aquí, todos los intentos fallaron
//     return {
//       success: false,
//       error: "Todos los métodos de eliminación fallaron",
//       deviceIp: device.ip
//     };

//   } catch (error) {
//     console.error(`💥 ERROR GENERAL EN ${device.ip}:`, error);
//     return {
//       success: false,
//       error: error.message || 'Error de conexión',
//       deviceIp: device.ip,
//       networkError: true
//     };
//   }
// }

// // POST para eliminar usuarios
// export async function POST(request) {
//   try {
//     const body = await request.json();
//     const { employeeNo } = body;
    
//     if (!employeeNo) {
//       return NextResponse.json(
//         { 
//           success: false, 
//           error: "employeeNo es requerido en el cuerpo de la petición" 
//         },
//         { status: 400 }
//       );
//     }

//     console.log(`🔴 SOLICITUD DE ELIMINACIÓN PARA EMPLEADO: ${employeeNo}`);

//     const results = [];
//     let successCount = 0;

//     // Eliminar usuario de cada dispositivo
//     for (const device of DEVICES) {
//       const result = await deleteUserFromDevice(device, employeeNo);
//       results.push(result);
      
//       if (result.success) {
//         successCount++;
//       }
      
//       // Pequeña pausa entre dispositivos
//       await new Promise(resolve => setTimeout(resolve, 500));
//     }

//     const allSuccess = successCount === DEVICES.length;
    
//     const finalResult = {
//       success: allSuccess,
//       message: allSuccess 
//         ? "Usuario eliminado de todos los dispositivos" 
//         : `Usuario eliminado de ${successCount} de ${DEVICES.length} dispositivos`,
//       results: results,
//       deletedEmployeeNo: employeeNo
//     };

//     console.log('🎯 RESULTADO FINAL DE ELIMINACIÓN:', finalResult);
    
//     return NextResponse.json(finalResult);

//   } catch (error) {
//     console.error('💥 ERROR GENERAL EN ENDPOINT:', error);
//     return NextResponse.json(
//       { 
//         success: false, 
//         error: error.message 
//       },
//       { status: 500 }
//     );
//   }
// }

// // GET para verificar si el endpoint funciona
// export async function GET() {
//   return NextResponse.json({
//     success: true,
//     message: "Endpoint de eliminación de usuarios Hikvision funcionando",
//     devices: DEVICES.map(d => d.ip),
//     usage: "POST con { employeeNo: 'numeroEmpleado' }"
//   });
// }