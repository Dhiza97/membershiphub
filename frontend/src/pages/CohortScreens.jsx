import { useDeferredValue, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

const STATUS_LABELS = {
  DRAFT: 'Draft',
  READY: 'Ready',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

const STATUS_STYLES = {
  DRAFT: 'bg-stone-100 text-stone-700',
  READY: 'bg-hub-yellow text-hub-ink',
  ACTIVE: 'bg-hub-purple text-white',
  COMPLETED: 'bg-emerald-100 text-emerald-900',
  ARCHIVED: 'bg-neutral-200 text-neutral-700',
}

const FLOW_STEPS = [
  { title: 'Details', caption: 'Name, branch, dates' },
  { title: 'Learning plan', caption: 'Instructor and curriculum' },
  { title: 'Students', caption: 'Build the roster' },
  { title: 'Review', caption: 'Confirm readiness' },
]

function displayDate(value) {
  if (!value) return 'Not set'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return 'Not set'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(year, month - 1, day),
  )
}

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Unassigned'
}

function studentCount(count) {
  return `${count} student${count === 1 ? '' : 's'}`
}

function StatusFlag({ status }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      <span className={`status-lamp ${status === 'READY' ? 'status-lamp-live' : ''}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}

function ReadinessLine({ ready, children }) {
  const Icon = ready ? CheckCircle2 : Circle
  return (
    <li className={`flex items-center gap-2 text-sm ${ready ? 'text-emerald-800' : 'text-hub-muted'}`}>
      <Icon size={16} aria-hidden="true" />
      {children}
    </li>
  )
}

export function CohortBoard({ cohorts, branches, users, isSuperAdmin, canCreate = true, onCreate, onOpen }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [branchId, setBranchId] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const filtered = cohorts.filter((cohort) => {
    const branchName = branches.find((branch) => branch.id === cohort.branch)?.name ?? ''
    const instructorName = fullName(users.find((user) => user.id === cohort.instructor))
    const searchMatch = !deferredSearch || [cohort.name, cohort.description, branchName, instructorName]
      .join(' ')
      .toLowerCase()
      .includes(deferredSearch)
    return searchMatch && (!status || cohort.status === status) && (!branchId || cohort.branch === Number(branchId))
  })
  const liveCount = cohorts.filter((cohort) => cohort.status === 'ACTIVE').length
  const readyCount = cohorts.filter((cohort) => cohort.status === 'READY').length

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hub-line pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-hub-ink">Cohorts</h1>
          <p className="mt-1 text-sm text-hub-muted">
            {cohorts.length} total <span className="mx-2 text-hub-line">/</span> {readyCount} ready <span className="mx-2 text-hub-line">/</span> {liveCount} active
          </p>
        </div>
        {canCreate && <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-hub-purple-dark"
        >
          <Plus size={17} aria-hidden="true" />
          New cohort
        </button>}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hub-muted" size={17} aria-hidden="true" />
          <span className="sr-only">Search cohorts</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cohorts, branches, instructors"
            className="min-h-11 w-full border border-hub-line bg-white pl-10 pr-3 text-sm placeholder:text-hub-muted/80 focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15"
          />
        </label>
        <label className="relative min-w-40">
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 w-full appearance-none border border-hub-line bg-white px-3 pr-9 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hub-muted" size={16} aria-hidden="true" />
        </label>
        {isSuperAdmin && (
          <label className="relative min-w-44">
            <span className="sr-only">Filter by branch</span>
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="min-h-11 w-full appearance-none border border-hub-line bg-white px-3 pr-9 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15">
              <option value="">All branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hub-muted" size={16} aria-hidden="true" />
          </label>
        )}
      </div>

      <div className="hidden overflow-hidden border border-hub-line bg-white lg:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="bg-hub-ink text-xs uppercase text-white">
            <tr>
              <th className="w-[28%] px-4 py-3 font-semibold">Cohort</th>
              {isSuperAdmin && <th className="w-[17%] px-4 py-3 font-semibold">Branch</th>}
              <th className="w-[18%] px-4 py-3 font-semibold">Instructor</th>
              <th className="w-[12%] px-4 py-3 text-center font-semibold">Students</th>
              <th className="w-[17%] px-4 py-3 font-semibold">Dates</th>
              <th className="w-[16%] px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cohort, index) => {
              const branch = branches.find((item) => item.id === cohort.branch)
              const instructor = users.find((item) => item.id === cohort.instructor)
              return (
                <tr key={cohort.id} className={`board-row border-t border-hub-line transition-colors hover:bg-[#fbf8fc] ${index % 2 ? 'bg-[#fcfbfc]' : 'bg-white'}`}>
                  <td className="px-4 py-3.5">
                    <button type="button" onClick={() => onOpen(cohort.id)} className="block max-w-full text-left font-semibold text-hub-ink underline-offset-4 hover:text-hub-purple hover:underline">
                      <span className="block truncate">{cohort.name || 'Untitled draft'}</span>
                    </button>
                    <span className="mt-1 block truncate text-xs text-hub-muted">{cohort.description || 'Details not added'}</span>
                  </td>
                  {isSuperAdmin && <td className="truncate px-4 py-3.5 text-sm text-hub-muted">{branch?.name ?? 'Unknown branch'}</td>}
                  <td className="truncate px-4 py-3.5 text-sm">{fullName(instructor)}</td>
                  <td className="px-4 py-3.5 text-center font-medium tabular-nums">{cohort.students.length}</td>
                  <td className="px-4 py-3.5 text-xs leading-5 text-hub-muted">
                    <span className="block">{displayDate(cohort.start_date)}</span>
                    <span className="block">to {displayDate(cohort.end_date)}</span>
                  </td>
                  <td className="px-4 py-3.5"><StatusFlag status={cohort.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyCohorts hasCohorts={cohorts.length > 0} canCreate={canCreate} onCreate={onCreate} />}
      </div>

      <div className="divide-y divide-hub-line border-y border-hub-line bg-white lg:hidden">
        {filtered.map((cohort) => {
          const branch = branches.find((item) => item.id === cohort.branch)
          const instructor = users.find((item) => item.id === cohort.instructor)
          return (
            <button type="button" key={cohort.id} onClick={() => onOpen(cohort.id)} className="grid w-full gap-3 px-4 py-4 text-left hover:bg-[#fbf8fc]">
              <span className="flex min-w-0 items-center justify-between gap-3">
                <span className="truncate font-semibold">{cohort.name || 'Untitled draft'}</span>
                <StatusFlag status={cohort.status} />
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-hub-muted">
                {isSuperAdmin && <span>{branch?.name}</span>}
                <span>{fullName(instructor)}</span>
                <span>{studentCount(cohort.students.length)}</span>
              </span>
              <span className="text-xs tabular-nums text-hub-muted">{displayDate(cohort.start_date)} – {displayDate(cohort.end_date)}</span>
            </button>
          )
        })}
        {filtered.length === 0 && <EmptyCohorts hasCohorts={cohorts.length > 0} canCreate={canCreate} onCreate={onCreate} />}
      </div>
    </section>
  )
}

function EmptyCohorts({ hasCohorts, canCreate, onCreate }) {
  return (
    <div className="px-5 py-12 text-center">
      <ClipboardList className="mx-auto text-hub-purple" size={28} aria-hidden="true" />
      <h2 className="mt-3 font-semibold">{hasCohorts ? 'No matching cohorts' : 'No cohorts yet'}</h2>
      <p className="mt-1 text-sm text-hub-muted">{hasCohorts ? 'Change a filter or search term.' : 'Start a draft and add the details when you are ready.'}</p>
      {!hasCohorts && canCreate && <button type="button" onClick={onCreate} className="mt-4 text-sm font-semibold text-hub-purple underline underline-offset-4">Create a cohort</button>}
    </div>
  )
}

export function CohortWizard({ cohort, branches, users, curricula, curriculumVersions, user, busy, onCancel, onSave }) {
  const initialBranch = cohort?.branch ?? user.branch ?? branches.find((branch) => branch.is_active)?.id ?? ''
  const [draft, setDraft] = useState(() => cohort ? structuredClone(cohort) : {
    branch: initialBranch,
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'DRAFT',
    instructor: null,
    curriculum_version: null,
    students: [],
  })
  const [step, setStep] = useState(0)
  const [studentSearch, setStudentSearch] = useState('')
  const [instructorSearch, setInstructorSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const currentBranch = Number(draft.branch)
  const branch = branches.find((item) => item.id === currentBranch)
  const instructors = users.filter((item) => item.branch === currentBranch && item.application_role === 'INSTRUCTOR' && item.is_active)
  const students = users.filter((item) => item.branch === currentBranch && item.application_role === 'STUDENT' && item.is_active)
  const branchCurricula = curricula.filter((item) => item.branch === currentBranch && item.is_active)
  const publishedCurriculumVersions = curriculumVersions.filter((version) => (
    version.status === 'PUBLISHED' && branchCurricula.some((curriculum) => curriculum.id === version.curriculum)
  ))
  const selectedInstructor = users.find((item) => item.id === Number(draft.instructor))
  const selectedCurriculumVersion = curriculumVersions.find((version) => version.id === Number(draft.curriculum_version))
  const selectedCurriculum = curricula.find((item) => item.id === selectedCurriculumVersion?.curriculum)
  const selectedStudents = students.filter((item) => draft.students.includes(item.id))
  const filteredStudents = students.filter((item) => `${fullName(item)} ${item.username}`.toLowerCase().includes(studentSearch.toLowerCase()))
  const filteredInstructors = instructors.filter((item) => `${fullName(item)} ${item.username}`.toLowerCase().includes(instructorSearch.toLowerCase()))
  const dateOrderValid = !draft.start_date || !draft.end_date || draft.end_date >= draft.start_date
  const checks = [
    { label: 'Cohort name', ready: Boolean(draft.name.trim()) },
    { label: 'Description', ready: Boolean(draft.description.trim()) },
    { label: 'Start and end dates', ready: Boolean(draft.start_date && draft.end_date && dateOrderValid) },
    { label: 'One assigned instructor', ready: Boolean(selectedInstructor) },
    { label: 'Published curriculum', ready: Boolean(selectedCurriculumVersion) },
    { label: 'At least one student', ready: selectedStudents.length > 0 },
  ]
  const canConfirm = checks.every((check) => check.ready)

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setFormError('')
    setFieldError('')
  }

  function toggleStudent(studentId) {
    const next = draft.students.includes(studentId)
      ? draft.students.filter((id) => id !== studentId)
      : [...draft.students, studentId]
    update('students', next)
  }

  async function save(status) {
    setFormError('')
    setFieldError('')
    try {
    await onSave({ ...draft, status: status ?? draft.status })
    } catch (error) {
      setFormError(error.message)
      setFieldError(error.field ?? '')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-hub-line pb-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onCancel} aria-label="Back to cohorts" className="mt-1 grid size-9 shrink-0 place-items-center border border-hub-line bg-white text-hub-ink hover:border-hub-purple hover:text-hub-purple">
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cohort ? 'Edit cohort' : 'Create cohort'}</h1>
            <p className="mt-1 text-sm text-hub-muted">{draft.name || 'Untitled draft'} · {branch?.name ?? 'Choose a branch'}</p>
          </div>
        </div>
        <span className={`hidden px-2.5 py-1 text-xs font-semibold sm:inline-flex ${STATUS_STYLES[draft.status]}`}>{STATUS_LABELS[draft.status]}</span>
      </div>

      {formError && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{formError}</p>}

      <div className="grid gap-6 xl:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Cohort setup steps" className="grid grid-cols-2 gap-1 border-b border-hub-line pb-4 xl:block xl:border-b-0 xl:border-r xl:pb-0 xl:pr-5">
          {FLOW_STEPS.map((item, index) => {
            const complete = index < step
            return (
              <button type="button" key={item.title} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined} className={`flex min-h-14 items-start gap-3 px-2 py-2.5 text-left xl:w-full ${index === step ? 'bg-[#f5eff5] text-hub-purple' : 'text-hub-muted hover:bg-white hover:text-hub-ink'}`}>
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center border text-xs font-semibold ${index === step ? 'border-hub-purple bg-hub-purple text-white' : complete ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-hub-line bg-white'}`}>
                  {complete ? <Check size={14} aria-hidden="true" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="hidden truncate text-xs text-hub-muted sm:block">{item.caption}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="min-w-0">
          {step === 0 && (
            <div className="max-w-3xl space-y-5">
              <h2 className="text-lg font-semibold">Cohort details</h2>
              {user.application_role === 'SUPER_ADMIN' && !cohort ? (
                <label className="block text-sm font-medium">Branch
                  <select value={draft.branch} onChange={(event) => {
                    const nextBranch = Number(event.target.value)
                    setDraft((current) => ({ ...current, branch: nextBranch, instructor: null, students: [] }))
                    setFormError('')
                    setFieldError('')
                  }} className="mt-1.5 min-h-11 w-full border border-hub-line bg-white px-3 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15">
                    {branches.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              ) : (
                <div className="border-b border-hub-line pb-3">
                  <span className="block text-xs font-semibold uppercase text-hub-muted">Assigned branch</span>
                  <span className="mt-1 block text-sm font-medium">{branch?.name ?? 'Branch unavailable'}</span>
                </div>
              )}
              <label className="block text-sm font-medium">Cohort name
                <input value={draft.name} onChange={(event) => update('name', event.target.value)} aria-invalid={fieldError === 'name'} placeholder="e.g. Foundations · January 2027" className="mt-1.5 min-h-11 w-full border border-hub-line bg-white px-3 text-sm placeholder:text-hub-muted/80 focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" />
              </label>
              <label className="block text-sm font-medium">Description
                <textarea value={draft.description} onChange={(event) => update('description', event.target.value)} rows={3} placeholder="What will this cohort cover?" className="mt-1.5 w-full resize-y border border-hub-line bg-white px-3 py-2.5 text-sm placeholder:text-hub-muted/80 focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Start date
                  <input type="date" value={draft.start_date ?? ''} onChange={(event) => update('start_date', event.target.value)} className="mt-1.5 min-h-11 w-full border border-hub-line bg-white px-3 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" />
                </label>
                <label className="block text-sm font-medium">End date
                  <input type="date" value={draft.end_date ?? ''} onChange={(event) => update('end_date', event.target.value)} aria-invalid={!dateOrderValid} className="mt-1.5 min-h-11 w-full border border-hub-line bg-white px-3 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" />
                </label>
              </div>
              {!dateOrderValid && <p role="alert" className="text-sm text-red-800">The end date must be on or after the start date.</p>}
            </div>
          )}

          {step === 1 && (
            <div className="max-w-3xl space-y-7">
              <div>
                <h2 className="text-lg font-semibold">Instructor and learning plan</h2>
                <p className="mt-1 text-sm text-hub-muted">Assign one active instructor and a published curriculum from {branch?.name ?? 'this branch'}.</p>
              </div>
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-hub-muted">Assigned instructor</h3>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hub-muted" size={16} aria-hidden="true" />
                  <span className="sr-only">Search instructors</span>
                  <input value={instructorSearch} onChange={(event) => setInstructorSearch(event.target.value)} placeholder="Search instructors" className="min-h-11 w-full border border-hub-line bg-white pl-10 pr-3 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" />
                </label>
                <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
                  {filteredInstructors.map((instructor) => (
                    <label key={instructor.id} className="flex min-h-16 cursor-pointer items-center gap-3 px-3 py-3 hover:bg-[#fbf8fc]">
                      <input type="radio" name="instructor" checked={Number(draft.instructor) === instructor.id} onChange={() => update('instructor', instructor.id)} className="size-4 accent-[#94007e]" />
                      <span className="grid size-9 shrink-0 place-items-center bg-[#efe5ef] text-xs font-bold text-hub-purple">{instructor.first_name[0]}{instructor.last_name[0]}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{fullName(instructor)}</span><span className="block truncate text-xs text-hub-muted">{instructor.email}</span></span>
                      {Number(draft.instructor) === instructor.id && <CheckCircle2 className="text-hub-purple" size={18} aria-label="Selected" />}
                    </label>
                  ))}
                  {filteredInstructors.length === 0 && <p className="px-4 py-8 text-center text-sm text-hub-muted">No active instructors found in this branch.</p>}
                </div>
                {draft.instructor && <button type="button" onClick={() => update('instructor', null)} className="text-sm font-semibold text-hub-purple underline underline-offset-4">Remove instructor assignment</button>}
              </section>
              <section className="space-y-3">
                <label className="relative block text-sm font-semibold">Published curriculum
                  <select value={draft.curriculum_version ?? ''} onChange={(event) => update('curriculum_version', Number(event.target.value) || null)} className="mt-1.5 min-h-11 w-full appearance-none border border-hub-line bg-white px-3 pr-9 text-sm font-normal focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15">
                    <option value="">Choose a curriculum version</option>
                    {publishedCurriculumVersions.map((version) => {
                      const curriculum = branchCurricula.find((item) => item.id === version.curriculum)
                      return <option key={version.id} value={version.id}>{curriculum?.name} · v{version.version_number}</option>
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-hub-muted" size={16} aria-hidden="true" />
                </label>
                {selectedCurriculumVersion ? (
                  <div className="border-y border-hub-line bg-white px-3 py-3">
                    <p className="text-sm font-semibold">{selectedCurriculum?.name} · Version {selectedCurriculumVersion.version_number}</p>
                    <p className="mt-1 text-xs text-hub-muted">{selectedCurriculumVersion.topics.length} topic{selectedCurriculumVersion.topics.length === 1 ? '' : 's'} · published {displayDate(selectedCurriculumVersion.published_at)}</p>
                    <ul className="mt-2 flex flex-wrap gap-2">{selectedCurriculumVersion.topics.map((topic) => <li key={topic.id} className="border border-hub-line px-2 py-1 text-xs">{topic.title}</li>)}</ul>
                  </div>
                ) : <p className="text-xs text-hub-muted">{publishedCurriculumVersions.length > 0 ? 'Select a published version for this cohort.' : 'No published curriculum is available for this branch. Create and publish one in Curricula first.'}</p>}
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-3xl space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Build the student roster</h2>
                  <p className="mt-1 text-sm text-hub-muted">Select existing students from {branch?.name ?? 'this branch'}.</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{selectedStudents.length} selected</span>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hub-muted" size={16} aria-hidden="true" />
                <span className="sr-only">Search students</span>
                <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search students" className="min-h-11 w-full border border-hub-line bg-white pl-10 pr-3 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" />
              </label>
              <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
                {filteredStudents.map((student) => (
                  <label key={student.id} className="flex min-h-16 cursor-pointer items-center gap-3 px-3 py-3 hover:bg-[#fbf8fc]">
                    <input type="checkbox" checked={draft.students.includes(student.id)} onChange={() => toggleStudent(student.id)} className="size-4 accent-[#94007e]" />
                    <span className="grid size-9 shrink-0 place-items-center bg-[#f0edf0] text-xs font-bold text-hub-ink">{student.first_name[0]}{student.last_name[0]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{fullName(student)}</span>
                      <span className="block truncate text-xs text-hub-muted">{student.email}</span>
                    </span>
                    {draft.students.includes(student.id) && <CheckCircle2 className="text-hub-purple" size={18} aria-hidden="true" />}
                  </label>
                ))}
                {filteredStudents.length === 0 && <p className="px-4 py-8 text-center text-sm text-hub-muted">No existing students found. Add the account from People, then return to this cohort.</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Review cohort</h2>
                  <p className="mt-1 text-sm text-hub-muted">Check the setup before confirming it as Ready.</p>
                </div>
                <dl className="divide-y divide-hub-line border-y border-hub-line bg-white">
                  <ReviewRow label="Cohort">{draft.name || 'Not added'}</ReviewRow>
                  <ReviewRow label="Branch">{branch?.name ?? 'Not assigned'}</ReviewRow>
                  <ReviewRow label="Dates">{displayDate(draft.start_date)} to {displayDate(draft.end_date)}</ReviewRow>
                  <ReviewRow label="Instructor">{selectedInstructor ? fullName(selectedInstructor) : 'Not assigned'}</ReviewRow>
                  <ReviewRow label="Curriculum">{selectedCurriculum && selectedCurriculumVersion ? `${selectedCurriculum.name} · v${selectedCurriculumVersion.version_number}` : 'Not selected'}</ReviewRow>
                  <ReviewRow label="Students">{selectedStudents.length ? selectedStudents.map(fullName).join(', ') : 'None enrolled'}</ReviewRow>
                </dl>
                <div className="border-y border-hub-line py-4">
                  <h3 className="text-sm font-semibold">Description</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-hub-muted">{draft.description || 'Not added'}</p>
                </div>
              </div>
              <aside className="h-fit border border-hub-line bg-white p-4">
                <h3 className="text-sm font-semibold">Readiness</h3>
                <ul className="mt-3 space-y-3">
                  {checks.map((check) => <ReadinessLine key={check.label} ready={check.ready}>{check.label}</ReadinessLine>)}
                </ul>
                {!canConfirm && <p className="mt-4 border-t border-hub-line pt-3 text-xs leading-5 text-hub-muted">Save as Draft to keep working later. All checks must pass before Ready.</p>}
              </aside>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-hub-line bg-[#f5f3f6]/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <button type="button" onClick={onCancel} className="min-h-10 px-2 text-sm font-semibold text-hub-muted hover:text-hub-ink">Cancel</button>
        <div className="flex flex-wrap items-center gap-2">
          {step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex min-h-10 items-center gap-2 border border-hub-line bg-white px-3 text-sm font-semibold hover:border-hub-purple"><ArrowLeft size={16} aria-hidden="true" />Back</button>}
          <button type="button" disabled={busy} onClick={() => save(cohort ? draft.status : 'DRAFT')} className="min-h-10 border border-hub-line bg-white px-3 text-sm font-semibold hover:border-hub-purple disabled:opacity-50">{cohort ? 'Save changes' : 'Save draft'}</button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep((current) => Math.min(3, current + 1))} className="inline-flex min-h-10 items-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark">Continue<ArrowRight size={16} aria-hidden="true" /></button>
          ) : (
            <button type="button" disabled={!canConfirm || busy} onClick={() => save('READY')} className="inline-flex min-h-10 items-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:cursor-not-allowed disabled:opacity-45"><Check size={16} aria-hidden="true" />Confirm Ready</button>
          )}
        </div>
      </div>
    </section>
  )
}

function ReviewRow({ label, children }) {
  return <div className="grid gap-1 px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4"><dt className="text-xs font-semibold uppercase text-hub-muted">{label}</dt><dd className="min-w-0 break-words text-sm font-medium">{children}</dd></div>
}

export function CohortDetail({ cohort, branches, users, user, onBack, onEdit, onSessions, onSave, onAddStudent, onRemoveStudent, busy }) {
  const [nextStatus, setNextStatus] = useState(cohort.status)
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  const branch = branches.find((item) => item.id === cohort.branch)
  const instructor = users.find((item) => item.id === cohort.instructor)
  const roster = cohort.students.map((id) => users.find((item) => item.id === id)).filter(Boolean)
  const curriculumSnapshot = cohort.curriculum_snapshot
  const availableStudents = users.filter((item) => item.application_role === 'STUDENT' && item.branch === cohort.branch && item.is_active && !cohort.students.includes(item.id))
  const canManage = user.application_role === 'SUPER_ADMIN' || user.application_role === 'BRANCH_ADMIN'

  async function updateStatus() {
    setError('')
    try {
      await onSave({ ...cohort, status: nextStatus })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function addSelectedStudent() {
    if (!studentId) return
    setError('')
    try {
      await onAddStudent(cohort.id, Number(studentId))
      setStudentId('')
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function removeStudent(id) {
    setError('')
    try {
      await onRemoveStudent(cohort.id, id)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hub-line pb-5">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to cohorts" className="mt-1 grid size-9 shrink-0 place-items-center border border-hub-line bg-white hover:border-hub-purple hover:text-hub-purple"><ArrowLeft size={17} aria-hidden="true" /></button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="max-w-full break-words text-2xl font-semibold tracking-tight">{cohort.name || 'Untitled draft'}</h1>
              <StatusFlag status={cohort.status} />
            </div>
            <p className="mt-1 text-sm text-hub-muted">{branch?.name} · Updated {new Date(cohort.updated_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={onSessions} className="inline-flex min-h-10 items-center gap-2 border border-hub-line bg-white px-3 text-sm font-semibold hover:border-hub-purple hover:text-hub-purple"><ClipboardList size={15} aria-hidden="true" />Sessions & attendance</button>{canManage && <button type="button" onClick={onEdit} className="inline-flex min-h-10 items-center gap-2 border border-hub-line bg-white px-3 text-sm font-semibold hover:border-hub-purple hover:text-hub-purple"><Pencil size={15} aria-hidden="true" />Edit cohort</button>}</div>
      </div>

      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="space-y-7">
          <section>
            <h2 className="text-sm font-semibold">Cohort details</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-4 border-y border-hub-line bg-white p-4 sm:grid-cols-2">
              <DetailValue label="Branch">{branch?.name}</DetailValue>
              <DetailValue label="Assigned instructor">{instructor ? fullName(instructor) : 'Not assigned'}</DetailValue>
              <DetailValue label="Start date">{displayDate(cohort.start_date)}</DetailValue>
              <DetailValue label="End date">{displayDate(cohort.end_date)}</DetailValue>
              <div className="sm:col-span-2"><DetailValue label="Description">{cohort.description || 'No description added.'}</DetailValue></div>
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Learning plan</h2>{curriculumSnapshot && <span className="border border-hub-line bg-white px-2 py-1 text-xs font-semibold">Frozen snapshot</span>}</div>
            {curriculumSnapshot ? (
              <div className="mt-3 divide-y divide-hub-line border-y border-hub-line bg-white">
                <div className="px-4 py-3"><p className="text-sm font-semibold">{curriculumSnapshot.curriculum_name} · Version {curriculumSnapshot.version_number}</p><p className="mt-1 text-xs text-hub-muted">Captured {displayDate(curriculumSnapshot.published_at)}</p></div>
                {curriculumSnapshot.topics.map((topic, topicIndex) => <div key={topic.id ?? `topic-${topicIndex}`} className="px-4 py-3"><h3 className="text-sm font-semibold">{topic.title}</h3>{topic.description && <p className="mt-1 text-sm leading-5 text-hub-muted">{topic.description}</p>}{topic.objectives?.length > 0 && <ul className="mt-2 space-y-1">{topic.objectives.map((objective, objectiveIndex) => <li key={objective.id ?? `objective-${objectiveIndex}`} className="text-xs text-hub-muted">Objective: {typeof objective === 'string' ? objective : objective.text}</li>)}</ul>}<ul className="mt-2 space-y-1">{(topic.lessons ?? []).map((lesson, lessonIndex) => { const materials = typeof lesson === 'string' ? [] : lesson.materials ?? []; return <li key={lesson.id ?? `lesson-${lessonIndex}`} className="text-xs">{typeof lesson === 'string' ? lesson : lesson.title}{materials.length > 0 && <span className="ml-2 text-hub-muted">{materials.length} learning link{materials.length === 1 ? '' : 's'}</span>}</li> })}</ul></div>)}
              </div>
            ) : <p className="mt-3 border-y border-hub-line bg-white px-4 py-5 text-sm text-hub-muted">No curriculum snapshot is attached to this cohort.</p>}
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Student roster</h2>
                <p className="mt-1 text-xs text-hub-muted">{roster.length} enrolled</p>
              </div>
              {canManage && availableStudents.length > 0 && (
                <div className="flex w-full gap-2 sm:w-auto">
                  <label className="min-w-0 flex-1 sm:w-56">
                    <span className="sr-only">Select a student to enroll</span>
                    <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="min-h-10 w-full border border-hub-line bg-white px-2 text-sm focus:border-hub-purple focus:outline-none">
                      <option value="">Add existing student</option>
                      {availableStudents.map((student) => <option key={student.id} value={student.id}>{fullName(student)}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={!studentId || busy} onClick={addSelectedStudent} aria-label="Enroll selected student" className="grid min-h-10 min-w-10 place-items-center bg-hub-purple text-white hover:bg-hub-purple-dark disabled:cursor-not-allowed disabled:opacity-45"><Plus size={17} aria-hidden="true" /></button>
                </div>
              )}
            </div>
            <div className="mt-3 divide-y divide-hub-line border-y border-hub-line bg-white">
              {roster.map((student) => (
                <div key={student.id} className="flex min-h-14 items-center gap-3 px-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center bg-[#f0edf0] text-xs font-bold">{student.first_name[0]}{student.last_name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{fullName(student)}</span>
                    <span className="block truncate text-xs text-hub-muted">{student.email}</span>
                  </span>
                  {canManage && <button type="button" disabled={busy || (cohort.status === 'READY' && roster.length <= 1)} onClick={() => removeStudent(student.id)} title={cohort.status === 'READY' && roster.length <= 1 ? 'A Ready cohort must keep one student' : `Remove ${fullName(student)}`} aria-label={`Remove ${fullName(student)} from cohort`} className="grid size-9 shrink-0 place-items-center text-hub-muted hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={16} aria-hidden="true" /></button>}
                </div>
              ))}
              {roster.length === 0 && <p className="px-4 py-8 text-sm text-hub-muted">No students enrolled yet.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          {canManage && <section className="border border-hub-line bg-white p-4">
            <h2 className="text-sm font-semibold">Status management</h2>
            <label className="mt-4 block text-xs font-semibold uppercase text-hub-muted">Set status
              <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="mt-1.5 min-h-11 w-full border border-hub-line bg-white px-3 text-sm font-normal normal-case text-hub-ink focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15">
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy || nextStatus === cohort.status} onClick={updateStatus} className="mt-3 min-h-10 w-full bg-hub-ink px-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-45">Save status</button>
            {nextStatus === 'READY' && cohort.status !== 'READY' && <p className="mt-3 text-xs leading-5 text-hub-muted">Ready requires complete details, an assigned instructor, and at least one student.</p>}
          </section>}
          <section className="border-y border-hub-line py-4">
            <h2 className="text-sm font-semibold">Cohort information</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <DetailValue label="Created">#{cohort.id}</DetailValue>
              <DetailValue label="Instructor">{instructor ? fullName(instructor) : 'Unassigned'}</DetailValue>
              <DetailValue label="Roster size">{studentCount(roster.length)}</DetailValue>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  )
}

function DetailValue({ label, children }) {
  return <div><dt className="text-xs font-semibold uppercase text-hub-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-hub-ink">{children}</dd></div>
}