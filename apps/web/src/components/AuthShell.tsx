import { Link } from 'react-router-dom';
import Waveform from './Waveform';

/**
 * Split auth layout: the dark "record" panel carries the brand and value
 * proposition; the light "reading" panel carries the form.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 lg:flex-row">
      {/* The record */}
      <div className="flex flex-col justify-between px-6 py-8 text-white lg:w-[44%] lg:px-14 lg:py-12">
        <Link to="/" className="flex w-fit items-center gap-2.5 rounded-md">
          <Waveform seed="verity" bars={5} className="h-4 text-verity-400" />
          <span className="font-display text-xl font-bold tracking-tight">Verity</span>
        </Link>

        <div className="hidden lg:block">
          <Waveform
            seed="every-call-on-the-record"
            bars={44}
            animate
            className="h-20 text-verity-400/70"
          />
          <h1 className="mt-10 font-display text-4xl font-bold leading-[1.1] tracking-tight">
            Every sales call,
            <br />
            on the record.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-300">
            Verity reads the call transcript, reads the rep&apos;s form, and
            shows you exactly where the two stories disagree.
          </p>
        </div>

        <p className="hidden text-xs text-ink-500 lg:block">
          © {new Date().getFullYear()} Verity
        </p>
      </div>

      {/* The reading */}
      <div className="flex flex-1 items-center justify-center rounded-t-3xl bg-porcelain px-4 py-10 lg:rounded-none lg:px-8">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-ink-500">{footer}</p>
        </div>
      </div>
    </div>
  );
}
