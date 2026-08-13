'use client';

import { useActionState } from 'react';
import { AlertCircle, Loader2, MailCheck, Send } from 'lucide-react';

import { reenviarLink } from '@/app/comprar/acciones';

export function FormularioRecuperar() {
  const [estado, accion, pendiente] = useActionState(reenviarLink, {});

  return (
    <form action={accion} className="flex flex-col gap-5">
      <div className="campo">
        <label className="campo-label" htmlFor="correo">
          Tu correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          required
          maxLength={255}
          autoComplete="email"
          className="campo-input"
          placeholder="tu@correo.cl"
        />
        <span className="campo-ayuda">El mismo con el que compraste.</span>
      </div>

      {estado.error && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] px-4 py-3 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      {estado.aviso && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(53,240,160,0.3)] bg-[rgba(53,240,160,0.08)] px-4 py-3 text-sm text-ok">
          <MailCheck size={16} className="mt-0.5 shrink-0" />
          {estado.aviso}
        </p>
      )}

      <button type="submit" className="btn btn-primario w-full" disabled={pendiente}>
        {pendiente ? (
          <>
            <Loader2 size={18} className="girando" />
            Buscando…
          </>
        ) : (
          <>
            <Send size={17} />
            Mandarme el link
          </>
        )}
      </button>
    </form>
  );
}
