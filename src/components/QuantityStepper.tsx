import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { MAX_QUANTITY } from '../../shared/schemas'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface Props {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  /**
   * Se informado, diminuir abaixo de 1 pede confirmação e chama onConfirm (remover).
   * Se omitido, o botão "−" trava em 1.
   */
  confirmRemove?: { cardName: string; onConfirm: () => void }
}

export function QuantityStepper({ value, onChange, disabled, confirmRemove }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const decrement = () => {
    if (value > 1) onChange(value - 1)
    else if (confirmRemove) setConfirmOpen(true)
  }

  return (
    <>
      <div className="inline-flex items-center gap-1" role="group" aria-label="Quantidade">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={decrement}
          disabled={disabled || (value <= 1 && !confirmRemove)}
          aria-label="Diminuir quantidade"
        >
          <Minus />
        </Button>
        <span className="min-w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(value + 1)}
          disabled={disabled || value >= MAX_QUANTITY}
          aria-label="Aumentar quantidade"
        >
          <Plus />
        </Button>
      </div>

      {confirmRemove && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover da coleção?</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmRemove.cardName} sairá da sua coleção. Você pode adicioná-la de novo depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemove.onConfirm}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
