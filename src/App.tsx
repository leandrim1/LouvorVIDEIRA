import { RouterProvider } from 'react-router-dom'
import { ConfirmProvider, ToastProvider } from '@/components/ui'
import { SessionProvider } from '@/contexts/SessionProvider'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { router } from './routes/router'

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
