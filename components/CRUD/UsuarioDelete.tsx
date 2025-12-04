// "use client";

// import { useState } from "react";

// // Definir la interfaz Usuario localmente
// interface Usuario {
//   id: string;
//   nombre: string;
//   tipoUsuario?: string;
//   numeroEmpleado: string;
//   correo?: string;
//   telefono?: string;
//   fechaCreacion?: string;
//   fechaModificacion?: string;
//   estado?: string;
//   departamento?: string;
//   dispositivo?: string;
//   cedula?: string;
//   genero?: string;
//   foto?: string;
// }

// interface UsuarioDeleteProps {
//   usuario: Usuario | null;
//   onCancel: () => void;
//   onConfirm: () => void;
// }

// export default function UsuarioDelete({
//   usuario,
//   onCancel,
//   onConfirm
// }: UsuarioDeleteProps) {
//   const [loading, setLoading] = useState(false);
//   const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

//   const handleDelete = async () => {
//     if (!usuario) return;
    
//     setLoading(true);
//     setDeleteResult(null);
    
//     try {
//       console.log(`🔴 INICIANDO ELIMINACIÓN DE USUARIO: ${usuario.numeroEmpleado}`);
      
//       // Usar el nuevo endpoint de eliminación
//       const response = await fetch('/api/hikvision/users/delete', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ 
//           employeeNo: usuario.numeroEmpleado 
//         })
//       });

//       if (!response.ok) {
//         throw new Error(`Error HTTP ${response.status} en la solicitud`);
//       }

//       const result = await response.json();
//       console.log('📋 RESULTADO DE LA API:', result);

//       if (result.success) {
//         const successfulDevices = result.results.filter((r: any) => r.success).length;
//         const totalDevices = result.results.length;
        
//         setDeleteResult({
//           success: true,
//           message: `✅ Eliminado de ${successfulDevices}/${totalDevices} dispositivos`
//         });
        
//         // Mostrar detalles por dispositivo
//         if (successfulDevices === totalDevices) {
//           alert("✅ Usuario eliminado exitosamente de todos los dispositivos Hikvision");
//         } else {
//           const deviceDetails = result.results.map((r: any) => 
//             `• ${r.deviceIp}: ${r.success ? '✅ Éxito' : '❌ ' + (r.error || 'Error')}`
//           ).join('\n');
          
//           alert(`⚠️ Eliminación parcial:\n\n${deviceDetails}\n\nEl usuario se eliminará del sistema local.`);
//         }

//         // Eliminar localmente después de mostrar feedback
//         setTimeout(() => {
//           onConfirm();
//         }, 1500);
        
//       } else {
//         // Mostrar errores detallados por dispositivo
//         const errorDetails = result.results
//           .filter((r: any) => !r.success)
//           .map((r: any) => {
//             let errorMsg = r.error || 'Error desconocido';
//             if (r.htmlError) errorMsg += ' (Error HTML del dispositivo)';
//             if (r.networkError) errorMsg += ' (Error de conexión)';
//             return `• ${r.deviceIp}: ${errorMsg}`;
//           })
//           .join('\n');
        
//         const someSuccess = result.results.some((r: any) => r.success);
        
//         if (someSuccess) {
//           setDeleteResult({
//             success: false,
//             message: `⚠️ Eliminación parcial con errores`
//           });
          
//           const userChoice = confirm(
//             `⚠️ Eliminación parcial:\n\n${errorDetails}\n\n` +
//             `¿Desea eliminar el usuario del sistema local de todas formas?`
//           );
          
//           if (userChoice) {
//             setTimeout(() => {
//               onConfirm();
//             }, 1000);
//           }
//         } else {
//           setDeleteResult({
//             success: false,
//             message: `❌ Falló en todos los dispositivos`
//           });
          
//           alert(`❌ No se pudo eliminar el usuario de los dispositivos Hikvision:\n\n${errorDetails}`);
//         }
//       }
//     } catch (error: unknown) {
//       console.error('💥 ERROR EN ELIMINACIÓN:', error);
      
//       let errorMessage = 'Error desconocido al eliminar usuario';
//       if (error instanceof Error) {
//         errorMessage = error.message;
//       } else if (typeof error === 'string') {
//         errorMessage = error;
//       }
      
//       setDeleteResult({
//         success: false,
//         message: `❌ ${errorMessage}`
//       });
      
//       const userChoice = confirm(
//         `❌ Error al conectar con los dispositivos:\n${errorMessage}\n\n` +
//         `¿Desea eliminar el usuario solo del sistema local?`
//       );
      
//       if (userChoice) {
//         onConfirm();
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!usuario) return null;

//   return (
//     <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
//       <div className="bg-white p-6 rounded-lg shadow-md text-center w-96 max-w-sm mx-4">
        
//         <div className="flex items-center justify-center mb-4">
//           <div className="bg-red-100 p-3 rounded-full">
//             <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
//             </svg>
//           </div>
//         </div>

//         <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmar Eliminación</h3>
        
//         {/* Información del usuario */}
//         <div className="mb-4 text-left bg-gray-50 p-4 rounded-lg">
//           <p className="text-gray-800 font-medium text-lg mb-2">{usuario.nombre}</p>
//           <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
//             {usuario.cedula && (
//               <div>
//                 <span className="font-medium">Cédula:</span> {usuario.cedula}
//               </div>
//             )}
//             {usuario.numeroEmpleado && (
//               <div>
//                 <span className="font-medium">N° Empleado:</span> {usuario.numeroEmpleado}
//               </div>
//             )}
//             {usuario.genero && (
//               <div>
//                 <span className="font-medium">Género:</span> {usuario.genero}
//               </div>
//             )}
//             {usuario.departamento && (
//               <div className="col-span-2">
//                 <span className="font-medium">Departamento:</span> {usuario.departamento}
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Resultado de eliminación */}
//         {deleteResult && (
//           <div className={`mb-4 rounded-lg p-3 ${deleteResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
//             <p className={`font-medium ${deleteResult.success ? 'text-green-800' : 'text-red-800'}`}>
//               {deleteResult.success ? '✅ ' : '❌ '}
//               {deleteResult.message}
//             </p>
//           </div>
//         )}

//         {/* Advertencia */}
//         <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
//           <div className="flex items-start gap-2">
//             <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
//               <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
//             </svg>
//             <div>
//               <p className="text-yellow-800 text-sm font-medium">Esta acción eliminará el usuario de:</p>
//               <ul className="text-yellow-700 text-xs mt-1 space-y-1">
//                 <li>• Sistema local de gestión</li>
//                 <li>• Dispositivo Hikvision 172.31.0.165</li>
//                 <li>• Dispositivo Hikvision 172.31.0.164</li>
//               </ul>
//             </div>
//           </div>
//         </div>

//         {/* Botones */}
//         <div className="flex justify-center gap-3">
//           <button
//             onClick={handleDelete}
//             disabled={loading}
//             className="bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center"
//           >
//             {loading ? (
//               <>
//                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
//                 Eliminando...
//               </>
//             ) : (
//               <>
//                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
//                 </svg>
//                 Eliminar
//               </>
//             )}
//           </button>

//           <button
//             onClick={onCancel}
//             disabled={loading}
//             className="bg-gray-200 px-5 py-2.5 rounded-lg text-gray-800 hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
//           >
//             Cancelar
//           </button>
//         </div>

//         {/* Información técnica */}
//         <div className="mt-6 text-xs text-gray-500">
//           <p className="font-medium mb-1">Método técnico:</p>
//           <code className="bg-gray-100 p-1 rounded text-xs">
//             PUT /ISAPI/AccessControl/UserInfo/Delete
//           </code>
//         </div>

//       </div>
//     </div>
//   );
// }