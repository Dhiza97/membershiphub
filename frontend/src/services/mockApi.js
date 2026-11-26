const STORAGE_KEY = 'membershiphub-demo-v4'

const seed = {
  currentUserId: null,
  branches: [
    { id: 1, name: 'Central Fellowship', is_active: true, location: 'Accra Central', timezone: 'Africa/Accra' },
    { id: 2, name: 'North Ridge', is_active: true, location: 'North Ridge', timezone: 'Africa/Accra' },
    { id: 3, name: 'Riverside Chapel', is_active: false, location: 'Adabraka', timezone: 'Africa/Accra' },
  ],
  users: [
    { id: 1, username: 'admin', first_name: 'Esi', last_name: 'Mensah', email: 'esi@membershiphub.test', application_role: 'SUPER_ADMIN', branch: null, is_active: true },
    { id: 2, username: 'central-admin', first_name: 'Daniel', last_name: 'Owusu', email: 'daniel@membershiphub.test', application_role: 'BRANCH_ADMIN', branch: 1, is_active: true },
    { id: 3, username: 'north-admin', first_name: 'Martha', last_name: 'Asare', email: 'martha@membershiphub.test', application_role: 'BRANCH_ADMIN', branch: 2, is_active: true },
    { id: 4, username: 'esther-boateng', first_name: 'Esther', last_name: 'Boateng', email: 'esther@membershiphub.test', application_role: 'INSTRUCTOR', branch: 1, is_active: true },
    { id: 5, username: 'kojo-addo', first_name: 'Kojo', last_name: 'Addo', email: 'kojo@membershiphub.test', application_role: 'INSTRUCTOR', branch: 1, is_active: true },
    { id: 6, username: 'abena-sarpong', first_name: 'Abena', last_name: 'Sarpong', email: 'abena@membershiphub.test', application_role: 'STUDENT', branch: 1, is_active: true },
    { id: 7, username: 'kofi-asare', first_name: 'Kofi', last_name: 'Asare', email: 'kofi@membershiphub.test', application_role: 'STUDENT', branch: 1, is_active: true },
    { id: 8, username: 'ama-mensah', first_name: 'Ama', last_name: 'Mensah', email: 'ama@membershiphub.test', application_role: 'STUDENT', branch: 1, is_active: true },
    { id: 9, username: 'nana-acheampong', first_name: 'Nana', last_name: 'Acheampong', email: 'nana@membershiphub.test', application_role: 'INSTRUCTOR', branch: 2, is_active: true },
    { id: 10, username: 'yaw-gyasi', first_name: 'Yaw', last_name: 'Gyasi', email: 'yaw@membershiphub.test', application_role: 'STUDENT', branch: 2, is_active: true },
    { id: 11, username: 'akua-osei', first_name: 'Akua', last_name: 'Osei', email: 'akua@membershiphub.test', application_role: 'STUDENT', branch: 2, is_active: true },
  ],
  curricula: [
    { id: 201, branch: 1, name: 'Membership Foundations', description: 'Core learning for new members.', is_active: true },
    { id: 202, branch: 2, name: 'North Ridge Foundations', description: 'North Ridge branch learning plan.', is_active: true },
  ],
  curriculumVersions: [
    {
      id: 2101,
      curriculum: 201,
      version_number: 1,
      status: 'PUBLISHED',
      change_note: 'Initial branch curriculum',
      published_at: '2026-04-15T10:00:00Z',
      topics: [
        {
          id: 3101,
          title: 'The Church',
          description: 'Understand the church and its shared calling.',
          notes: 'Introduce local examples during discussion.',
          position: 0,
          objectives: [{ id: 4101, text: 'Describe the purpose of the church.', position: 0 }],
          lessons: [{
            id: 5101,
            title: 'A shared calling',
            description: 'Explore how members participate in community life.',
            notes: '',
            position: 0,
            materials: [{ id: 6101, title: 'Reading guide', url: 'https://example.org/reading-guide', material_type: 'ARTICLE', description: 'Preparation for group discussion.', position: 0 }],
          }],
        },
        {
          id: 3102,
          title: 'Faith in Practice',
          description: 'Connect personal beliefs to shared service.',
          notes: '',
          position: 1,
          objectives: [{ id: 4102, text: 'Identify practical ways to serve in the branch.', position: 0 }],
          lessons: [{ id: 5102, title: 'Service and community', description: '', notes: '', position: 0, materials: [] }],
        },
      ],
    },
    {
      id: 2201,
      curriculum: 202,
      version_number: 1,
      status: 'PUBLISHED',
      change_note: 'Initial branch curriculum',
      published_at: '2026-05-01T10:00:00Z',
      topics: [
        { id: 3201, title: 'Welcome to North Ridge', description: 'The story and work of the branch.', notes: '', position: 0, objectives: [], lessons: [{ id: 5201, title: 'Our community', description: '', notes: '', position: 0, materials: [] }] },
      ],
    },
  ],
  cohorts: [
    {
      id: 101,
      branch: 1,
      name: 'Foundations · June 2026',
      description: 'A practical introduction to the life and work of the church.',
      start_date: '2026-06-08',
      end_date: '2026-08-03',
      status: 'ACTIVE',
      instructor: 4,
      curriculum_version: 2101,
      curriculum_snapshot: {
        curriculum_id: 201,
        curriculum_name: 'Membership Foundations',
        version_id: 2101,
        version_number: 1,
        published_at: '2026-04-15T10:00:00Z',
        topics: [
          { id: 3101, title: 'The Church', description: 'Understand the church and its shared calling.', objectives: [{ id: 4101, text: 'Describe the purpose of the church.' }], lessons: [{ id: 5101, title: 'A shared calling', materials: [{ id: 6101, title: 'Reading guide', url: 'https://example.org/reading-guide' }] }] },
          { id: 3102, title: 'Faith in Practice', description: 'Connect personal beliefs to shared service.', objectives: [{ id: 4102, text: 'Identify practical ways to serve in the branch.' }], lessons: [{ id: 5102, title: 'Service and community', materials: [] }] },
        ],
      },
      students: [6, 7, 8],
      updated_at: '2026-06-05T10:00:00Z',
    },
    {
      id: 102,
      branch: 1,
      name: 'Foundations · September 2026',
      description: 'Membership foundations for the September intake.',
      start_date: '2026-09-14',
      end_date: '2026-11-09',
      status: 'READY',
      instructor: 5,
      curriculum_version: 2101,
      curriculum_snapshot: {
        curriculum_id: 201,
        curriculum_name: 'Membership Foundations',
        version_id: 2101,
        version_number: 1,
        published_at: '2026-04-15T10:00:00Z',
        topics: [
          { id: 3101, title: 'The Church', description: 'Understand the church and its shared calling.', objectives: [{ id: 4101, text: 'Describe the purpose of the church.' }], lessons: [{ id: 5101, title: 'A shared calling', materials: [{ id: 6101, title: 'Reading guide', url: 'https://example.org/reading-guide' }] }] },
          { id: 3102, title: 'Faith in Practice', description: 'Connect personal beliefs to shared service.', objectives: [{ id: 4102, text: 'Identify practical ways to serve in the branch.' }], lessons: [{ id: 5102, title: 'Service and community', materials: [] }] },
        ],
      },
      students: [6, 8],
      updated_at: '2026-08-30T14:00:00Z',
    },
    {
      id: 103,
      branch: 2,
      name: 'North Ridge · October 2026',
      description: 'A new membership class for North Ridge.',
      start_date: '2026-10-05',
      end_date: '2026-12-07',
      status: 'DRAFT',
      instructor: 9,
      curriculum_version: 2201,
      curriculum_snapshot: null,
      students: [10],
      updated_at: '2026-09-11T09:30:00Z',
    },
  ],
  sessions: [
    { id: 301, cohort: 101, title: 'Welcome and belonging', description: 'Introductions and an overview of the course.', date: '2026-06-08', start_time: '18:00', end_time: '19:30', status: 'COMPLETED', created_by: 4 },
    { id: 302, cohort: 101, title: 'A shared calling', description: 'Discuss service and community life.', date: '2026-06-15', start_time: '18:00', end_time: '19:30', status: 'COMPLETED', created_by: 4 },
    { id: 303, cohort: 102, title: 'Getting started', description: 'First meeting for the September intake.', date: '2026-10-12', start_time: '18:30', end_time: '20:00', status: 'SCHEDULED', created_by: 5 },
  ],
  attendance: [
    { id: 701, session: 301, student: 6, status: 'PRESENT', note: '' },
    { id: 702, session: 301, student: 7, status: 'LATE', note: '' },
    { id: 703, session: 301, student: 8, status: 'EXCUSED', note: 'Family commitment' },
    { id: 704, session: 302, student: 6, status: 'ABSENT', note: '' },
    { id: 705, session: 302, student: 7, status: 'PRESENT', note: '' },
    { id: 706, session: 302, student: 8, status: 'PRESENT', note: '' },
  ],
  questions: [],
  assessments: [],
  attempts: [],
  graduationRequirements: [],
  graduationSnapshots: [],
  certificates: [],
  notifications: [
    { id: 901, user: 1, title: 'Branch performance review', body: 'Review cohort attendance and completion trends across your branches.', read: false, created_at: '2026-11-24T09:00:00Z' },
    { id: 902, user: 2, title: 'Graduation results need review', body: 'Check the current eligibility report for Foundations · June 2026.', read: false, created_at: '2026-11-25T10:30:00Z' },
    { id: 903, user: 4, title: 'Assessment review', body: 'Submitted attempts are ready for instructor review.', read: false, created_at: '2026-11-25T13:15:00Z' },
    { id: 904, user: 6, title: 'Class update', body: 'Your cohort administrator has posted an update for your class.', read: false, created_at: '2026-11-26T08:00:00Z' },
  ],
  announcements: [
    { id: 951, branch: null, title: 'Welcome to MembershipHub', body: 'Cohort schedules, attendance, assessments, and results are available from your workspace.', published_at: '2026-11-20T09:00:00Z', published_by: 1 },
    { id: 952, branch: 1, title: 'Central Fellowship cohort review', body: 'Branch administrators and instructors: review learner progress before the next membership intake.', published_at: '2026-11-23T12:00:00Z', published_by: 2 },
  ],
}

function readStore() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...seed, ...JSON.parse(stored) } : structuredClone(seed)
  } catch {
    return structuredClone(seed)
  }
}

let store = readStore()

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function copy(value) {
  return structuredClone(value)
}

function delay() {
  return new Promise((resolve) => window.setTimeout(resolve, 140))
}

function fail(message, field) {
  const error = new Error(message)
  error.field = field
  throw error
}

function getUser(id) {
  return store.users.find((user) => user.id === Number(id))
}

function getBranch(id) {
  return store.branches.find((branch) => branch.id === Number(id))
}

function enrollmentDate(branchId) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: getBranch(branchId)?.timezone ?? 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getCurriculum(id, actor) {
  const curriculum = store.curricula.find((item) => item.id === Number(id))
  if (!curriculum) fail('That curriculum no longer exists.')
  if (actor.application_role === 'BRANCH_ADMIN' && curriculum.branch !== actor.branch) {
    fail('You can only manage curricula in your assigned branch.')
  }
  if (!['BRANCH_ADMIN', 'SUPER_ADMIN'].includes(actor.application_role)) {
    fail('Only administrators can manage curricula.')
  }
  return curriculum
}

function makeCurriculumSnapshot(version) {
  const curriculum = store.curricula.find((item) => item.id === version.curriculum)
  return {
    curriculum_id: curriculum.id,
    curriculum_name: curriculum.name,
    version_id: version.id,
    version_number: version.version_number,
    published_at: version.published_at,
    topics: copy(version.topics),
  }
}

function getSnapshot() {
  const currentUser = getUser(store.currentUserId) ?? null
  if (currentUser?.application_role === 'STUDENT') {
    store.attempts.filter((attempt) => attempt.student === currentUser.id).forEach(expireAttempt)
    persist()
  }
  const isStudent = currentUser?.application_role === 'STUDENT'
  return copy({
    currentUser,
    branches: store.branches,
    users: store.users,
    curricula: store.curricula,
    curriculumVersions: store.curriculumVersions,
    cohorts: store.cohorts,
    sessions: store.sessions,
    attendance: store.attendance,
    questions: isStudent ? [] : store.questions,
    assessments: isStudent ? store.assessments.filter((assessment) => studentCanAccess(assessment, currentUser)).map((assessment) => ({
      ...assessment,
      questions: assessment.questions.map((question) => ({
        id: question.id, prompt: question.prompt, question_type: question.question_type,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
        points: question.points, time_limit_seconds: question.time_limit_seconds,
        ...(assessment.results_released ? { correct_option_ids: question.correct_option_ids, explanation: question.explanation } : {}),
      })),
    })) : store.assessments,
    attempts: isStudent ? store.attempts.filter((attempt) => attempt.student === currentUser.id).map((attempt) => {
      const released = store.assessments.find((assessment) => assessment.id === attempt.assessment)?.results_released
      return { ...attempt, score: released ? attempt.score : null, max_score: released ? attempt.max_score : null }
    }) : store.attempts,
    graduationRequirements: isStudent
      ? store.graduationRequirements.filter((requirement) => store.cohorts.some((cohort) => cohort.id === requirement.cohort && cohort.students.includes(currentUser.id)))
      : store.graduationRequirements,
    graduationSnapshots: isStudent ? [] : store.graduationSnapshots,
    certificates: isStudent
      ? store.certificates.filter((certificate) => certificate.student === currentUser.id)
      : store.certificates,
    notifications: store.notifications.filter((item) => item.user === currentUser?.id),
    announcements: currentUser?.application_role === 'SUPER_ADMIN'
      ? store.announcements
      : store.announcements.filter((item) => item.branch == null || item.branch === currentUser?.branch),
  })
}

function assessmentForCohort(assessment, cohort, data) {
  return assessment.status === 'PUBLISHED' && assessment.branch === cohort.branch && (
    assessment.cohort === cohort.id || (assessment.curriculum_topic && data.curriculumVersions.some((version) => (
      version.id === cohort.curriculum_version && version.topics.some((topic) => String(topic.id) === String(assessment.curriculum_topic))
    )))
  )
}

export function calculateGraduationReport(data, cohortId) {
  const cohort = data.cohorts.find((item) => item.id === Number(cohortId))
  const requirements = data.graduationRequirements.find((item) => item.cohort === cohort?.id)
  if (!cohort || !requirements) return null
  const assessments = requirements.required_assessments.map((id) => data.assessments.find((item) => item.id === id)).filter(Boolean)
  const students = cohort.students.map((studentId) => {
    const student = data.users.find((item) => item.id === studentId)
    const enrolledOn = cohort.enrollment_dates?.[studentId] ?? '0001-01-01'
    const sessions = data.sessions.filter((session) => session.cohort === cohort.id && session.status === 'COMPLETED' && session.date >= enrolledOn)
    const records = data.attendance.filter((record) => record.student === studentId && sessions.some((session) => session.id === record.session))
    const attended = records.filter((record) => ['PRESENT', 'LATE'].includes(record.status)).length
    const excused = records.filter((record) => record.status === 'EXCUSED').length
    const denominator = sessions.length - excused
    const attendance = denominator ? attended * 100 / denominator : null
    const details = assessments.map((assessment) => {
      const attempt = assessmentForCohort(assessment, cohort, data) ? data.attempts.filter((item) => item.student === studentId && item.assessment === assessment.id && ['SUBMITTED', 'TIMED_OUT'].includes(item.status) && item.score != null && item.max_score > 0).sort((left, right) => right.attempt_number - left.attempt_number)[0] : null
      return { id: assessment.id, title: assessment.title, attempt_number: attempt?.attempt_number ?? null, score_percentage: attempt ? attempt.score * 100 / attempt.max_score : null }
    })
    const scores = details.filter((item) => item.score_percentage != null).map((item) => item.score_percentage)
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null
    const reasons = []
    const incomplete = attendance == null || !assessments.length || scores.length !== requirements.required_assessments.length
    if (attendance == null) reasons.push('Attendance is not available.')
    else if (attendance < requirements.minimum_attendance) reasons.push('Attendance is below the required minimum.')
    if (scores.length !== requirements.required_assessments.length || !assessments.length) reasons.push('Required assessments are incomplete.')
    if (average != null && average < requirements.minimum_assessment_score) reasons.push('Assessment average is below the required minimum.')
    return { student: { id: studentId, username: student?.username ?? '', first_name: student?.first_name ?? '', last_name: student?.last_name ?? '' }, attendance_percentage: attendance, completed_sessions: sessions.length, attended_sessions: attended, excused_sessions: excused, assessment_average: average, assessments: details, eligibility: incomplete ? 'INCOMPLETE' : reasons.length ? 'INELIGIBLE' : 'ELIGIBLE', reasons }
  })
  return { cohort: { id: cohort.id, name: cohort.name, branch: data.branches.find((branch) => branch.id === cohort.branch)?.name }, requirements: { ...requirements, required_assessments: assessments.map((assessment) => ({ id: assessment.id, title: assessment.title })) }, students }
}

function requireResultsManager(cohort, actor) {
  if (!cohort || !(actor.application_role === 'SUPER_ADMIN' || (actor.application_role === 'BRANCH_ADMIN' && actor.branch === cohort.branch))) fail('Only administrators can change results for an accessible cohort.')
}

function studentCanAccess(assessment, student) {
  return assessment.status === 'PUBLISHED' && store.cohorts.some((cohort) => cohort.students.includes(student.id) && (
    cohort.id === assessment.cohort || (assessment.curriculum_topic && store.curriculumVersions.some((version) => version.id === cohort.curriculum_version && version.topics.some((topic) => String(topic.id) === String(assessment.curriculum_topic))))
  ))
}

function authorCanAccess(assessment, actor) {
  if (actor.application_role === 'SUPER_ADMIN') return true
  if (actor.application_role === 'BRANCH_ADMIN') return assessment.branch === actor.branch
  return actor.application_role === 'INSTRUCTOR' && store.cohorts.some((cohort) => cohort.id === assessment.cohort && cohort.instructor === actor.id)
}

function gradeAttempt(attempt, assessment, status) {
  attempt.status = status
  attempt.submitted_at = new Date().toISOString()
  attempt.max_score = assessment.questions.reduce((total, question) => total + Number(question.points), 0)
  attempt.score = assessment.questions.reduce((total, question) => {
    const selected = attempt.answers[question.id] ?? []
    const correct = question.correct_option_ids
    return total + (selected.length === correct.length && selected.every((id) => correct.includes(id)) ? Number(question.points) : 0)
  }, 0)
}

function expireAttempt(attempt) {
  if (attempt.status !== 'IN_PROGRESS') return
  const assessment = store.assessments.find((item) => item.id === attempt.assessment)
  const now = Date.now()
  if (attempt.deadline_at && now >= Date.parse(attempt.deadline_at)) {
    gradeAttempt(attempt, assessment, 'TIMED_OUT')
    return
  }
  while (assessment.timing_mode === 'PER_QUESTION' && attempt.question_deadline_at && now >= Date.parse(attempt.question_deadline_at)) {
    const nextStart = Date.parse(attempt.question_deadline_at)
    attempt.current_question += 1
    if (attempt.current_question >= assessment.questions.length) {
      gradeAttempt(attempt, assessment, 'TIMED_OUT')
      return
    }
    attempt.question_deadline_at = new Date(nextStart + assessment.questions[attempt.current_question].time_limit_seconds * 1000).toISOString()
  }
}

export const mockApi = {
  async saveGraduationRequirements(cohortId, input, actor) {
    await delay()
    const cohort = store.cohorts.find((item) => item.id === Number(cohortId))
    requireResultsManager(cohort, actor)
    const attendance = Number(input.minimum_attendance)
    const assessmentScore = Number(input.minimum_assessment_score)
    if (input.minimum_attendance === '' || input.minimum_assessment_score === '' || !Number.isFinite(attendance) || !Number.isFinite(assessmentScore) || attendance < 0 || attendance > 100 || assessmentScore < 0 || assessmentScore > 100) fail('Enter thresholds from 0 to 100.')
    const assessmentIds = [...new Set(input.required_assessments.map(Number))]
    if (!assessmentIds.length || assessmentIds.some((id) => !store.assessments.some((assessment) => assessment.id === id && assessmentForCohort(assessment, cohort, store)))) fail('Select at least one published assessment for this cohort.')
    const existing = store.graduationRequirements.find((item) => item.cohort === cohort.id)
    const requirements = { cohort: cohort.id, minimum_attendance: attendance, minimum_assessment_score: assessmentScore, required_assessments: assessmentIds }
    if (existing) Object.assign(existing, requirements)
    else store.graduationRequirements.push(requirements)
    persist()
    return getSnapshot()
  },

  async finalizeGraduationResults(cohortId, actor) {
    await delay()
    const cohort = store.cohorts.find((item) => item.id === Number(cohortId))
    requireResultsManager(cohort, actor)
    const report = calculateGraduationReport(getSnapshot(), cohort.id)
    if (!report) fail('Set graduation requirements before finalizing results.')
    report.finalized_by = { id: actor.id, name: [actor.first_name, actor.last_name].filter(Boolean).join(' ') || actor.username }
    store.graduationSnapshots.push({ id: Math.max(0, ...store.graduationSnapshots.map((item) => item.id)) + 1, cohort: cohort.id, finalized_at: new Date().toISOString(), report: copy(report) })
    persist()
    return getSnapshot()
  },

  async markNotificationRead(notificationId, actor) {
    await delay()
    const notification = store.notifications.find((item) => item.id === Number(notificationId) && item.user === actor.id)
    if (!notification) fail('Notification not found.')
    notification.read = true
    persist()
    return getSnapshot()
  },

  async postAnnouncement(input, actor) {
    await delay()
    if (!['SUPER_ADMIN', 'BRANCH_ADMIN'].includes(actor.application_role)) fail('Only administrators can publish announcements.')
    const branchId = actor.application_role === 'BRANCH_ADMIN' ? actor.branch : input.branch
    if (branchId != null && !getBranch(branchId)?.is_active) fail('Choose an active branch for this announcement.')
    const title = input.title.trim()
    const body = input.body.trim()
    if (!title || !body) fail('Enter an announcement title and message.')
    const id = Math.max(0, ...store.announcements.map((item) => item.id)) + 1
    const publishedAt = new Date().toISOString()
    store.announcements.unshift({
      id,
      branch: branchId,
      title,
      body,
      published_at: publishedAt,
      published_by: actor.id,
    })
    const recipients = store.users.filter((person) => (
      person.is_active
      && person.id !== actor.id
      && (branchId == null || person.branch === branchId)
    ))
    for (const recipient of recipients) {
      store.notifications.unshift({
        id: Math.max(0, ...store.notifications.map((item) => item.id)) + 1,
        user: recipient.id,
        title: `Announcement: ${title}`,
        body,
        read: false,
        created_at: publishedAt,
      })
    }
    persist()
    return getSnapshot()
  },

  async issueCertificates(cohortId, studentIds, actor) {
    await delay()
    const cohort = store.cohorts.find((item) => item.id === Number(cohortId))
    requireResultsManager(cohort, actor)
    const report = calculateGraduationReport(getSnapshot(), cohort.id)
    if (!report) fail('Set graduation requirements before issuing certificates.')
    const eligibleRows = new Map(
      report.students
        .filter((row) => row.eligibility === 'ELIGIBLE')
        .map((row) => [row.student.id, row]),
    )
    const selectedIds = studentIds ?? [...eligibleRows.keys()]
    if (!selectedIds.length) fail('There are no eligible students to issue certificates to.')
    if (new Set(selectedIds).size !== selectedIds.length) fail('A student can only be selected once.')
    if (selectedIds.some((id) => !eligibleRows.has(Number(id)))) {
      fail('Certificates can only be issued to currently eligible students.')
    }

    for (const id of selectedIds) {
      const studentId = Number(id)
      if (store.certificates.some((item) => item.cohort === cohort.id && item.student === studentId)) continue
      const row = eligibleRows.get(studentId)
      const student = getUser(studentId)
      if (!student) fail('A selected student no longer exists.')
      const nextId = Math.max(0, ...store.certificates.map((item) => item.id)) + 1
      store.certificates.push({
        id: nextId,
        certificate_number: `MH-${new Date().getFullYear()}-${String(nextId).padStart(6, '0')}`,
        verification_code: crypto.randomUUID(),
        cohort: cohort.id,
        cohort_name: cohort.name,
        branch_name: getBranch(cohort.branch)?.name ?? '',
        student: student.id,
        student_name: [student.first_name, student.last_name].filter(Boolean).join(' ') || student.username,
        attendance_percentage: row.attendance_percentage,
        assessment_average: row.assessment_average,
        minimum_attendance: report.requirements.minimum_attendance,
        minimum_assessment_score: report.requirements.minimum_assessment_score,
        issued_by: actor.id,
        issued_at: new Date().toISOString(),
      })
    }
    persist()
    return getSnapshot()
  },

  async verifyCertificate(reference) {
    await delay()
    const certificate = store.certificates.find(
      (item) => item.verification_code.toLowerCase() === String(reference).trim().toLowerCase(),
    )
    if (!certificate) return null
    return copy({
      valid: true,
      certificate_number: certificate.certificate_number,
      verification_code: certificate.verification_code,
      recipient_name: certificate.student_name,
      cohort_name: certificate.cohort_name,
      branch_name: certificate.branch_name,
      issued_at: certificate.issued_at,
    })
  },

  async saveQuestion(input, actor) {
    await delay()
    const branch = actor.application_role === 'SUPER_ADMIN' ? Number(input.branch) : actor.branch
    if (!['SUPER_ADMIN', 'BRANCH_ADMIN', 'INSTRUCTOR'].includes(actor.application_role) || !getBranch(branch)) fail('Choose an accessible branch.')
    const existing = input.id ? store.questions.find((question) => question.id === input.id) : null
    if (input.id && (!existing || existing.branch !== branch)) fail('Question not found.')
    if (!input.prompt.trim() || input.options.length < 2 || input.options.some((option) => !option.text.trim())) fail('Enter a question and at least two options.')
    const correct = input.options.filter((option) => option.is_correct).length
    if ((input.question_type === 'SINGLE' && correct !== 1) || (input.question_type === 'MULTIPLE' && correct < 1)) fail('Choose the correct answer options.')
    const question = { ...input, branch, id: existing?.id ?? Math.max(0, ...store.questions.map((item) => item.id)) + 1, prompt: input.prompt.trim(), options: input.options.map((option, index) => ({ ...option, id: index + 1, text: option.text.trim() })) }
    if (existing) Object.assign(existing, question)
    else store.questions.push(question)
    persist()
    return getSnapshot()
  },

  async saveAssessment(input, actor) {
    await delay()
    const cohort = store.cohorts.find((item) => item.id === Number(input.cohort))
    const version = store.curriculumVersions.find((item) => item.topics.some((topic) => String(topic.id) === String(input.curriculum_topic)))
    const curriculum = store.curricula.find((item) => item.id === version?.curriculum)
    const branch = cohort?.branch ?? curriculum?.branch
    if ((!cohort && !curriculum) || (cohort && curriculum) || !authorCanAccess({ cohort: cohort?.id, branch }, actor)) fail('Choose an accessible cohort or curriculum topic.')
    const existing = input.id ? store.assessments.find((item) => item.id === input.id) : null
    if (input.id && (!existing || !authorCanAccess(existing, actor))) fail('Assessment not found.')
    if (existing && existing.status !== 'DRAFT') fail('Published assessments cannot be edited.')
    if (!input.title.trim()) fail('Enter an assessment title.')
    if (Number(input.attempt_limit) < 1 || (input.timing_mode === 'WHOLE' && Number(input.duration_seconds) < 1)) fail('Enter a positive time and attempt limit.')
    const questions = input.questions.map((item) => {
      const question = store.questions.find((entry) => entry.id === Number(item.id) && entry.branch === branch)
      if (!question) fail('Questions must belong to the assessment branch.')
      if (Number(item.points) <= 0 || (input.timing_mode === 'PER_QUESTION' && Number(item.time_limit_seconds) < 1)) fail('Enter positive points and question time limits.')
      return { ...copy(question), points: Number(item.points), time_limit_seconds: Number(item.time_limit_seconds) || null, correct_option_ids: question.options.filter((option) => option.is_correct).map((option) => option.id) }
    })
    const assessment = { ...input, id: existing?.id ?? Math.max(0, ...store.assessments.map((item) => item.id)) + 1, branch, cohort: cohort?.id ?? null, curriculum_topic: curriculum ? input.curriculum_topic : null, status: 'DRAFT', results_released: false, questions, duration_seconds: Number(input.duration_seconds) || null, attempt_limit: Number(input.attempt_limit) }
    if (existing) Object.assign(existing, assessment)
    else store.assessments.push(assessment)
    persist()
    return getSnapshot()
  },

  async publishAssessment(id, actor) {
    await delay()
    const assessment = store.assessments.find((item) => item.id === id)
    if (!assessment || !authorCanAccess(assessment, actor) || assessment.status !== 'DRAFT') fail('Draft assessment not found.')
    if (!assessment.questions.length) fail('Add at least one question before publishing.')
    assessment.questions = assessment.questions.map((item) => {
      const question = store.questions.find((entry) => entry.id === item.id)
      return { ...copy(question), points: item.points, time_limit_seconds: item.time_limit_seconds, correct_option_ids: question.options.filter((option) => option.is_correct).map((option) => option.id) }
    })
    assessment.status = 'PUBLISHED'
    persist()
    return getSnapshot()
  },

  async cloneAssessment(id, actor) {
    await delay()
    const assessment = store.assessments.find((item) => item.id === id)
    if (!assessment || !authorCanAccess(assessment, actor) || assessment.status !== 'PUBLISHED') fail('Published assessment not found.')
    store.assessments.push({ ...copy(assessment), id: Math.max(0, ...store.assessments.map((item) => item.id)) + 1, title: `${assessment.title} (new version)`, status: 'DRAFT', results_released: false })
    persist()
    return getSnapshot()
  },

  async releaseAssessment(id, actor) {
    await delay()
    const assessment = store.assessments.find((item) => item.id === id)
    if (!assessment || !authorCanAccess(assessment, actor) || assessment.status !== 'PUBLISHED') fail('Assessment not found.')
    const attempts = store.attempts.filter((attempt) => attempt.assessment === id)
    attempts.forEach(expireAttempt)
    if (!attempts.some((attempt) => attempt.status !== 'IN_PROGRESS') || attempts.some((attempt) => attempt.status === 'IN_PROGRESS')) fail('All attempts must be submitted before releasing results.')
    assessment.results_released = true
    persist()
    return getSnapshot()
  },

  async startAssessment(id, actor) {
    await delay()
    const assessment = store.assessments.find((item) => item.id === id)
    if (actor.application_role !== 'STUDENT' || !assessment || !studentCanAccess(assessment, actor)) fail('Assessment not available.')
    const attempts = store.attempts.filter((attempt) => attempt.assessment === id && attempt.student === actor.id)
    attempts.forEach(expireAttempt)
    if (assessment.results_released || (assessment.deadline_at && Date.now() >= Date.parse(assessment.deadline_at)) || attempts.length >= assessment.attempt_limit || attempts.some((attempt) => attempt.status === 'IN_PROGRESS')) fail('No further attempts are available.')
    const now = Date.now()
    const wholeDeadline = assessment.timing_mode === 'WHOLE' ? now + assessment.duration_seconds * 1000 : Infinity
    const deadline = Math.min(wholeDeadline, assessment.deadline_at ? Date.parse(assessment.deadline_at) : Infinity)
    store.attempts.push({ id: Math.max(0, ...store.attempts.map((item) => item.id)) + 1, assessment: id, student: actor.id, attempt_number: attempts.length + 1, status: 'IN_PROGRESS', current_question: 0, answers: {}, started_at: new Date(now).toISOString(), deadline_at: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null, question_deadline_at: assessment.timing_mode === 'PER_QUESTION' ? new Date(now + assessment.questions[0].time_limit_seconds * 1000).toISOString() : null, score: null, max_score: null })
    persist()
    return getSnapshot()
  },

  async answerAssessment(id, questionId, selected, action, actor) {
    await delay()
    const attempt = store.attempts.find((item) => item.id === id && item.student === actor.id)
    if (!attempt) fail('Attempt not found.')
    const assessment = store.assessments.find((item) => item.id === attempt.assessment)
    expireAttempt(attempt)
    if (attempt.status !== 'IN_PROGRESS' || assessment.questions[attempt.current_question]?.id !== questionId) {
      persist()
      return getSnapshot()
    }
    attempt.answers[questionId] = selected
    if (action === 'submit' || (action === 'next' && attempt.current_question === assessment.questions.length - 1)) gradeAttempt(attempt, assessment, 'SUBMITTED')
    else if (action === 'next') {
      attempt.current_question += 1
      if (assessment.timing_mode === 'PER_QUESTION') attempt.question_deadline_at = new Date(Date.now() + assessment.questions[attempt.current_question].time_limit_seconds * 1000).toISOString()
    }
    persist()
    return getSnapshot()
  },
  async snapshot() {
    await delay()
    return getSnapshot()
  },

  async signIn(userId) {
    await delay()
    const user = getUser(userId)
    if (!user || !user.is_active) fail('That demo account is unavailable.')
    store.currentUserId = user.id
    persist()
    return getSnapshot()
  },

  async signOut() {
    await delay()
    store.currentUserId = null
    persist()
    return getSnapshot()
  },

  async resetDemo() {
    await delay()
    store = structuredClone(seed)
    persist()
    return getSnapshot()
  },

  async saveBranch(input) {
    await delay()
    const name = input.name.trim()
    if (!name) fail('Enter a branch name.', 'name')
    const timezone = input.timezone?.trim() || 'Africa/Accra'
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone })
    } catch {
      fail('Enter a valid IANA timezone, such as Africa/Accra.', 'timezone')
    }
    const duplicate = store.branches.some(
      (branch) => branch.id !== input.id && branch.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) fail('A branch with this name already exists.', 'name')

    if (input.id) {
      Object.assign(getBranch(input.id), { name, location: input.location.trim(), timezone, is_active: input.is_active })
    } else {
      store.branches.push({
        id: Math.max(0, ...store.branches.map((branch) => branch.id)) + 1,
        name,
        location: input.location.trim(),
        timezone,
        is_active: true,
      })
    }
    persist()
    return getSnapshot()
  },

  async saveCurriculum(input, actor) {
    await delay()
    const name = input.name.trim()
    if (!name) fail('Enter a curriculum name.', 'name')
    const current = input.id
      ? store.curricula.find((curriculum) => curriculum.id === input.id)
      : null
    if (input.id && !current) fail('That curriculum no longer exists.')
    const branchId = actor.application_role === 'BRANCH_ADMIN'
      ? actor.branch
      : Number(input.branch ?? current?.branch)
    const branch = getBranch(branchId)
    if (!branch?.is_active) fail('Choose an active branch.', 'branch')
    if (input.id) {
      if (current.branch !== branchId) fail('A curriculum cannot be moved to another branch.', 'branch')
    }
    const duplicate = store.curricula.some(
      (curriculum) => curriculum.id !== input.id && curriculum.branch === branchId && curriculum.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) fail('A curriculum with this name already exists in this branch.', 'name')

    if (input.id) {
      Object.assign(store.curricula.find((curriculum) => curriculum.id === input.id), {
        name,
        description: input.description.trim(),
        is_active: input.is_active,
      })
    } else {
      const curriculum = {
        id: Math.max(0, ...store.curricula.map((item) => item.id)) + 1,
        branch: branchId,
        name,
        description: input.description.trim(),
        is_active: true,
      }
      store.curricula.push(curriculum)
      store.curriculumVersions.push({
        id: Math.max(0, ...store.curriculumVersions.map((version) => version.id)) + 1,
        curriculum: curriculum.id,
        version_number: 1,
        status: 'DRAFT',
        change_note: 'Initial version',
        published_at: null,
        topics: [],
      })
    }
    persist()
    return getSnapshot()
  },

  async createCurriculumVersion(curriculumId, changeNote = 'Updated curriculum', actor) {
    await delay()
    const curriculum = getCurriculum(curriculumId, actor)
    const versions = store.curriculumVersions.filter((version) => version.curriculum === curriculum.id)
    if (versions.some((version) => version.status === 'DRAFT')) {
      fail('Finish or publish the current draft before creating another version.')
    }
    const previous = versions.toSorted((left, right) => right.version_number - left.version_number)[0]
    const nextVersion = {
      id: Math.max(0, ...store.curriculumVersions.map((version) => version.id)) + 1,
      curriculum: curriculum.id,
      version_number: previous ? previous.version_number + 1 : 1,
      status: 'DRAFT',
      change_note: changeNote.trim() || 'Updated curriculum',
      published_at: null,
      topics: previous ? copy(previous.topics) : [],
    }
    store.curriculumVersions.push(nextVersion)
    persist()
    return getSnapshot()
  },

  async saveCurriculumVersion(curriculumId, versionId, input, actor) {
    await delay()
    getCurriculum(curriculumId, actor)
    const version = store.curriculumVersions.find(
      (item) => item.id === Number(versionId) && item.curriculum === Number(curriculumId),
    )
    if (!version) fail('That curriculum version no longer exists.')
    if (version.status !== 'DRAFT') fail('Published curriculum versions are immutable. Create a new draft version to edit.')
    const topics = copy(input.topics ?? version.topics)
    for (const [topicIndex, topic] of topics.entries()) {
      if (!topic.title.trim()) fail(`Topic ${topicIndex + 1} needs a title.`, `topic-${topicIndex}`)
      for (const [lessonIndex, lesson] of (topic.lessons ?? []).entries()) {
        if (!lesson.title.trim()) fail(`Lesson ${lessonIndex + 1} needs a title.`, `lesson-${topicIndex}-${lessonIndex}`)
        for (const material of lesson.materials ?? []) {
          try {
            const parsed = new URL(material.url)
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL protocol')
          } catch {
            fail(`Check the material link “${material.title || 'Untitled'}”.`, 'materials')
          }
        }
      }
    }
    version.change_note = input.change_note?.trim() ?? version.change_note
    version.topics = topics.map((topic, topicIndex) => ({
      ...topic,
      id: topic.id ?? `draft-${version.id}-topic-${topicIndex}`,
      position: topicIndex,
      objectives: (topic.objectives ?? []).map((objective, objectiveIndex) => ({
        ...objective,
        id: objective.id ?? `draft-${version.id}-topic-${topicIndex}-objective-${objectiveIndex}`,
        position: objectiveIndex,
      })),
      lessons: (topic.lessons ?? []).map((lesson, lessonIndex) => ({
        ...lesson,
        id: lesson.id ?? `draft-${version.id}-topic-${topicIndex}-lesson-${lessonIndex}`,
        position: lessonIndex,
        materials: (lesson.materials ?? []).map((material, materialIndex) => ({
          ...material,
          id: material.id ?? `draft-${version.id}-topic-${topicIndex}-lesson-${lessonIndex}-material-${materialIndex}`,
          position: materialIndex,
        })),
      })),
    }))
    persist()
    return getSnapshot()
  },

  async publishCurriculumVersion(curriculumId, versionId, actor) {
    await delay()
    getCurriculum(curriculumId, actor)
    const version = store.curriculumVersions.find(
      (item) => item.id === Number(versionId) && item.curriculum === Number(curriculumId),
    )
    if (!version) fail('That curriculum version no longer exists.')
    if (version.status !== 'DRAFT') fail('Only draft versions can be published.')
    if (!version.topics.length) fail('Add at least one topic before publishing this curriculum.', 'topics')
    version.status = 'PUBLISHED'
    version.published_at = new Date().toISOString()
    persist()
    return getSnapshot()
  },

  async saveUser(input, actor) {
    await delay()
    const username = input.username.trim()
    if (!username) fail('Enter a username.', 'username')
    if (store.users.some((user) => user.id !== input.id && user.username.toLowerCase() === username.toLowerCase())) {
      fail('A user with this username already exists.', 'username')
    }
    const email = input.email.trim().toLowerCase()
    if (email && store.users.some((user) => user.id !== input.id && user.email.toLowerCase() === email)) {
      fail('A user with this email already exists.', 'email')
    }

    if (input.id) {
      const current = getUser(input.id)
      if (!current) fail('That account no longer exists.')
      if (current.application_role === 'STUDENT' && input.application_role === 'INSTRUCTOR') {
        fail('Existing Students cannot be promoted to Instructors.', 'application_role')
      }
      if (actor.application_role !== 'SUPER_ADMIN') {
        if (input.branch !== current.branch || input.application_role !== current.application_role) {
          fail('Only Super Admins can change a user role or branch.', 'application_role')
        }
      }
      const next = { ...current, ...input, username }
      if (next.application_role !== 'SUPER_ADMIN' && !getBranch(next.branch)?.is_active && next.is_active) {
        fail('Choose an active branch for an active account.', 'branch')
      }
      Object.assign(current, { ...next, email })
    } else {
      if (actor.application_role === 'BRANCH_ADMIN' && input.application_role === 'BRANCH_ADMIN') {
        fail('Branch Admins cannot create other Branch Admins.', 'application_role')
      }
      const branchId = actor.application_role === 'BRANCH_ADMIN' ? actor.branch : Number(input.branch)
      const role = actor.application_role === 'BRANCH_ADMIN' ? input.application_role : input.application_role || 'STUDENT'
      if (!getBranch(branchId)?.is_active) fail('Select an active branch.', 'branch')
      if (role === 'SUPER_ADMIN') fail('Super Admin accounts cannot be created here.', 'application_role')
      store.users.push({
        id: Math.max(0, ...store.users.map((user) => user.id)) + 1,
        username,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email,
        application_role: role,
        branch: branchId,
        is_active: true,
      })
    }
    persist()
    return getSnapshot()
  },

  async saveCohort(input, actor) {
    await delay()
    const current = store.cohorts.find((cohort) => cohort.id === input.id)
    const branchId = actor.application_role === 'BRANCH_ADMIN'
      ? actor.branch
      : Number(input.branch ?? current?.branch)
    const branch = getBranch(branchId)
    if (!branch?.is_active) fail('Choose an active branch.', 'branch')
    if (current && current.branch !== branchId) fail('A cohort cannot be moved to another branch.', 'branch')

    const next = {
      ...(current ?? {}),
      ...input,
      branch: branchId,
      name: (input.name ?? current?.name ?? '').trim(),
      description: (input.description ?? current?.description ?? '').trim(),
      start_date: input.start_date ?? current?.start_date ?? '',
      end_date: input.end_date ?? current?.end_date ?? '',
      instructor: input.instructor === undefined ? current?.instructor ?? null : Number(input.instructor) || null,
      curriculum_version: input.curriculum_version === undefined
        ? current?.curriculum_version ?? null
        : Number(input.curriculum_version) || null,
      curriculum_snapshot: current?.curriculum_snapshot ?? null,
      students: input.students ?? current?.students ?? [],
      status: input.status ?? current?.status ?? 'DRAFT',
      updated_at: new Date().toISOString(),
    }

    if (next.start_date && next.end_date && next.end_date < next.start_date) {
      fail('The end date must be on or after the start date.', 'end_date')
    }
    const duplicate = store.cohorts.some(
      (cohort) => cohort.id !== next.id && cohort.branch === branchId && cohort.name && cohort.name.toLowerCase() === next.name.toLowerCase(),
    )
    if (next.name && duplicate) fail('A cohort with this name already exists in this branch.', 'name')

    if (next.instructor) {
      const instructor = getUser(next.instructor)
      if (instructor?.application_role !== 'INSTRUCTOR' || instructor.branch !== branchId || !instructor.is_active) {
        fail('Choose an active Instructor from this branch.', 'instructor')
      }
    }
    const curriculumVersion = store.curriculumVersions.find((version) => version.id === next.curriculum_version)
    if (next.curriculum_version) {
      const curriculum = store.curricula.find((item) => item.id === curriculumVersion?.curriculum)
      if (!curriculumVersion || curriculumVersion.status !== 'PUBLISHED' || curriculum?.branch !== branchId) {
        fail('Choose a published curriculum version from this branch.', 'curriculum_version')
      }
    }
    if (current?.curriculum_snapshot && next.curriculum_version !== current.curriculum_version) {
      fail('A cohort curriculum cannot change after its Ready snapshot is created.', 'curriculum_version')
    }
    const studentIds = [...new Set(next.students.map(Number))]
    for (const studentId of studentIds) {
      const student = getUser(studentId)
      if (student?.application_role !== 'STUDENT' || student.branch !== branchId) {
        fail('Only Students from this branch can be enrolled.', 'students')
      }
    }
    next.students = studentIds
    next.enrollment_dates = Object.fromEntries(studentIds.flatMap((studentId) => {
      const previousDate = current?.enrollment_dates?.[studentId]
      if (previousDate) return [[studentId, previousDate]]
      return current?.students.includes(studentId) ? [] : [[studentId, enrollmentDate(branchId)]]
    }))

    if (next.status === 'READY') {
      if (!next.name) fail('A cohort name is required before it can be marked Ready.', 'name')
      if (!next.description) fail('A description is required before it can be marked Ready.', 'description')
      if (!next.start_date) fail('A start date is required before it can be marked Ready.', 'start_date')
      if (!next.end_date) fail('An end date is required before it can be marked Ready.', 'end_date')
      if (!next.instructor) fail('Assign an Instructor before marking the cohort Ready.', 'instructor')
      if (!next.curriculum_version) fail('Select a published curriculum before marking the cohort Ready.', 'curriculum_version')
      if (!next.students.length) fail('Enroll at least one Student before marking the cohort Ready.', 'students')
      if (!next.curriculum_snapshot) {
        next.curriculum_snapshot = makeCurriculumSnapshot(curriculumVersion)
        next.curriculum_snapshot_at = new Date().toISOString()
      }
    }

    if (current?.curriculum_snapshot && next.curriculum_version !== current.curriculum_version) {
      fail('A cohort curriculum cannot change after its Ready snapshot is created.', 'curriculum_version')
    }
    if (current?.curriculum_snapshot) {
      next.curriculum_snapshot = current.curriculum_snapshot
      next.curriculum_snapshot_at = current.curriculum_snapshot_at
    }

    if (current) Object.assign(current, next)
    else {
      next.id = Math.max(0, ...store.cohorts.map((cohort) => cohort.id)) + 1
      store.cohorts.push(next)
    }
    persist()
    return getSnapshot()
  },

  async addStudent(cohortId, studentId, actor) {
    await delay()
    const cohort = store.cohorts.find((item) => item.id === Number(cohortId))
    if (!cohort) fail('That cohort no longer exists.')
    if (actor.application_role === 'BRANCH_ADMIN' && cohort.branch !== actor.branch) {
      fail('You can only manage cohorts in your assigned branch.')
    }
    const student = getUser(studentId)
    if (student?.application_role !== 'STUDENT' || student.branch !== cohort.branch) {
      fail('Choose an existing Student from this branch.', 'students')
    }
    if (!cohort.students.includes(student.id)) {
      cohort.students.push(student.id)
      cohort.enrollment_dates = { ...cohort.enrollment_dates, [student.id]: enrollmentDate(cohort.branch) }
    }
    persist()
    return getSnapshot()
  },

  async removeStudent(cohortId, studentId, actor) {
    await delay()
    const cohort = store.cohorts.find((item) => item.id === Number(cohortId))
    if (!cohort) fail('That cohort no longer exists.')
    if (actor.application_role === 'BRANCH_ADMIN' && cohort.branch !== actor.branch) {
      fail('You can only manage cohorts in your assigned branch.')
    }
    if (cohort.status === 'READY' && cohort.students.length <= 1) {
      fail('A Ready cohort must keep at least one enrolled Student.')
    }
    cohort.students = cohort.students.filter((id) => id !== Number(studentId))
    if (cohort.enrollment_dates) delete cohort.enrollment_dates[studentId]
    persist()
    return getSnapshot()
  },

  async saveSession(input, actor) {
    await delay()
    const cohort = store.cohorts.find((item) => item.id === Number(input.cohort ?? input.cohortId))
    if (!cohort) fail('That cohort no longer exists.')
    if (actor.application_role === 'BRANCH_ADMIN' && cohort.branch !== actor.branch) {
      fail('You can only manage sessions in your assigned branch.')
    }
    if (actor.application_role === 'INSTRUCTOR' && cohort.instructor !== actor.id) {
      fail('You can only manage sessions for your assigned cohorts.')
    }
    if (!['SUPER_ADMIN', 'BRANCH_ADMIN', 'INSTRUCTOR'].includes(actor.application_role)) {
      fail('You are not allowed to manage sessions.')
    }
    if (!input.title.trim()) fail('Enter a session title.', 'title')
    if (input.start_time >= input.end_time) fail('The end time must be after the start time.', 'end_time')
    if (cohort.start_date && input.date < cohort.start_date) fail('A session cannot be before the cohort start date.', 'date')
    if (cohort.end_date && input.date > cohort.end_date) fail('A session cannot be after the cohort end date.', 'date')

    const existing = input.id ? store.sessions.find((session) => session.id === Number(input.id)) : null
    if (input.id && (!existing || existing.cohort !== cohort.id)) fail('That session no longer exists.')
    if (existing?.status === 'CANCELLED' && input.status !== 'CANCELLED') {
      fail('Cancelled sessions cannot be reopened in this workflow.', 'status')
    }
    const next = {
      ...(existing ?? {}),
      id: existing?.id ?? Math.max(0, ...store.sessions.map((session) => session.id)) + 1,
      cohort: cohort.id,
      title: input.title.trim(),
      description: input.description.trim(),
      date: input.date,
      start_time: input.start_time,
      end_time: input.end_time,
      status: input.status ?? existing?.status ?? 'SCHEDULED',
      created_by: existing?.created_by ?? actor.id,
    }
    if (existing) Object.assign(existing, next)
    else store.sessions.push(next)
    persist()
    return getSnapshot()
  },

  async setAttendance(sessionId, studentId, input, actor) {
    await delay()
    const session = store.sessions.find((item) => item.id === Number(sessionId))
    if (!session) fail('That session no longer exists.')
    const cohort = store.cohorts.find((item) => item.id === session.cohort)
    if (actor.application_role === 'BRANCH_ADMIN' && cohort.branch !== actor.branch) {
      fail('You can only manage attendance in your assigned branch.')
    }
    if (actor.application_role === 'INSTRUCTOR' && cohort.instructor !== actor.id) {
      fail('You can only manage attendance for your assigned cohorts.')
    }
    if (session.status === 'CANCELLED') fail('Attendance is locked for cancelled sessions.')
    const student = getUser(studentId)
    if (!cohort.students.includes(student?.id)) fail('Only students enrolled in this cohort can have attendance records.')
    const status = input.status
    if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) fail('Choose an attendance status.', 'status')
    const existing = store.attendance.find((record) => record.session === session.id && record.student === student.id)
    if (existing) Object.assign(existing, { status, note: input.note?.trim() ?? '' })
    else store.attendance.push({
      id: Math.max(0, ...store.attendance.map((record) => record.id)) + 1,
      session: session.id,
      student: student.id,
      status,
      note: input.note?.trim() ?? '',
    })
    persist()
    return getSnapshot()
  },
}