import { useState } from 'react'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Megaphone,
  UsersRound,
} from 'lucide-react'
import { calculateGraduationReport } from './api/mockApi.js'

const input = 'mt-1 min-h-10 w-full border border-hub-line bg-white px-3 text-sm text-hub-ink'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:opacity-50'
const secondary = 'inline-flex min-h-9 items-center justify-center gap-2 border border-hub-line bg-white px-3 text-xs font-semibold hover:border-hub-purple disabled:opacity-50'
const statusNames = { DRAFT: 'Draft', READY: 'Ready', ACTIVE: 'Active', COMPLETED: 'Completed', ARCHIVED: 'Archived' }

function displayName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
}

function formatDate(value, options = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en', options).format(new Date(`${value}T12:00:00`))
}

function inScopeAssessment(assessment, cohort, snapshot) {
  return assessment.cohort === cohort.id || (
    assessment.curriculum_topic && snapshot.curriculumVersions.some((version) => (
      version.id === cohort.curriculum_version
      && version.topics.some((topic) => String(topic.id) === String(assessment.curriculum_topic))
    ))
  )
}

function getAttendanceSummary(snapshot, cohortIds, studentId = null) {
  const completedSessions = snapshot.sessions.filter((session) => (
    cohortIds.has(session.cohort) && session.status === 'COMPLETED'
  ))
  const completedSessionIds = new Set(completedSessions.map((session) => session.id))
  const records = snapshot.attendance.filter((record) => (
    completedSessionIds.has(record.session) && (studentId == null || record.student === studentId)
  ))
  const attended = records.filter((record) => ['PRESENT', 'LATE'].includes(record.status)).length
  const excused = records.filter((record) => record.status === 'EXCUSED').length
  const eligibleAttendanceSlots = completedSessions.reduce((total, session) => {
    const cohort = snapshot.cohorts.find((item) => item.id === session.cohort)
    if (!cohort) return total
    return total + (studentId == null ? cohort.students.length : Number(cohort.students.includes(studentId)))
  }, 0)
  const denominator = eligibleAttendanceSlots - excused
  return {
    attended,
    excused,
    recorded: records.length,
    percentage: denominator ? Math.round(attended * 1000 / denominator) / 10 : null,
  }
}

function getGraduationRows(snapshot, cohorts, studentId = null) {
  return cohorts.flatMap((cohort) => {
    const report = calculateGraduationReport(snapshot, cohort.id)
    return (report?.students ?? [])
      .filter((row) => studentId == null || row.student.id === studentId)
      .map((row) => ({ ...row, cohort_name: cohort.name, cohort_id: cohort.id }))
  })
}

function upcomingSessions(snapshot, cohorts) {
  const cohortIds = new Set(cohorts.map((cohort) => cohort.id))
  const today = new Date().toISOString().slice(0, 10)
  return snapshot.sessions
    .filter((session) => cohortIds.has(session.cohort) && session.status === 'SCHEDULED' && session.date >= today)
    .sort((left, right) => `${left.date} ${left.start_time}`.localeCompare(`${right.date} ${right.start_time}`))
    .map((session) => ({ ...session, cohort_name: cohorts.find((cohort) => cohort.id === session.cohort)?.name ?? '' }))
}

function MetricStrip({ metrics }) {
  return <div className="grid grid-cols-2 divide-x divide-y divide-hub-line border-y border-hub-line bg-white sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
    {metrics.map((metric) => <div key={metric.label} className="min-w-0 px-4 py-4">
      <p className="text-xs font-semibold text-hub-muted">{metric.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</p>
      {metric.detail && <p className="mt-1 text-xs text-hub-muted">{metric.detail}</p>}
    </div>)}
  </div>
}

function Section({ title, icon: Icon, action, children }) {
  return <section className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-hub-line pb-2">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Icon size={17} aria-hidden="true" />{title}</h2>
      {action}
    </div>
    {children}
  </section>
}

function EmptyLine({ children }) {
  return <p className="py-4 text-sm text-hub-muted">{children}</p>
}

function CohortRows({ cohorts, query, statusFilter, onOpen }) {
  const normalizedQuery = query.trim().toLowerCase()
  const rows = cohorts.filter((cohort) => (
    (statusFilter === 'ALL' || cohort.status === statusFilter)
    && (!normalizedQuery || `${cohort.name} ${cohort.description}`.toLowerCase().includes(normalizedQuery))
  ))
  if (!rows.length) return <EmptyLine>No cohorts match these filters.</EmptyLine>
  return <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
    {rows.map((cohort) => <button key={cohort.id} type="button" onClick={() => onOpen(cohort.id)} className="grid w-full gap-2 px-3 py-3 text-left hover:bg-[#fbf8fc] sm:grid-cols-[minmax(0,1.3fr)_120px_100px] sm:items-center">
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{cohort.name}</span><span className="mt-1 block truncate text-xs text-hub-muted">{cohort.description}</span></span>
      <span className="text-xs text-hub-muted">{statusNames[cohort.status] ?? cohort.status}</span>
      <span className="text-xs text-hub-muted">{cohort.students.length} students <ArrowRight className="ml-1 inline" size={13} aria-hidden="true" /></span>
    </button>)}
  </div>
}

function SessionRows({ sessions, query, onOpenSessions, canRecord = false }) {
  const normalizedQuery = query.trim().toLowerCase()
  const rows = sessions.filter((session) => `${session.title} ${session.cohort_name}`.toLowerCase().includes(normalizedQuery)).slice(0, 5)
  if (!rows.length) return <EmptyLine>No upcoming sessions are scheduled.</EmptyLine>
  return <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
    {rows.map((session) => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <CalendarDays className="mt-0.5 shrink-0 text-hub-purple" size={17} aria-hidden="true" />
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{session.title}</p><p className="mt-1 text-xs text-hub-muted">{formatDate(session.date)} · {session.start_time} · {session.cohort_name}</p></div>
      </div>
      {canRecord && <button type="button" className={secondary} onClick={() => onOpenSessions(session.cohort)}>Record attendance</button>}
    </div>)}
  </div>
}

function NotificationAndAnnouncementPanels({ snapshot, user, query, busy, onMarkRead, onPostAnnouncement }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [announcementError, setAnnouncementError] = useState('')
  const [announcement, setAnnouncement] = useState({ title: '', body: '', branch: '' })
  const canAnnounce = ['SUPER_ADMIN', 'BRANCH_ADMIN'].includes(user.application_role)
  const normalizedQuery = query.trim().toLowerCase()
  const notifications = snapshot.notifications.filter((item) => `${item.title} ${item.body}`.toLowerCase().includes(normalizedQuery))
  const announcements = snapshot.announcements.filter((item) => `${item.title} ${item.body}`.toLowerCase().includes(normalizedQuery))

  async function submitAnnouncement(event) {
    event.preventDefault()
    setAnnouncementError('')
    try {
      await onPostAnnouncement({ ...announcement, branch: announcement.branch === '' ? null : Number(announcement.branch) })
      setAnnouncement({ title: '', body: '', branch: '' })
      setComposerOpen(false)
    } catch (failure) {
      setAnnouncementError(failure.message)
    }
  }

  return <div className="grid gap-8 xl:grid-cols-2">
    <Section title="Notifications" icon={Bell}>
      {notifications.length ? <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
        {notifications.map((item) => <article key={item.id} className="flex items-start justify-between gap-3 px-3 py-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{item.title}</p>{!item.read && <span className="size-2 shrink-0 bg-hub-purple" aria-label="Unread" />}</div><p className="mt-1 text-sm text-hub-muted">{item.body}</p><p className="mt-1 text-xs text-hub-muted">{new Date(item.created_at).toLocaleDateString()}</p></div>
          {!item.read && <button type="button" className={secondary} disabled={busy} onClick={() => onMarkRead(item.id)}>Mark read</button>}
        </article>)}
      </div> : <EmptyLine>No notifications match your search.</EmptyLine>}
    </Section>

    <Section title="Announcements" icon={Megaphone} action={canAnnounce && <button type="button" className={secondary} onClick={() => setComposerOpen((open) => !open)}>{composerOpen ? 'Cancel' : 'New announcement'}</button>}>
      {composerOpen && <form className="mb-4 space-y-3 border-y border-hub-line bg-white p-4" onSubmit={submitAnnouncement}>
        <label className="block text-xs font-semibold text-hub-muted">Announcement title<input className={input} required maxLength={140} value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} /></label>
        <label className="block text-xs font-semibold text-hub-muted">Message<textarea className={`${input} py-2`} rows="3" required maxLength={1200} value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} /></label>
        {user.application_role === 'SUPER_ADMIN' && <label className="block text-xs font-semibold text-hub-muted">Audience<select className={input} value={announcement.branch} onChange={(event) => setAnnouncement({ ...announcement, branch: event.target.value })}><option value="">All branches</option>{snapshot.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
        {announcementError && <p role="alert" className="text-sm text-red-800">{announcementError}</p>}
        <button type="submit" className={primary} disabled={busy}>Publish announcement</button>
      </form>}
      {announcements.length ? <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
        {announcements.map((item) => <article key={item.id} className="px-3 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{item.title}</h3><span className="text-xs text-hub-muted">{item.branch == null ? 'All branches' : snapshot.branches.find((branch) => branch.id === item.branch)?.name ?? 'Branch'} · {new Date(item.published_at).toLocaleDateString()}</span></div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-hub-muted">{item.body}</p>
        </article>)}
      </div> : <EmptyLine>No announcements match your search.</EmptyLine>}
    </Section>
  </div>
}

export function DashboardScreen({ snapshot, user, busy, onNavigate, onOpenCohort, onOpenSessions, onMarkNotificationRead, onPostAnnouncement }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const role = user.application_role
  const cohorts = role === 'SUPER_ADMIN'
    ? snapshot.cohorts
    : role === 'INSTRUCTOR'
      ? snapshot.cohorts.filter((cohort) => cohort.instructor === user.id)
      : role === 'STUDENT'
        ? snapshot.cohorts.filter((cohort) => cohort.students.includes(user.id))
        : snapshot.cohorts.filter((cohort) => cohort.branch === user.branch)
  const cohortIds = new Set(cohorts.map((cohort) => cohort.id))
  const sessions = upcomingSessions(snapshot, cohorts)
  const attendance = getAttendanceSummary(snapshot, cohortIds, role === 'STUDENT' ? user.id : null)
  const reports = getGraduationRows(snapshot, cohorts, role === 'STUDENT' ? user.id : null)
  const scopedAssessments = snapshot.assessments.filter((assessment) => cohorts.some((cohort) => inScopeAssessment(assessment, cohort, snapshot)))
  const scopedAttempts = snapshot.attempts.filter((attempt) => (
    scopedAssessments.some((assessment) => assessment.id === attempt.assessment)
    && (role !== 'STUDENT' || attempt.student === user.id)
  ))
  const scoredAttempts = scopedAttempts.filter((attempt) => attempt.score != null && attempt.max_score > 0)
  const averageScore = scoredAttempts.length
    ? `${Math.round(scoredAttempts.reduce((total, attempt) => total + attempt.score * 100 / attempt.max_score, 0) / scoredAttempts.length)}%`
    : '—'
  const pendingAssessments = scopedAssessments.filter((assessment) => (
    !assessment.results_released
    && scopedAttempts.some((attempt) => attempt.assessment === assessment.id && ['SUBMITTED', 'TIMED_OUT'].includes(attempt.status))
  ))
  const branchCohorts = snapshot.cohorts.filter((cohort) => cohort.branch === user.branch)
  const activeCohorts = cohorts.filter((cohort) => cohort.status === 'ACTIVE').length
  const completedCohorts = cohorts.filter((cohort) => cohort.status === 'COMPLETED').length
  const enrolledStudents = new Set(cohorts.flatMap((cohort) => cohort.students)).size
  const branchStudents = snapshot.users.filter((person) => person.application_role === 'STUDENT' && (role === 'SUPER_ADMIN' || person.branch === user.branch)).length
  const branchInstructors = snapshot.users.filter((person) => person.application_role === 'INSTRUCTOR' && (role === 'SUPER_ADMIN' || person.branch === user.branch)).length
  const pageHeading = {
    SUPER_ADMIN: 'Organization overview',
    BRANCH_ADMIN: 'Branch overview',
    INSTRUCTOR: 'Teaching dashboard',
    STUDENT: 'My learning dashboard',
  }[role]
  const branchPerformance = role === 'SUPER_ADMIN' ? snapshot.branches.map((branch) => {
    const branchCohortsForRow = snapshot.cohorts.filter((cohort) => cohort.branch === branch.id)
    const branchIds = new Set(branchCohortsForRow.map((cohort) => cohort.id))
    const summary = getAttendanceSummary(snapshot, branchIds)
    const uniqueStudents = new Set(branchCohortsForRow.flatMap((cohort) => cohort.students)).size
    return { ...branch, cohorts: branchCohortsForRow, student_count: uniqueStudents, active_count: branchCohortsForRow.filter((cohort) => cohort.status === 'ACTIVE').length, attendance: summary.percentage }
  }).filter((branch) => `${branch.name} ${branch.location}`.toLowerCase().includes(query.trim().toLowerCase())) : []
  const studentCohort = cohorts.find((cohort) => cohort.status === 'ACTIVE') ?? cohorts[0]
  const studentReport = studentCohort ? reports.find((row) => row.cohort_id === studentCohort.id) : null
  const studentAssessmentResults = scopedAttempts
    .filter((attempt) => attempt.status !== 'IN_PROGRESS')
    .map((attempt) => ({ ...attempt, assessment_title: scopedAssessments.find((assessment) => assessment.id === attempt.assessment)?.title ?? 'Assessment' }))
    .sort((left, right) => right.attempt_number - left.attempt_number)
  const branchGraduationRows = role === 'BRANCH_ADMIN' ? getGraduationRows(snapshot, cohorts) : []
  const branchEligible = branchGraduationRows.filter((row) => row.eligibility === 'ELIGIBLE').length
  const branchIncomplete = branchGraduationRows.filter((row) => row.eligibility === 'INCOMPLETE').length
  const attendanceRecords = snapshot.attendance.filter((record) => cohortIds.has(snapshot.sessions.find((session) => session.id === record.session)?.cohort))
  const presentCount = attendanceRecords.filter((record) => record.status === 'PRESENT').length
  const lateCount = attendanceRecords.filter((record) => record.status === 'LATE').length
  const excusedCount = attendanceRecords.filter((record) => record.status === 'EXCUSED').length
  const metrics = role === 'SUPER_ADMIN' ? [
    { label: 'Branches', value: snapshot.branches.length },
    { label: 'Students', value: snapshot.users.filter((person) => person.application_role === 'STUDENT').length },
    { label: 'Instructors', value: snapshot.users.filter((person) => person.application_role === 'INSTRUCTOR').length },
    { label: 'Cohorts', value: cohorts.length },
    { label: 'Active cohorts', value: activeCohorts },
    { label: 'Completed', value: completedCohorts },
  ] : role === 'BRANCH_ADMIN' ? [
    { label: 'Branch students', value: branchStudents },
    { label: 'Instructors', value: branchInstructors },
    { label: 'Active cohorts', value: activeCohorts },
    { label: 'Upcoming sessions', value: sessions.length },
    { label: 'Attendance', value: attendance.percentage == null ? '—' : `${attendance.percentage}%` },
    { label: 'Eligible students', value: branchEligible },
  ] : role === 'INSTRUCTOR' ? [
    { label: 'Assigned cohorts', value: cohorts.length },
    { label: 'Upcoming sessions', value: sessions.length },
    { label: 'Enrolled students', value: enrolledStudents },
    { label: 'Pending assessment results', value: pendingAssessments.length },
  ] : [
    { label: 'Enrolled cohorts', value: cohorts.length },
    { label: 'Upcoming classes', value: sessions.length },
    { label: 'Attendance', value: attendance.percentage == null ? '—' : `${attendance.percentage}%` },
    { label: 'Assessment average', value: averageScore },
    { label: 'Graduation status', value: studentReport?.eligibility ?? 'In progress' },
    { label: 'Certificates', value: snapshot.certificates.length },
  ]

  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hub-line pb-5">
      <div><h1 className="text-2xl font-semibold">{pageHeading}</h1><p className="mt-1 text-sm text-hub-muted">{displayName(user)} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
      <div className="grid w-full gap-3 sm:grid-cols-[minmax(220px,1fr)_190px] sm:w-auto">
        <label className="text-xs font-semibold text-hub-muted">Search dashboard<input className={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cohorts, sessions, notices" /></label>
        <label className="text-xs font-semibold text-hub-muted">Cohort status<select className={input} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      </div>
    </header>

    <MetricStrip metrics={metrics} />

    {role === 'SUPER_ADMIN' && <div className="grid gap-8 xl:grid-cols-[1.2fr_.8fr]">
      <Section title="Branch performance" icon={UsersRound}>
        {branchPerformance.length ? <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
          {branchPerformance.map((branch) => <article key={branch.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1.2fr)_90px_100px_130px] sm:items-center">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{branch.name}</p><p className="text-xs text-hub-muted">{branch.student_count} students · {branch.cohorts.length} cohorts</p></div>
            <p className="text-xs text-hub-muted">{branch.active_count} active</p>
            <p className="text-xs text-hub-muted">Attendance {branch.attendance == null ? '—' : `${branch.attendance}%`}</p>
            <div className="h-2 bg-[#ebe8ec]" role="img" aria-label={`Attendance ${branch.attendance ?? 0}%`}><div className="h-full bg-hub-purple" style={{ width: `${branch.attendance ?? 0}%` }} /></div>
          </article>)}
        </div> : <EmptyLine>No branches match your search.</EmptyLine>}
      </Section>
      <Section title="Cohort overview" icon={GraduationCap} action={<button type="button" className={secondary} onClick={() => onNavigate('cohorts')}>Manage cohorts <ArrowRight size={14} /></button>}>
        <CohortRows cohorts={cohorts} query={query} statusFilter={statusFilter} onOpen={onOpenCohort} />
      </Section>
    </div>}

    {role === 'BRANCH_ADMIN' && <div className="grid gap-8 xl:grid-cols-2">
      <Section title="Upcoming sessions" icon={CalendarDays} action={<button type="button" className={secondary} onClick={() => onNavigate('cohorts')}>View cohorts <ArrowRight size={14} /></button>}>
        <SessionRows sessions={sessions} query={query} onOpenSessions={onOpenSessions} />
      </Section>
      <Section title="Attendance summary" icon={CheckCircle2}>
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white text-sm">
          <p className="flex justify-between px-3 py-3"><span>Present</span><strong>{presentCount}</strong></p>
          <p className="flex justify-between px-3 py-3"><span>Late</span><strong>{lateCount}</strong></p>
          <p className="flex justify-between px-3 py-3"><span>Excused</span><strong>{excusedCount}</strong></p>
          <p className="flex justify-between px-3 py-3"><span>Recorded attendance</span><strong>{attendance.percentage == null ? 'Not available' : `${attendance.percentage}%`}</strong></p>
        </div>
      </Section>
      <Section title="Assessment summary" icon={ClipboardList} action={<button type="button" className={secondary} onClick={() => onNavigate('assessments')}>Assessments <ArrowRight size={14} /></button>}>
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white text-sm">
          <p className="flex justify-between px-3 py-3"><span>Published assessments</span><strong>{scopedAssessments.filter((item) => item.status === 'PUBLISHED').length}</strong></p>
          <p className="flex justify-between px-3 py-3"><span>Average recorded score</span><strong>{averageScore}</strong></p>
          <p className="flex justify-between px-3 py-3"><span>Awaiting result release</span><strong>{pendingAssessments.length}</strong></p>
        </div>
      </Section>
      <Section title="Graduation readiness" icon={GraduationCap} action={<button type="button" className={secondary} onClick={() => onNavigate('results')}>Review results <ArrowRight size={14} /></button>}>
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white text-sm">
          <p className="flex justify-between px-3 py-3"><span>Eligible</span><strong>{branchEligible}</strong></p>
          <p className="flex justify-between px-3 py-3"><span>Incomplete</span><strong>{branchIncomplete}</strong></p>
          <p className="flex justify-between px-3 py-3"><span>Other status</span><strong>{Math.max(0, branchGraduationRows.length - branchEligible - branchIncomplete)}</strong></p>
        </div>
      </Section>
      <Section title="Cohorts" icon={GraduationCap}>
        <CohortRows cohorts={branchCohorts} query={query} statusFilter={statusFilter} onOpen={onOpenCohort} />
      </Section>
    </div>}

    {role === 'INSTRUCTOR' && <div className="grid gap-8 xl:grid-cols-2">
      <Section title="Upcoming sessions" icon={CalendarDays}>
        <SessionRows sessions={sessions} query={query} onOpenSessions={onOpenSessions} canRecord />
      </Section>
      <Section title="Assigned cohorts" icon={GraduationCap}>
        <CohortRows cohorts={cohorts} query={query} statusFilter={statusFilter} onOpen={onOpenCohort} />
      </Section>
      <Section title="Pending assessments" icon={ClipboardList} action={<button type="button" className={secondary} onClick={() => onNavigate('assessments')}>Review assessments <ArrowRight size={14} /></button>}>
        {pendingAssessments.length ? <div className="divide-y divide-hub-line border-y border-hub-line bg-white">{pendingAssessments.map((assessment) => <article key={assessment.id} className="flex items-center justify-between gap-3 px-3 py-3"><div><p className="text-sm font-semibold">{assessment.title}</p><p className="mt-1 text-xs text-hub-muted">{scopedAttempts.filter((attempt) => attempt.assessment === assessment.id && ['SUBMITTED', 'TIMED_OUT'].includes(attempt.status)).length} submitted attempts</p></div><button type="button" className={secondary} onClick={() => onNavigate('assessments')}>Review</button></article>)}</div> : <EmptyLine>No assessment results are waiting for review.</EmptyLine>}
      </Section>
      <Section title="Student roster" icon={UsersRound}>
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white">{cohorts.map((cohort) => <article key={cohort.id} className="flex justify-between px-3 py-3 text-sm"><span>{cohort.name}</span><strong>{cohort.students.length}</strong></article>)}</div>
      </Section>
    </div>}

    {role === 'STUDENT' && <div className="grid gap-8 xl:grid-cols-2">
      <Section title="My class schedule" icon={CalendarDays}>
        {studentCohort && <p className="mb-2 text-xs font-semibold text-hub-muted">{studentCohort.name}</p>}
        <SessionRows sessions={sessions} query={query} onOpenSessions={onOpenSessions} />
      </Section>
      <Section title="Graduation progress" icon={GraduationCap} action={<button type="button" className={secondary} onClick={() => onNavigate('certificates')}>Certificates <ArrowRight size={14} /></button>}>
        {studentReport ? <div className="space-y-3 border-y border-hub-line bg-white px-3 py-3">
          <p className="text-sm font-semibold">{studentCohort?.name} · {studentReport.eligibility.replaceAll('_', ' ')}</p>
          <div className="grid grid-cols-2 gap-3 text-sm"><p>Attendance <strong className="block">{studentReport.attendance_percentage == null ? 'Not available' : `${studentReport.attendance_percentage}%`}</strong></p><p>Assessment average <strong className="block">{studentReport.assessment_average == null ? 'Not available' : `${studentReport.assessment_average}%`}</strong></p></div>
          {studentReport.reasons.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-hub-muted">{studentReport.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        </div> : <EmptyLine>Your graduation requirements have not been set yet.</EmptyLine>}
        <p className="mt-2 text-xs text-hub-muted">Attendance: {attendance.attended} attended · {attendance.excused} excused</p>
      </Section>
      <Section title="Assessment results" icon={ClipboardList} action={<button type="button" className={secondary} onClick={() => onNavigate('assessments')}>My assessments <ArrowRight size={14} /></button>}>
        {studentAssessmentResults.length ? <div className="divide-y divide-hub-line border-y border-hub-line bg-white">{studentAssessmentResults.slice(0, 5).map((attempt) => <article key={attempt.id} className="flex justify-between gap-3 px-3 py-3"><div><p className="text-sm font-semibold">{attempt.assessment_title}</p><p className="mt-1 text-xs text-hub-muted">Attempt {attempt.attempt_number} · {attempt.status.replaceAll('_', ' ')}</p></div><strong className="text-sm">{attempt.score == null ? 'Awaiting results' : `${attempt.score} / ${attempt.max_score}`}</strong></article>)}</div> : <EmptyLine>No assessment results are available yet.</EmptyLine>}
      </Section>
      <Section title="My certificates" icon={CheckCircle2} action={<button type="button" className={secondary} onClick={() => onNavigate('certificates')}>View certificates <ArrowRight size={14} /></button>}>
        {snapshot.certificates.length ? <div className="divide-y divide-hub-line border-y border-hub-line bg-white">{snapshot.certificates.slice(0, 3).map((certificate) => <div key={certificate.id} className="px-3 py-3"><p className="text-sm font-semibold">{certificate.cohort_name}</p><p className="mt-1 text-xs text-hub-muted">{certificate.certificate_number}</p></div>)}</div> : <EmptyLine>No certificates have been issued yet.</EmptyLine>}
      </Section>
    </div>}

    <NotificationAndAnnouncementPanels snapshot={snapshot} user={user} query={query} busy={busy} onMarkRead={onMarkNotificationRead} onPostAnnouncement={onPostAnnouncement} />
  </div>
}