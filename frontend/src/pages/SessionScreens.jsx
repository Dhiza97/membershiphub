import { useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Plus,
} from 'lucide-react'

const SESSION_STATUS = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const ATTENDANCE_STATUS = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
}

const ATTENDANCE_TONE = {
  PRESENT: 'bg-emerald-100 text-emerald-900',
  ABSENT: 'bg-red-100 text-red-900',
  LATE: 'bg-hub-yellow text-hub-ink',
  EXCUSED: 'bg-stone-100 text-stone-700',
}

function displayDate(value) {
  if (!value) return 'Not set'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return 'Not set'
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

function statusStyle(status) {
  if (status === 'COMPLETED') return 'bg-hub-ink text-white'
  if (status === 'CANCELLED') return 'bg-stone-100 text-stone-700'
  return 'bg-hub-yellow text-hub-ink'
}

function Field({ label, className = '', ...props }) {
  return <label className={`block text-sm font-medium ${className}`}>{label}<input className="mt-1.5 min-h-11 w-full border border-hub-line bg-white px-3 text-sm font-normal text-hub-ink focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" {...props} /></label>
}

function SelectField({ label, children, ...props }) {
  return <label className="relative block text-sm font-medium">{label}<select className="mt-1.5 min-h-11 w-full appearance-none border border-hub-line bg-white px-3 pr-9 text-sm font-normal focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" {...props}>{children}</select><ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-hub-muted" size={16} aria-hidden="true" /></label>
}

export function SessionManager({ cohort, sessions, users, branches, attendance, attendanceReport, currentUser, busy, onBack, onSaveSession, onRecordAttendance }) {
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [error, setError] = useState('')
  const branch = branches.find((item) => item.id === cohort.branch)
  const instructor = users.find((item) => item.id === cohort.instructor)
  const orderedSessions = [...sessions].sort((left, right) => `${left.date} ${left.start_time}`.localeCompare(`${right.date} ${right.start_time}`))
  const selectedSession = sessions.find((session) => session.id === selectedSessionId)
  const canEdit = currentUser.application_role === 'SUPER_ADMIN'
    || currentUser.application_role === 'BRANCH_ADMIN'
    || (currentUser.application_role === 'INSTRUCTOR' && currentUser.id === cohort.instructor)
  const report = attendanceReport && {
    completedCount: attendanceReport.completed_session_count,
    percentage: attendanceReport.attendance_percentage,
    students: attendanceReport.students.map((row) => ({ studentId: row.student.id, attended: row.attended_sessions, excused: row.excused_sessions, completedSessions: row.completed_sessions, denominator: row.completed_sessions - row.excused_sessions, percentage: row.attendance_percentage })),
  }

  async function saveSession(input) {
    setError('')
    try {
      const saved = await onSaveSession({ ...input, cohort: cohort.id })
      setSelectedSessionId(saved.id)
      setCreating(false)
      setEditingSession(null)
    } catch (saveError) {
      setError(saveError.message)
      throw saveError
    }
  }

  async function record(sessionId, studentId, input) {
    setError('')
    try {
      await onRecordAttendance(sessionId, studentId, input)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  const title = selectedSession ? selectedSession.title : showReport ? 'Attendance report' : 'Class sessions'

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hub-line pb-5">
        <div className="flex items-start gap-3">
          <button type="button" onClick={selectedSession ? () => setSelectedSessionId(null) : showReport ? () => setShowReport(false) : onBack} aria-label="Back" className="mt-1 grid size-9 shrink-0 place-items-center border border-hub-line bg-white hover:border-hub-purple hover:text-hub-purple"><ArrowLeft size={17} aria-hidden="true" /></button>
          <div className="min-w-0"><h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-hub-muted">{cohort.name} · {branch?.name} · {branch?.timezone}</p></div>
        </div>
        {!selectedSession && !showReport && canEdit && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowReport(true)} className="inline-flex min-h-10 items-center gap-2 border border-hub-line bg-white px-3 text-sm font-semibold hover:border-hub-purple"><ClipboardCheck size={16} aria-hidden="true" />Attendance report</button><button type="button" onClick={() => { setError(''); setEditingSession(null); setCreating(true) }} className="inline-flex min-h-10 items-center gap-2 bg-hub-purple px-3 text-sm font-semibold text-white hover:bg-hub-purple-dark"><Plus size={16} aria-hidden="true" />New session</button></div>}
      </div>
      <p className="text-xs text-hub-muted">Times shown in {branch?.timezone}. Instructor: {instructor?.first_name} {instructor?.last_name}</p>
      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      {creating && <SessionEditor session={editingSession} busy={busy} branch={branch} cohort={cohort} onCancel={() => { setCreating(false); setEditingSession(null) }} onSave={saveSession} />}

      {selectedSession && (
        <SessionWorkspace
          key={selectedSession.id}
          session={selectedSession}
          cohort={cohort}
          users={users}
          attendance={attendance.filter((record) => record.session === selectedSession.id)}
          canEdit={canEdit}
          busy={busy}
          onEdit={() => { setEditingSession(selectedSession); setCreating(true); setSelectedSessionId(null) }}
          onRecord={(studentId, input) => record(selectedSession.id, studentId, input)}
        />
      )}

      {showReport && report && <AttendanceReport cohort={cohort} sessions={sessions} users={users} report={report} attendance={attendance} />}

      {!selectedSession && !showReport && !creating && (
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
          {orderedSessions.map((session) => {
            const records = attendance.filter((record) => record.session === session.id)
            const completedCount = records.length
            const summary = attendanceCounts(records)
            return (
              <button type="button" key={session.id} onClick={() => setSelectedSessionId(session.id)} className="grid w-full gap-3 px-4 py-4 text-left hover:bg-[#fbf8fc] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center">
                <span className="flex min-w-0 items-start gap-3"><CalendarDays size={18} className="mt-0.5 shrink-0 text-hub-purple" aria-hidden="true" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{session.title}</span><span className="mt-1 block text-xs text-hub-muted">{displayDate(session.date)} · {session.start_time}–{session.end_time}</span></span></span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-hub-muted"><span>{completedCount}/{cohort.students.length} recorded</span><span>{summary.present} present</span><span>{summary.late} late</span></span>
                <span className={`w-fit px-2.5 py-1 text-xs font-semibold ${statusStyle(session.status)}`}>{SESSION_STATUS[session.status]}</span>
              </button>
            )
          })}
          {orderedSessions.length === 0 && <div className="px-5 py-10 text-center"><CalendarDays className="mx-auto text-hub-purple" size={26} aria-hidden="true" /><h2 className="mt-3 font-semibold">No sessions scheduled</h2><p className="mt-1 text-sm text-hub-muted">Create a class meeting to start tracking participation.</p></div>}
        </div>
      )}
    </section>
  )
}

function SessionEditor({ session, cohort, branch, busy, onCancel, onSave }) {
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setError('')
    try {
      await onSave({
        id: session?.id,
        cohort: cohort.id,
        title: values.get('title'),
        description: values.get('description'),
        date: values.get('date'),
        start_time: values.get('start_time'),
        end_time: values.get('end_time'),
        status: values.get('status'),
      })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-y border-hub-line bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{session ? 'Edit session' : 'New session'}</h2><p className="mt-1 text-xs text-hub-muted">Local time zone: {branch?.timezone}</p></div><button type="button" onClick={onCancel} className="px-2 py-1 text-sm font-semibold text-hub-muted">Close</button></div>
      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Session title" name="title" required maxLength={180} defaultValue={session?.title ?? ''} placeholder="e.g. Welcome and belonging" />
        <Field label="Session date" name="date" type="date" required min={cohort.start_date || undefined} max={cohort.end_date || undefined} defaultValue={session?.date ?? ''} />
        <Field label="Start time" name="start_time" type="time" required defaultValue={session?.start_time ?? '18:00'} />
        <Field label="End time" name="end_time" type="time" required defaultValue={session?.end_time ?? '19:30'} />
      </div>
      <label className="block text-sm font-medium">Description<textarea name="description" rows={2} defaultValue={session?.description ?? ''} className="mt-1.5 w-full resize-y border border-hub-line bg-white px-3 py-2.5 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" /></label>
      {session && <SelectField label="Status" name="status" defaultValue={session.status}><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></SelectField>}
      <div className="flex justify-end gap-2 border-t border-hub-line pt-4"><button type="button" onClick={onCancel} className="min-h-10 px-3 text-sm font-semibold text-hub-muted">Cancel</button><button type="submit" disabled={busy} className="min-h-10 bg-hub-ink px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">Save session</button></div>
    </form>
  )
}

function SessionWorkspace({ session, cohort, users, attendance, canEdit, busy, onEdit, onRecord }) {
  const [recordError, setRecordError] = useState('')
  const records = new Map(attendance.map((record) => [record.student, record]))
  const enrolledStudents = cohort.students.map((id) => users.find((user) => user.id === id)).filter(Boolean)
  const counts = attendanceCounts(attendance)

  async function saveRecord(studentId, formData) {
    setRecordError('')
    try {
      await onRecord(studentId, formData)
    } catch (error) {
      setRecordError(error.message)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-y border-hub-line bg-white px-4 py-4">
        <div><h2 className="text-lg font-semibold">{session.title}</h2><p className="mt-1 text-sm text-hub-muted">{displayDate(session.date)} · {session.start_time}–{session.end_time}</p><p className="mt-1 text-xs text-hub-muted">{session.description || 'No description'}</p></div>
        <div className="flex items-center gap-2"><span className={`px-2.5 py-1 text-xs font-semibold ${statusStyle(session.status)}`}>{SESSION_STATUS[session.status]}</span>{canEdit && session.status !== 'CANCELLED' && <button type="button" onClick={onEdit} className="min-h-9 border border-hub-line px-3 text-sm font-semibold hover:border-hub-purple">Edit</button>}</div>
      </div>
      {recordError && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{recordError}</p>}
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-semibold">Attendance</h2><p className="mt-1 text-xs text-hub-muted">{attendance.length} of {enrolledStudents.length} students recorded</p></div><div className="flex flex-wrap gap-2 text-xs"><CountLabel value={counts.present} label="Present" /><CountLabel value={counts.late} label="Late" /><CountLabel value={counts.absent} label="Absent" /><CountLabel value={counts.excused} label="Excused" /></div></div>
      <div className="hidden overflow-x-auto border border-hub-line bg-white md:block"><table className="w-full min-w-[700px] table-fixed border-collapse text-left"><thead className="bg-hub-ink text-xs uppercase text-white"><tr><th className="w-[32%] px-4 py-3 font-semibold">Student</th><th className="w-[28%] px-4 py-3 font-semibold">Attendance</th><th className="w-[40%] px-4 py-3 font-semibold">Note</th></tr></thead><tbody>{enrolledStudents.map((student) => <AttendanceRow key={student.id} student={student} record={records.get(student.id)} editable={canEdit && session.status !== 'CANCELLED'} busy={busy} onSave={saveRecord} />)}</tbody></table></div>
      <div className="divide-y divide-hub-line border-y border-hub-line bg-white md:hidden">{enrolledStudents.map((student) => <AttendanceRow key={student.id} student={student} record={records.get(student.id)} editable={canEdit && session.status !== 'CANCELLED'} busy={busy} onSave={saveRecord} mobile />)}</div>
      {!canEdit && <p className="text-xs text-hub-muted">You have read-only access to this cohort’s attendance.</p>}
      {session.status === 'CANCELLED' && <p className="border-y border-hub-line py-3 text-sm text-hub-muted">This session is cancelled; attendance is locked.</p>}
    </section>
  )
}

function AttendanceRow({ student, record, editable, busy, onSave, mobile = false }) {
  const [status, setStatus] = useState(record?.status ?? '')
  const [note, setNote] = useState(record?.note ?? '')
  const [error, setError] = useState('')

  async function save() {
    if (!status) return
    setError('')
    try {
      await onSave(student.id, { status, note })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  if (mobile) {
    return (
      <div className="space-y-2 px-3 py-3">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-[#f0edf0] text-xs font-bold">{student.first_name[0]}{student.last_name[0]}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{[student.first_name, student.last_name].filter(Boolean).join(' ')}</p><p className="truncate text-xs text-hub-muted">{student.email}</p></div>{record && <span className={`px-2 py-1 text-[10px] font-semibold ${ATTENDANCE_TONE[record.status]}`}>{ATTENDANCE_STATUS[record.status]}</span>}</div>
        <div className="flex gap-2"><SelectField label="Status" value={status} disabled={!editable} onChange={(event) => setStatus(event.target.value)}><option value="">Not recorded</option>{Object.entries(ATTENDANCE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField><button type="button" disabled={!editable || !status || busy} onClick={save} className="mt-6 min-h-10 shrink-0 bg-hub-ink px-3 text-xs font-semibold text-white disabled:opacity-45">Save</button></div>
        <input aria-label={`Attendance note for ${student.username}`} disabled={!editable} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" className="min-h-9 w-full border border-hub-line px-2.5 text-xs focus:border-hub-purple focus:outline-none disabled:bg-[#f4f2f4]" />
        {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
      </div>
    )
  }

  return (
    <tr className="border-t border-hub-line">
      <td className="px-4 py-3"><span className="block truncate text-sm font-semibold">{[student.first_name, student.last_name].filter(Boolean).join(' ')}</span><span className="mt-1 block truncate text-xs text-hub-muted">{student.email}</span></td>
      <td className="px-4 py-3"><SelectField label={`Attendance status for ${student.username}`} value={status} disabled={!editable} onChange={(event) => setStatus(event.target.value)}><option value="">Not recorded</option>{Object.entries(ATTENDANCE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></td>
      <td className="px-4 py-3"><div className="flex gap-2"><input aria-label={`Attendance note for ${student.username}`} disabled={!editable} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" className="min-h-10 min-w-0 flex-1 border border-hub-line px-2.5 text-xs focus:border-hub-purple focus:outline-none disabled:bg-[#f4f2f4]" /><button type="button" disabled={!editable || !status || busy} onClick={save} className="min-h-10 bg-hub-ink px-3 text-xs font-semibold text-white disabled:opacity-45">Save</button></div>{error && <p role="alert" className="mt-1 text-xs text-red-800">{error}</p>}</td>
    </tr>
  )
}

function AttendanceReport({ cohort, sessions, users, report, attendance }) {
  return (
    <section className="space-y-5">
      <div className="border-y border-hub-line bg-white px-4 py-4"><h2 className="text-lg font-semibold">Cohort attendance</h2><p className="mt-1 text-sm text-hub-muted">{report.completedCount} completed session{report.completedCount === 1 ? '' : 's'} count toward each percentage. Present and Late count as attended; Excused is excluded.</p></div>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">By student</h3><p className="mt-1 text-xs text-hub-muted">{cohort.students.length} enrolled</p></div><span className="text-sm font-semibold tabular-nums">Overall {report.percentage === null ? '—' : `${report.percentage}%`}</span></div>
      <div className="overflow-x-auto border border-hub-line bg-white"><table className="w-full min-w-[620px] table-fixed border-collapse text-left"><thead className="bg-hub-ink text-xs uppercase text-white"><tr><th className="w-[35%] px-4 py-3 font-semibold">Student</th><th className="w-[15%] px-4 py-3 text-center font-semibold">Present + Late</th><th className="w-[15%] px-4 py-3 text-center font-semibold">Excused</th><th className="w-[15%] px-4 py-3 text-center font-semibold">Completed</th><th className="w-[20%] px-4 py-3 text-right font-semibold">Attendance</th></tr></thead><tbody>{report.students.map((row) => {
        const student = users.find((user) => user.id === row.studentId)
        return <tr key={row.studentId} className="border-t border-hub-line"><td className="px-4 py-3 text-sm font-semibold">{[student?.first_name, student?.last_name].filter(Boolean).join(' ') || student?.username}</td><td className="px-4 py-3 text-center text-sm tabular-nums">{row.attended}/{row.denominator}</td><td className="px-4 py-3 text-center text-sm tabular-nums">{row.excused}</td><td className="px-4 py-3 text-center text-sm tabular-nums">{row.completedSessions}</td><td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{row.percentage === null ? '—' : `${row.percentage}%`}</td></tr>
      })}</tbody></table></div>
      <section><h3 className="text-sm font-semibold">By session</h3><div className="mt-3 divide-y divide-hub-line border-y border-hub-line bg-white">{sessions.map((session) => {
        const counts = attendanceCounts(attendance.filter((record) => record.session === session.id))
        return <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{session.title}</span><span className="mt-1 block text-xs text-hub-muted">{displayDate(session.date)} · {SESSION_STATUS[session.status]}</span></span><span className="text-xs tabular-nums text-hub-muted">P {counts.present} · L {counts.late} · A {counts.absent} · E {counts.excused}</span></div>
      })}</div></section>
    </section>
  )
}

function attendanceCounts(records) {
  return Object.fromEntries(Object.keys(ATTENDANCE_STATUS).map((status) => [
    status.toLowerCase(),
    records.filter((record) => record.status === status).length,
  ]))
}

function CountLabel({ value, label }) {
  return <span className="inline-flex items-center gap-1 border border-hub-line bg-white px-2 py-1"><span className="font-semibold tabular-nums">{value}</span><span>{label}</span></span>
}