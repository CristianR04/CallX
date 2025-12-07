// hooks/useRole.ts
"use client";

import { useSession } from "next-auth/react";

export function useRole() {
  const { data: session, status } = useSession();
  
  const userRole = session?.user?.role || "";
  
  const hasRole = (role: string | string[]) => {
    if (!userRole) return false;
    
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    
    return userRole === role;
  };
  
  const isAdmin = userRole === "Administrador";
  const isTI = userRole === "TI";
  
  return {
    role: userRole,
    hasRole,
    isAdmin,
    isTI,
    isLoading: status === "loading",
    isAuthenticated: !!session,
    user: session?.user,
  };
}