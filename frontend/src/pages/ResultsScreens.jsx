import { useState } from 'react'
import { Archive, BadgeCheck, ClipboardCheck, Download, ExternalLink, Settings2 } from 'lucide-react'
import { calculateGraduationReport } from '../services/api.js'
import { downloadCertificatePdf } from '../services/certificatePdf.js'

const primary = 'inline-flex min-h-10 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 border border-hub-line bg-white px-4 text-sm font-semibold hover:border-hub-purple disabled:opacity-50'
const field = 'mt-1.5 min-h-10 w-full border border-hub-line bg-white px-3 text-sm text-hub-ink'
const labels = { ELIGIBLE: 'Eligible', INELIGIBLE: 'Not eligible', INCOMPLETE: 'Incomplete' }
const tones = { ELIGIBLE: 'bg-emerald-100 text-emerald-900', INELIGIBLE: 'bg-red-100 text-red-900', INCOMPLETE: 'bg-stone-100 text-hub-ink' }

function percent(value) {
  return value == null ? 'Not available' : `${Number(value.toFixed(2))}%`
}

export function ResultsManager({ snapshot, user, cohorts, busy, onSaveRequirements, onFinalize, onIssueCertificates }) {
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? '')
  const cohort = cohorts.find((item) => item.id === Number(cohortId))
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hub-line pb-5">
      <div><h1 className="text-2xl font-semibold">Results and eligibility</h1><p className="mt-1 text-sm text-hub-muted">Cohort performance and graduation review</p></div>
      <label className="w-full text-xs font-semibold text-hub-muted sm:w-72">Cohort<select className={field} value={cohortId} onChange={(event) => setCohortId(event.target.value)}><option value="">Choose a cohort</option>{cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>
    {cohort ? <CohortResults key={cohort.id} snapshot={snapshot} cohort={cohort} user={user} busy={busy} onSaveRequirements={onSaveRequirements} onFinalize={onFinalize} onIssueCertificates={onIssueCertificates} /> : <p className="border-y border-hub-line bg-white p-5 text-sm text-hub-muted">No cohorts are available.</p>}
  </section>
}

function CohortResults({ snapshot, cohort, user, busy, onSaveRequirements, onFinalize, onIssueCertificates }) {
  const [tab, setTab] = useState('live')
  const [editing, setEditing] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState(null)
  const [error, setError] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [eligibilityFilter, setEligibilityFilter] = useState('ALL')
  const canManage = ['SUPER_ADMIN', 'BRANCH_ADMIN'].includes(user.application_role)
  const requirements = snapshot.graduationRequirements.find((item) => item.cohort === cohort.id)
  const liveReport = calculateGraduationReport(snapshot, cohort.id)
  const history = snapshot.graduationSnapshots.filter((item) => item.cohort === cohort.id).toSorted((left, right) => right.id - left.id)
  const archived = history.find((item) => item.id === selectedSnapshot)
  const report = tab === 'history' ? archived?.report : liveReport
  const certificates = snapshot.certificates.filter((certificate) => certificate.cohort === cohort.id)
  const eligibleStudents = (liveReport?.students ?? []).filter((row) => row.eligibility === 'ELIGIBLE')
  const pendingStudents = eligibleStudents.filter((row) => !certificates.some((certificate) => certificate.student === row.student.id))
  const searchTerm = studentQuery.trim().toLowerCase()
  const visibleReport = report ? {
    ...report,
    students: report.students.filter((row) => {
      const studentName = `${row.student.first_name} ${row.student.last_name}`.trim().toLowerCase()
      const matchesQuery = !searchTerm || studentName.includes(searchTerm) || row.student.username.toLowerCase().includes(searchTerm)
      return matchesQuery && (eligibilityFilter === 'ALL' || row.eligibility === eligibilityFilter)
    }),
  } : null
  const isAvailable = (assessment) => assessment.status === 'PUBLISHED' && assessment.branch === cohort.branch && (
    assessment.cohort === cohort.id || (assessment.curriculum_topic && snapshot.curriculumVersions.some((version) => version.id === cohort.curriculum_version && version.topics.some((topic) => String(topic.id) === String(assessment.curriculum_topic))))
  )
  const availableAssessments = snapshot.assessments.filter((assessment) => isAvailable(assessment) || requirements?.required_assessments.includes(assessment.id)).map((assessment) => isAvailable(assessment) ? assessment : { ...assessment, title: `${assessment.title} (no longer assigned)` })

  async function save(input) {
    setError('')
    try { await onSaveRequirements(cohort.id, input); setEditing(false) } catch (failure) { setError(failure.message) }
  }
  async function finalize() {
    if (!window.confirm(`Finalize the current results for ${cohort.name}?`)) return
    setError('')
    try { await onFinalize(cohort.id) } catch (failure) { setError(failure.message) }
  }

  async function issueCertificates() {
    setError('')
    try { await onIssueCertificates(cohort.id, pendingStudents.map((row) => row.student.id)) } catch (failure) { setError(failure.message) }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-5 border-b border-hub-line"><button type="button" className={`border-b-2 pb-3 text-sm font-semibold ${tab === 'live' ? 'border-hub-purple text-hub-purple' : 'border-transparent text-hub-muted'}`} onClick={() => { setTab('live'); setEditing(false) }}>Current results</button><button type="button" className={`border-b-2 pb-3 text-sm font-semibold ${tab === 'history' ? 'border-hub-purple text-hub-purple' : 'border-transparent text-hub-muted'}`} onClick={() => { setTab('history'); setEditing(false); setSelectedSnapshot(history[0]?.id ?? null) }}>Finalized history ({history.length})</button></div>{canManage && tab === 'live' && <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => { setError(''); setEditing(!editing) }}><Settings2 size={16} aria-hidden="true" />{requirements ? 'Edit requirements' : 'Set requirements'}</button>{requirements && <button type="button" className={secondary} disabled={busy || editing || pendingStudents.length === 0} onClick={issueCertificates}><BadgeCheck size={16} aria-hidden="true" />Issue certificates{pendingStudents.length ? ` (${pendingStudents.length})` : ''}</button>}{requirements && <button type="button" className={primary} disabled={busy || editing} onClick={finalize}><Archive size={16} aria-hidden="true" />Finalize results</button>}</div>}</div>
    {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
    {editing && <RequirementsEditor requirements={requirements} assessments={availableAssessments} busy={busy} onSave={save} onCancel={() => { setEditing(false); setError('') }} />}
    {tab === 'history' && <div className="flex flex-wrap items-end gap-3"><label className="w-full max-w-sm text-xs font-semibold text-hub-muted">Finalized report<select className={field} value={selectedSnapshot ?? ''} onChange={(event) => setSelectedSnapshot(Number(event.target.value) || null)}><option value="">Choose a report</option>{history.map((item) => <option key={item.id} value={item.id}>{new Date(item.finalized_at).toLocaleString()} · {item.report.finalized_by?.name}</option>)}</select></label></div>}
    {!editing && report && report.students.length > 0 && <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <label className="text-xs font-semibold text-hub-muted">Find a student<input className={field} type="search" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Name or username" /></label>
      <label className="text-xs font-semibold text-hub-muted">Eligibility<select className={field} value={eligibilityFilter} onChange={(event) => setEligibilityFilter(event.target.value)}><option value="ALL">All students</option><option value="ELIGIBLE">Eligible</option><option value="INELIGIBLE">Not eligible</option><option value="INCOMPLETE">Incomplete</option></select></label>
      <p className="text-xs text-hub-muted sm:col-span-2">Showing {visibleReport.students.length} of {report.students.length} students</p>
    </div>}
    {!editing && !report && <div className="border-y border-hub-line bg-white px-5 py-8"><ClipboardCheck size={22} className="text-hub-purple" aria-hidden="true" /><h2 className="mt-3 font-semibold">{tab === 'history' ? 'No finalized reports' : 'Requirements not set'}</h2><p className="mt-1 text-sm text-hub-muted">{tab === 'history' ? 'Finalized results will appear here.' : 'An administrator must set requirements for this cohort.'}</p></div>}
    {!editing && report && visibleReport.students.length === 0 && report.students.length > 0 && <p className="border-y border-hub-line bg-white p-5 text-sm text-hub-muted">No students match these filters. Change the search or eligibility selection.</p>}
    {!editing && report && (visibleReport.students.length > 0 || report.students.length === 0) && <Report report={visibleReport} />}
    {!editing && certificates.length > 0 && <section className="space-y-3">
      <h2 className="text-base font-semibold">Issued certificates <span className="font-normal text-hub-muted">({certificates.length})</span></h2>
      <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
        {certificates.map((certificate) => <article key={certificate.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><p className="text-sm font-semibold">{certificate.student_name}</p><p className="mt-1 text-xs text-hub-muted">{certificate.certificate_number} · {new Date(certificate.issued_at).toLocaleDateString()}</p></div>
          <div className="flex flex-wrap gap-2"><a className={secondary} href={`/?verify=${encodeURIComponent(certificate.verification_code)}`} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" />Verify</a><button type="button" className={secondary} onClick={() => downloadCertificatePdf(certificate)}><Download size={15} aria-hidden="true" />PDF</button></div>
        </article>)}
      </div>
    </section>}
  </div>
}

function RequirementsEditor({ requirements, assessments, busy, onSave, onCancel }) {
  const [form, setForm] = useState({ minimum_attendance: requirements?.minimum_attendance ?? '', minimum_assessment_score: requirements?.minimum_assessment_score ?? '', required_assessments: requirements?.required_assessments ?? [] })
  return <form className="max-w-3xl space-y-4 border-y border-hub-line bg-white p-5" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><h2 className="text-lg font-semibold">Graduation requirements</h2><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Minimum attendance (%)<input className={field} type="number" min="0" max="100" step="0.01" required value={form.minimum_attendance} onChange={(event) => setForm({ ...form, minimum_attendance: event.target.value })} /></label><label className="text-sm font-medium">Minimum assessment average (%)<input className={field} type="number" min="0" max="100" step="0.01" required value={form.minimum_assessment_score} onChange={(event) => setForm({ ...form, minimum_assessment_score: event.target.value })} /></label></div><fieldset><legend className="text-sm font-semibold">Required assessments</legend><div className="mt-2 divide-y divide-hub-line border-y border-hub-line">{assessments.length ? assessments.map((assessment) => <label key={assessment.id} className="flex min-h-12 items-center gap-3 py-2 text-sm"><input type="checkbox" checked={form.required_assessments.includes(assessment.id)} onChange={(event) => setForm({ ...form, required_assessments: event.target.checked ? [...form.required_assessments, assessment.id] : form.required_assessments.filter((id) => id !== assessment.id) })} /><span>{assessment.title}</span></label>) : <p className="py-4 text-sm text-hub-muted">No published assessments are available for this cohort.</p>}</div></fieldset><div className="flex flex-wrap gap-2"><button className={primary} disabled={busy}>Save requirements</button><button type="button" className={secondary} onClick={onCancel}>Cancel</button></div></form>
}

function Report({ report }) {
  const rows = report.students
  return <div className="space-y-4"><div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-hub-line bg-white px-4 py-3 text-sm"><span>Attendance minimum: <strong>{percent(report.requirements.minimum_attendance)}</strong></span><span>Assessment minimum: <strong>{percent(report.requirements.minimum_assessment_score)}</strong></span><span>Required assessments: <strong>{report.requirements.required_assessments.length}</strong></span></div><div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-hub-muted"><span>{rows.filter((row) => row.eligibility === 'ELIGIBLE').length} eligible</span><span>{rows.filter((row) => row.eligibility === 'INELIGIBLE').length} not eligible</span><span>{rows.filter((row) => row.eligibility === 'INCOMPLETE').length} incomplete</span></div><div className="divide-y divide-hub-line border-y border-hub-line bg-white">{rows.length ? rows.map((row) => <details key={row.student.id} className="group"><summary className="grid cursor-pointer gap-3 px-4 py-4 text-sm hover:bg-[#fbf8fc] sm:grid-cols-[minmax(0,1.4fr)_minmax(100px,.7fr)_minmax(100px,.7fr)_auto] sm:items-center"><span className="min-w-0 font-semibold">{`${row.student.first_name} ${row.student.last_name}`.trim() || row.student.username}</span><span><span className="block text-xs text-hub-muted">Attendance</span>{percent(row.attendance_percentage)}</span><span><span className="block text-xs text-hub-muted">Assessment average</span>{percent(row.assessment_average)}</span><span className={`w-fit px-2 py-1 text-xs font-semibold ${tones[row.eligibility]}`}>{labels[row.eligibility]}</span></summary><div className="space-y-3 border-t border-hub-line px-4 py-4 text-sm"><p>Attendance: {row.attended_sessions} attended · {row.excused_sessions} excused · {row.completed_sessions} completed sessions</p>{row.reasons.length > 0 && <ul className="list-disc space-y-1 pl-5 text-hub-muted">{row.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}<div className="divide-y divide-hub-line border-y border-hub-line">{row.assessments.map((assessment) => <div key={assessment.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{assessment.title}</span><span>{assessment.attempt_number ? `Attempt ${assessment.attempt_number} · ${percent(assessment.score_percentage)}` : 'Not completed'}</span></div>)}</div></div></details>) : <p className="p-5 text-sm text-hub-muted">No students are enrolled in this cohort.</p>}</div></div>
}