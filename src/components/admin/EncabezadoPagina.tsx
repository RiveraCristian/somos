type Props = {
  titulo: string;
  subtitulo?: string;
  children?: React.ReactNode;
};

export function EncabezadoPagina({ titulo, subtitulo, children }: Props) {
  return (
    <header className="mb-9 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-7">
      <div>
        <h1 className="titulo-display text-3xl sm:text-4xl">{titulo}</h1>
        {subtitulo && <p className="mt-2.5 text-dim">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}
