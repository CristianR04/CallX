// components/CRUD/UserAvatar.tsx
"use client";

import { useState, useEffect } from 'react';

interface UserAvatarProps {
  employeeNo: string;
  nombre: string;
  dispositivo?: string;
  className?: string;
}

export default function UserAvatar({ employeeNo, nombre, dispositivo, className = "" }: UserAvatarProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const iniciales = nombre 
    ? nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : '?';

  useEffect(() => {
    if (!employeeNo) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const response = await fetch(`/api/foto/${employeeNo}`);
        
        if (response.ok) {
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setImgSrc(imageUrl);
        } else {
          throw new Error('Foto no encontrada');
        }
      } catch (error) {
        console.error(`Error cargando foto para ${employeeNo}:`, error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();

    // Cleanup
    return () => {
      if (imgSrc) {
        URL.revokeObjectURL(imgSrc);
      }
    };
  }, [employeeNo]);

  if (isLoading) {
    return (
      <div className={`w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (hasError || !imgSrc) {
    return (
      <div className={`w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-sm border ${className}`}>
        {iniciales}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={`Foto de ${nombre}`}
      className={`w-10 h-10 rounded-full object-cover border ${className}`}
      onError={() => setHasError(true)}
    />
  );
}