import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, HeartHandshake, ShieldAlert, UserCheck } from 'lucide-react';

import { Aparecer } from '@/components/movimiento/Aparecer';
import { Encabezado } from '@/components/publico/Encabezado';
import { PiePagina } from '@/components/publico/PiePagina';
import { obtenerEventoPublico } from '@/lib/datos';

// Lee el evento para la ciudad y el Instagram del pie. Sin esto, Next intenta
// prerenderizarla durante el build, donde no hay base de datos.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Términos y exención de responsabilidad',
  description:
    'Condiciones de acceso, permanencia y exención de responsabilidad civil del evento privado SOMOS.',
};

/** Las tres cosas que alguien tiene que saber antes de leer la letra chica. */
const DESTACADOS = [
  {
    icono: <UserCheck size={20} />,
    titulo: 'Solo mayores de 18',
    texto: 'Se controla en la puerta con cédula. Sin excepciones y sin devolución.',
  },
  {
    icono: <HeartHandshake size={20} />,
    titulo: 'Sin fines de lucro',
    texto:
      'Lo que se recauda cubre producción y técnica. No hay utilidad para nadie: esto es una reunión privada autogestionada.',
  },
  {
    icono: <ShieldAlert size={20} />,
    titulo: 'Derecho de admisión',
    texto:
      'La organización se reserva el derecho de admisión y permanencia, sin derecho a reembolso.',
  },
];

type Clausula = { titulo: string; parrafos?: string[]; puntos?: string[] };
type Seccion = { numero: string; titulo: string; clausulas: Clausula[] };

const SECCIONES: Seccion[] = [
  {
    numero: '1',
    titulo: 'Naturaleza del evento y derecho de admisión',
    clausulas: [
      {
        titulo: '1.1',
        parrafos: [
          'SOMOS es una experiencia de carácter estrictamente privado, de asistencia restringida a la lista de invitados y gestionada sin fines de lucro. Los fondos recaudados se destinan exclusivamente a cubrir los costos de producción y técnica del evento.',
        ],
      },
      {
        titulo: '1.2',
        parrafos: [
          'El acceso al recinto privado está restringido únicamente a las personas que figuren en la lista de invitados autorizados y que hayan verificado previamente su identidad mediante su número de teléfono y correo electrónico. Cada número habilitado da derecho a una entrada.',
        ],
      },
      {
        titulo: '1.3',
        parrafos: [
          'Los organizadores se reservan de manera estricta el derecho de admisión y permanencia. Se prohibirá el ingreso o se solicitará el retiro del recinto, sin derecho a reembolso, a cualquier persona que:',
        ],
        puntos: [
          'Muestre un comportamiento agresivo, ofensivo o que perturbe la seguridad y la convivencia del evento.',
          'Intente ingresar bajo la influencia de sustancias ilícitas o en un estado de temperancia que los organizadores consideren de riesgo.',
          'No cuente con su entrada digital válida (código QR nominal de un solo uso).',
          'Sea menor de 18 años. El evento es exclusivamente para personas mayores de edad y la edad se verifica en la puerta.',
        ],
      },
    ],
  },
  {
    numero: '2',
    titulo: 'Acceso y validación de entradas',
    clausulas: [
      {
        titulo: '2.1',
        parrafos: [
          'El acceso al recinto se otorgará exclusivamente mediante la presentación del código QR único enviado al correo electrónico del asistente tras la confirmación de su pago.',
        ],
      },
      {
        titulo: '2.2',
        parrafos: [
          'Cada entrada es personal, nominal y de un solo uso. No se permitirá el acceso a personas que no estén previamente registradas en la lista de verificación de la portería del recinto.',
        ],
      },
      {
        titulo: '2.3',
        parrafos: [
          'La dirección exacta del recinto se entrega únicamente a quienes ya tienen su entrada confirmada, a través de su página de entrada y del correo de confirmación. No se publica en el sitio ni se comparte por redes sociales.',
        ],
      },
    ],
  },
  {
    numero: '3',
    titulo: 'Delimitación y exención de responsabilidad civil',
    clausulas: [
      {
        titulo: '',
        parrafos: [
          'Al adquirir su entrada y/o ingresar al recinto privado del evento, el asistente declara conocer, comprender y aceptar voluntariamente las siguientes cláusulas de exención de responsabilidad de los organizadores:',
        ],
      },
      {
        titulo: '3.1 · Uso del espacio privado',
        parrafos: [
          'El evento se desarrolla en un recinto de propiedad privada. Los asistentes asumen el deber de cuidado y comportamiento prudente dentro de las instalaciones, respetando las zonas delimitadas de exclusión y de tránsito habilitadas.',
        ],
      },
      {
        titulo: '3.2 · Daños personales o accidentes',
        parrafos: [
          'Al ser una reunión privada autogestionada y sin fines de lucro, los organizadores no se hacen responsables por lesiones, accidentes, percances médicos o problemas de salud que sufran los asistentes dentro del recinto, derivados de su propia negligencia, de la ingesta desmedida de alcohol o de la conducta de terceros. El asistente asume bajo su propio riesgo su participación en las actividades del evento.',
        ],
      },
      {
        titulo: '3.3 · Pérdida o daño de bienes personales',
        parrafos: [
          'Los organizadores no asumen responsabilidad alguna por la pérdida, robo, hurto o daño de objetos personales, vehículos, vestimenta o cualquier otro bien de propiedad de los asistentes dentro o en las inmediaciones del recinto.',
        ],
      },
      {
        titulo: '3.4 · Fuerza mayor o caso fortuito',
        parrafos: [
          'Los organizadores no serán responsables por la cancelación, suspensión o interrupción del evento debido a causas de fuerza mayor o caso fortuito, tales como condiciones climáticas extremas, fallas generales de suministro eléctrico ajenas a la producción, o disposiciones de la autoridad competente.',
        ],
      },
    ],
  },
  {
    numero: '4',
    titulo: 'Obligaciones del asistente',
    clausulas: [
      {
        titulo: '4.1 · Comportamiento cívico',
        parrafos: [
          'El asistente se compromete a mantener una conducta de respeto mutuo hacia los demás invitados, el personal del staff y las instalaciones del recinto privado.',
        ],
      },
      {
        titulo: '4.2 · Consumo responsable',
        parrafos: [
          'El consumo de cualquier bebida o sustancia dentro del recinto es de exclusiva responsabilidad individual del asistente.',
        ],
      },
      {
        titulo: '4.3 · Cuidado del entorno',
        parrafos: [
          'Al tratarse de un espacio privado y un entorno comunitario, los asistentes deben colaborar activamente con la limpieza y preservación del lugar, utilizando los contenedores habilitados para los residuos.',
        ],
      },
    ],
  },
  {
    numero: '5',
    titulo: 'Aceptación de los términos',
    clausulas: [
      {
        titulo: '',
        parrafos: [
          'La adquisición de la entrada a través del proceso de reserva, la transferencia de fondos (ya sea vía Fintoc o transferencia bancaria directa) y la posterior recepción del código QR constituyen la aceptación expresa, plena y sin reservas de la totalidad de las cláusulas aquí descritas.',
        ],
      },
    ],
  },
];

export default async function PaginaTerminos() {
  const evento = await obtenerEventoPublico();
  const ciudad = evento?.eventoCiudad ?? 'Talca';
  const region = evento?.eventoRegion ?? 'Región del Maule';

  return (
    <>
      <Encabezado />

      <main className="contenedor py-14">
        <div className="mx-auto max-w-3xl">
          <Aparecer>
            <p className="eyebrow">Letra chica</p>
            <h1 className="titulo-display mt-3 text-3xl sm:text-4xl">
              Términos, condiciones y exención de responsabilidad
            </h1>
            <p className="mt-4 leading-relaxed text-dim">
              Condiciones de acceso, permanencia y delimitación de responsabilidad civil para los
              asistentes del evento privado SOMOS, que se realiza en la comuna de {ciudad},{' '}
              {region}.
            </p>
          </Aparecer>

          {/* Lo importante arriba: casi nadie lee las 5 secciones completas. */}
          <Aparecer className="mt-10 grid gap-4 sm:grid-cols-3">
            {DESTACADOS.map((d) => (
              <div key={d.titulo} className="tarjeta flex flex-col gap-3 p-5">
                <span className="text-cyan">{d.icono}</span>
                <h2 className="font-semibold">{d.titulo}</h2>
                <p className="text-sm leading-relaxed text-dim">{d.texto}</p>
              </div>
            ))}
          </Aparecer>

          <div className="mt-14 flex flex-col gap-12">
            {SECCIONES.map((seccion) => (
              <Aparecer key={seccion.numero}>
                <section>
                  <h2 className="titulo-display text-2xl">
                    <span className="mr-3 text-violeta">{seccion.numero}</span>
                    {seccion.titulo}
                  </h2>

                  <div className="mt-5 flex flex-col gap-5 border-l border-line pl-5">
                    {seccion.clausulas.map((clausula, i) => (
                      <div key={clausula.titulo || i}>
                        {clausula.titulo && (
                          <h3 className="dato text-xs tracking-[0.16em] text-cyan uppercase">
                            {clausula.titulo}
                          </h3>
                        )}

                        {clausula.parrafos?.map((parrafo) => (
                          <p
                            key={parrafo.slice(0, 40)}
                            className="mt-2 text-sm leading-relaxed text-dim"
                          >
                            {parrafo}
                          </p>
                        ))}

                        {clausula.puntos && (
                          <ul className="mt-3 flex flex-col gap-2">
                            {clausula.puntos.map((punto) => (
                              <li
                                key={punto.slice(0, 40)}
                                className="flex gap-3 text-sm leading-relaxed text-dim"
                              >
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-magenta" />
                                <span>{punto}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </Aparecer>
            ))}
          </div>

          <Aparecer className="mt-14">
            <Link href="/" className="btn btn-borde">
              <ArrowLeft size={16} />
              Volver al inicio
            </Link>
          </Aparecer>
        </div>
      </main>

      <PiePagina instagram={evento?.eventoInstagram} ciudad={evento?.eventoCiudad} />
    </>
  );
}
