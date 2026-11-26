import { useEffect, useState } from 'react'
import { BadgeCheck, Download, ExternalLink, Search, ShieldCheck } from 'lucide-react'
import { mockApi } from './api/mockApi.js'
import { downloadCertificatePdf } from './certificatePdf.js'

const primary = 'inline-flex min-h-10 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:opacity-50'
const input = 'mt-1.5 min-h-10 w-full border border-hub-line bg-white px-3 text-sm text-hub-ink'

export function StudentCertificateScreen({ certificates }) {
  return <section className="space-y-5">
    <div className="border-b border-hub-line pb-5">
      <h1 className="text-2xl font-semibold">My certificates</h1>
      <p className="mt-1 text-sm text-hub-muted">Download and share your completed cohort certificates</p>
    </div>
    {certificates.length ? <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
      {certificates.map((certificate) => <article key={certificate.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <BadgeCheck className="mt-0.5 shrink-0 text-emerald-800" size={19} aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold">{certificate.cohort_name}</h2>
            <p className="mt-1 text-xs text-hub-muted">{certificate.certificate_number} · Issued {new Date(certificate.issued_at).toLocaleDateString()}</p>
            <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-hub-purple underline underline-offset-2" href={`/?verify=${encodeURIComponent(certificate.verification_code)}`} target="_blank" rel="noreferrer">
              Verify certificate <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
        <button type="button" className={primary} onClick={() => downloadCertificatePdf(certificate)}>
          <Download size={16} aria-hidden="true" />Download PDF
        </button>
      </article>)}
    </div> : <div className="border-y border-hub-line bg-white px-5 py-8">
      <ShieldCheck size={22} className="text-hub-muted" aria-hidden="true" />
      <h2 className="mt-3 font-semibold">No certificates yet</h2>
      <p className="mt-1 text-sm text-hub-muted">Certificates appear here after your cohort administrator issues one.</p>
    </div>}
    <p className="text-xs text-hub-muted">Demo certificates are stored in this browser. Downloaded PDFs include a public verification link.</p>
  </section>
}

export function PublicCertificateVerification({ initialReference = '' }) {
  const [reference, setReference] = useState(initialReference)
  const [result, setResult] = useState(null)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(Boolean(initialReference))

  async function verify(value) {
    setBusy(true)
    setChecked(false)
    try {
      setResult(await mockApi.verifyCertificate(value))
    } finally {
      setChecked(true)
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!initialReference) return undefined
    let active = true
    mockApi.verifyCertificate(initialReference).then((value) => {
      if (active) {
        setResult(value)
        setChecked(true)
        setBusy(false)
      }
    })
    return () => { active = false }
  }, [initialReference])

  return <main className="min-h-screen bg-[#f5f3f6] px-4 py-8 sm:px-6 sm:py-12">
    <section className="mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-3 border-b border-hub-line bg-white px-5 py-4">
        <span className="grid size-9 place-items-center bg-hub-purple text-white"><ShieldCheck size={19} aria-hidden="true" /></span>
        <div><p className="text-sm font-bold">MembershipHub</p><p className="text-xs text-hub-muted">Public certificate verification</p></div>
      </div>
      <div className="space-y-5 border-b border-hub-line bg-white px-5 py-6 sm:px-7">
        <div>
          <h1 className="text-2xl font-semibold">Verify a certificate</h1>
          <p className="mt-2 text-sm text-hub-muted">Enter the unique verification reference printed on the certificate.</p>
        </div>
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); verify(reference) }}>
          <label className="text-xs font-semibold text-hub-muted">Verification reference<input className={input} required value={reference} onChange={(event) => setReference(event.target.value)} autoComplete="off" /></label>
          <button type="submit" className={primary} disabled={busy || !reference.trim()}><Search size={16} aria-hidden="true" />{busy ? 'Checking…' : 'Verify'}</button>
        </form>
        {checked && (result ? <div role="status" className="border-y border-emerald-300 bg-emerald-50 px-4 py-4">
          <p className="flex items-center gap-2 font-semibold text-emerald-950"><BadgeCheck size={18} aria-hidden="true" />Certificate is valid</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-hub-muted">Recipient</dt><dd className="mt-0.5 font-semibold">{result.recipient_name}</dd></div>
            <div><dt className="text-xs text-hub-muted">Certificate number</dt><dd className="mt-0.5 font-semibold">{result.certificate_number}</dd></div>
            <div><dt className="text-xs text-hub-muted">Cohort</dt><dd className="mt-0.5">{result.cohort_name}</dd></div>
            <div><dt className="text-xs text-hub-muted">Branch</dt><dd className="mt-0.5">{result.branch_name}</dd></div>
            <div><dt className="text-xs text-hub-muted">Date issued</dt><dd className="mt-0.5">{new Date(result.issued_at).toLocaleDateString()}</dd></div>
          </dl>
        </div> : <p role="status" className="border-y border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">No matching certificate was found. Check the reference and try again.</p>)}
        <p className="text-xs text-hub-muted">This demo checks certificates stored in this browser only; it is not connected to the public Django verification API.</p>
      </div>
    </section>
  </main>
}