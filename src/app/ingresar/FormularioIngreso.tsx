'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

import { iniciarSesion, type EstadoIngreso } from './acciones';

export function FormularioIngreso({ siguiente }: { siguiente: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(iniciarSesion, {});
  const [verClave, setVerClave] = useState(false);

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="siguiente" value={siguiente} />

      <div className="campo">
        <label className="campo-label" htmlFor="correo">
          Correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="campo-input"
          placeholder="tu@somos.cl"
        />
      </div>

      <div className="campo">
        <label className="campo-label" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={verClave ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className="campo-input !pr-12"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-2 text-dim transition-colors hover:text-ink"
          >
            {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      {estado.error && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.08)] px-4 py-3 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      <button type="submit" className="btn btn-primario mt-1 w-full" disabled={pendiente}>
        {pendiente ? (
          <>
            <Loader2 size={18} className="girando" />
            Entrando…
          </>
        ) : (
          <>
            <LogIn size={18} />
            Iniciar sesión
          </>
        )}
      </button>
    </form>
  );
}
