"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { useToast, type Toast as ToastType } from "@/lib/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, removeToast } = useToast()

  React.useEffect(() => {
    // グローバルリスナーの登録（必要に応じて）
  }, [])

  return (
    <ToastPrimitives.Provider>
      <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
        {toasts.map(function (toast: ToastType) {
          return (
            <Toast
              key={toast.id}
              variant={toast.variant}
              onOpenChange={(open) => {
                if (!open) removeToast(toast.id)
              }}
            >
              <div className="grid gap-1">
                {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
                {toast.description && (
                  <ToastDescription>{toast.description}</ToastDescription>
                )}
              </div>
              <ToastClose onClick={() => removeToast(toast.id)} />
            </Toast>
          )
        })}
      </div>
      <ToastPrimitives.Viewport />
    </ToastPrimitives.Provider>
  )
}
