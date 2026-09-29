import { RouterProvider } from 'react-router-dom'
import { AuthGate } from '@/components/auth/AuthGate'
import { ConfirmProvider, ToastProvider } from '@/components/ui'
import { AuthProvider } from '@/contexts/AuthProvider'
import { SessionProvider } from '@/contexts/SessionProvider'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { router } from './routes/router'

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <SessionProvider>
              <AuthGate>
                <RouterProvider router={router} />
              </AuthGate>
            </SessionProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
