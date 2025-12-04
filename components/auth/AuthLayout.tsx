import { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  showLogo?: boolean
  className?: string
}

export default function AuthLayout({
  children,
  title,
  subtitle,
  showLogo = true,
  className
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {showLogo && (
          <Link href="/" className="flex justify-center">
            <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
          </Link>
        )}
        
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {title}
        </h2>
        
        {subtitle && (
          <p className="mt-2 text-center text-sm text-gray-600">
            {subtitle}
          </p>
        )}
      </div>

      <div className={cn("mt-8 sm:mx-auto sm:w-full sm:max-w-md", className)}>
        <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
          {children}
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Problemas para acceder?{' '}
            <Link 
              href="/contacto" 
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Contáctanos
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}