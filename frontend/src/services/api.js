const emptySnapshot = () => ({
  currentUser: null, branches: [], users: [], curricula: [], curriculumVersions: [],
  cohorts: [], sessions: [], attendance: [], questions: [], assessments: [], attempts: [],
  graduationRequirements: [], graduationSnapshots: [], graduationReports: [], attendanceReports: [], certificates: [],
})

let lastSnapshot = emptySnapshot()

function cookie(name) {
  return document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
}

function errorText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(errorText).join(' ')
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key === 'non_field_errors' || key === 'detail' ? '' : `${key}: `}${errorText(item)}`).join(' ')
  return 'The request could not be completed.'
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRFToken'] = decodeURIComponent(cookie('csrftoken') || '')
  const response = await fetch(`/api/${path}`, { method, headers, credentials: 'same-origin', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(errorText(data) || `Request failed (${response.status}).`)
    error.status = response.status
    error.field = data && typeof data === 'object' ? Object.keys(data)[0] : undefined
    throw error
  }
  return data
}

function normalizeUser(user) {
  return { ...user, branch: user.branch?.id ?? user.branch ?? null, is_active: user.is_active ?? true }
}

function normalizeAttempt(attempt, studentId) {
  return {
    ...attempt,
    student: attempt.student?.id ?? attempt.student ?? studentId,
    current_question: attempt.current_question_position,
    question_deadline_at: attempt.current_question_deadline_at,
    question: attempt.question ? { ...attempt.question, question_type: attempt.question.question_type_snapshot } : null,
    answers: Object.fromEntries((attempt.answers ?? []).map((answer) => [answer.assessment_question, answer.selected_option_ids])),
  }
}

async function snapshot() {
  let profile
  try {
    profile = await request('accounts/me/')
  } catch (error) {
    if (error.status === 401 || error.status === 403) return (lastSnapshot = emptySnapshot())
    throw error
  }
  const user = normalizeUser(profile)
  const data = { ...emptySnapshot(), currentUser: user, users: [user], branches: profile.branch ? [profile.branch] : [] }
  if (user.application_role === 'STUDENT') {
    const [assessments, certificates] = await Promise.all([request('student/assessments/'), request('student/certificates/')])
    data.assessments = assessments.map((assessment) => ({ ...assessment, questions: [], status: 'PUBLISHED' }))
    data.attempts = assessments.flatMap((assessment) => assessment.attempt_details.map((attempt) => normalizeAttempt(attempt, user.id)))
    data.certificates = certificates
    return (lastSnapshot = data)
  }
  const isManager = ['SUPER_ADMIN', 'BRANCH_ADMIN'].includes(user.application_role)
  const [cohorts, assessments, users, branches, curricula] = await Promise.all([
    request('cohorts/'), request('assessments/'), request('accounts/users/'),
    isManager ? request('branches/') : Promise.resolve(data.branches),
    isManager ? request('curricula/') : Promise.resolve([]),
  ])
  data.branches = branches
  data.users = users.map(normalizeUser)
  data.curricula = curricula
  data.cohorts = cohorts.map((cohort) => ({ ...cohort, students: cohort.students.map((student) => student.id) }))
  for (const cohort of cohorts) {
    for (const student of cohort.students) {
      if (!data.users.some((item) => item.id === student.id)) data.users.push({ ...student, branch: cohort.branch, application_role: 'STUDENT', is_active: true })
    }
  }
  data.curriculumVersions = (await Promise.all(curricula.map(async (curriculum) => {
    const versions = await request(`curricula/${curriculum.id}/versions/`)
    return Promise.all(versions.map(async (version) => ({ ...await request(`curricula/${curriculum.id}/versions/${version.id}/`), curriculum: curriculum.id })))
  }))).flat()
  data.assessments = assessments.map((assessment) => ({ ...assessment, questions: assessment.question_details.map((question) => ({ ...question, id: question.question, assessment_question_id: question.id })) }))
  data.questions = (await Promise.all(branches.map((branch) => request(`question-bank/questions/?branch=${branch.id}`)))).flat()
  data.attempts = (await Promise.all(assessments.map(async (assessment) => (await request(`assessments/${assessment.id}/attempts/`)).map((attempt) => {
    const mapped = normalizeAttempt(attempt)
    mapped.answers = Object.fromEntries((attempt.answers ?? []).map((answer) => [assessment.question_details.find((question) => question.id === answer.assessment_question)?.question, answer.selected_option_ids]))
    return mapped
  })))).flat()
  await Promise.all(data.cohorts.map(async (cohort) => {
    const [sessions, requirements, report, history, certificates, attendanceReport] = await Promise.all([
      request(`cohorts/${cohort.id}/sessions/`), request(`cohorts/${cohort.id}/graduation-requirements/`),
      request(`cohorts/${cohort.id}/results/`), request(`cohorts/${cohort.id}/results/history/`),
      isManager ? request(`cohorts/${cohort.id}/certificates/`) : Promise.resolve([]),
      request(`cohorts/${cohort.id}/attendance-report/`),
    ])
    data.sessions.push(...sessions)
    if (requirements) data.graduationRequirements.push({ ...requirements, cohort: cohort.id })
    if (report.requirements) data.graduationReports.push(report)
    data.graduationSnapshots.push(...history.map((item) => ({ ...item, cohort: cohort.id })))
    data.certificates.push(...certificates)
    data.attendanceReports.push(attendanceReport)
    const records = await Promise.all(sessions.map(async (session) => (await request(`cohorts/${cohort.id}/sessions/${session.id}/attendance/`)).map((record) => ({ ...record, session: session.id }))))
    data.attendance.push(...records.flat())
  }))
  return (lastSnapshot = data)
}

async function change(path, method, body) {
  await request(path, { method, body })
  return snapshot()
}

export const api = {
  snapshot,
  async signIn(credentials) {
    await request('health/')
    await request('accounts/login/', { method: 'POST', body: credentials })
    await request('health/')
    return snapshot()
  },
  async signOut() {
    await request('accounts/logout/', { method: 'POST' })
    return (lastSnapshot = emptySnapshot())
  },
  saveBranch(input) { return change(input.id ? `branches/${input.id}/` : 'branches/', input.id ? 'PATCH' : 'POST', input) },
  saveUser(input) {
    const body = { ...input }
    if (input.id) {
      delete body.username
      delete body.password
      if (lastSnapshot.currentUser?.application_role !== 'SUPER_ADMIN') { delete body.application_role; delete body.branch }
    }
    else delete body.is_active
    return change(input.id ? `accounts/users/${input.id}/` : 'accounts/users/', input.id ? 'PATCH' : 'POST', body)
  },
  saveCurriculum(input) { return change(input.id ? `curricula/${input.id}/` : 'curricula/', input.id ? 'PATCH' : 'POST', input) },
  createCurriculumVersion(id, changeNote) { return change(`curricula/${id}/versions/`, 'POST', { change_note: changeNote }) },
  saveCurriculumVersion(id, version, input) { return change(`curricula/${id}/versions/${version}/`, 'PATCH', input) },
  publishCurriculumVersion(id, version) { return change(`curricula/${id}/versions/${version}/publish/`, 'POST', {}) },
  async saveCohort(input) {
    const previous = lastSnapshot.cohorts.find((cohort) => cohort.id === input.id)
    const body = Object.fromEntries(['branch', 'name', 'description', 'start_date', 'end_date', 'instructor', 'curriculum_version'].filter((key) => key in input).map((key) => [key, input[key] === '' ? null : input[key]]))
    const created = await request(input.id ? `cohorts/${input.id}/` : 'cohorts/', { method: input.id ? 'PATCH' : 'POST', body: { ...body, ...(!input.id ? { status: 'DRAFT' } : {}) } })
    const id = created.id
    const existing = previous?.students ?? []
    const selected = input.students ?? existing
    try {
      for (const student of selected.filter((item) => !existing.includes(item))) await request(`cohorts/${id}/enrollments/`, { method: 'POST', body: { student } })
      for (const student of existing.filter((item) => !selected.includes(item))) await request(`cohorts/${id}/enrollments/${student}/`, { method: 'DELETE' })
      if (input.status && input.status !== created.status) await request(`cohorts/${id}/`, { method: 'PATCH', body: { status: input.status } })
    } catch (error) {
      throw new Error(`Cohort details were saved, but enrollment or status could not be saved: ${error.message}`, { cause: error })
    }
    return snapshot()
  },
  addStudent(cohort, student) { return change(`cohorts/${cohort}/enrollments/`, 'POST', { student }) },
  removeStudent(cohort, student) { return change(`cohorts/${cohort}/enrollments/${student}/`, 'DELETE') },
  saveSession(input) {
    const body = { ...input }
    if (!body.status) delete body.status
    return change(`cohorts/${input.cohort}/sessions/${input.id ? `${input.id}/` : ''}`, input.id ? 'PATCH' : 'POST', body)
  },
  setAttendance(session, student, input) {
    const cohort = lastSnapshot.sessions.find((item) => item.id === session)?.cohort
    const existing = lastSnapshot.attendance.some((item) => item.session === session && item.student === student)
    return change(`cohorts/${cohort}/sessions/${session}/attendance/${existing ? `${student}/` : ''}`, existing ? 'PATCH' : 'POST', { ...input, ...(existing ? {} : { student }) })
  },
  saveGraduationRequirements(id, input) { return change(`cohorts/${id}/graduation-requirements/`, 'PUT', input) },
  finalizeGraduationResults(id) { return change(`cohorts/${id}/results/finalize/`, 'POST', {}) },
  issueCertificates(id, studentIds) { return change(`cohorts/${id}/certificates/`, 'POST', { student_ids: studentIds }) },
  async verifyCertificate(reference) {
    try { return await request(`certificates/verify/${encodeURIComponent(reference.trim())}/`) }
    catch (error) { if (error.status === 404) return null; throw error }
  },
  saveQuestion(input) { return change(input.id ? `question-bank/questions/${input.id}/` : `question-bank/questions/?branch=${input.branch}`, input.id ? 'PATCH' : 'POST', input) },
  saveAssessment(input) {
    const body = { ...input, cohort: input.cohort || null, curriculum_topic: input.curriculum_topic || null, deadline_at: input.deadline_at || null, questions: input.questions.map((question, position) => ({ question: question.id, position, points: question.points, time_limit_seconds: question.time_limit_seconds || null })) }
    return change(input.id ? `assessments/${input.id}/` : 'assessments/', input.id ? 'PATCH' : 'POST', body)
  },
  publishAssessment(id) { return change(`assessments/${id}/publish/`, 'POST', {}) },
  cloneAssessment(id) { return change(`assessments/${id}/new-version/`, 'POST', {}) },
  releaseAssessment(id) { return change(`assessments/${id}/release-results/`, 'POST', {}) },
  startAssessment(id) { return change(`student/assessments/${id}/attempts/`, 'POST', {}) },
  answerAssessment(id, question, selected, action) { return change(`student/attempts/${id}/`, 'POST', { assessment_question: question, selected_option_ids: selected, action }) },
}

export function calculateGraduationReport(data, cohortId) {
  return data.graduationReports.find((report) => report.cohort.id === Number(cohortId)) ?? null
}