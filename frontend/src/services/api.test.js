import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { api } from './api.js'

const originalFetch = globalThis.fetch
const originalDocument = globalThis.document

afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.document = originalDocument
})

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

test('sign in uses CSRF and loads only the student endpoints', async () => {
  const calls = []
  globalThis.document = { cookie: 'csrftoken=test-token' }
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options })
    if (path === '/api/health/') return json({ status: 'ok' })
    if (path === '/api/accounts/login/') return json({})
    if (path === '/api/accounts/me/') return json({ id: 7, username: 'student', application_role: 'STUDENT', branch: { id: 2, name: 'Branch' } })
    if (path === '/api/student/certificates/') return json([])
    if (path === '/api/student/assessments/') return json([{ id: 3, question_count: 1, attempt_details: [{ id: 4, assessment: 3, current_question_position: 0, current_question_deadline_at: null, status: 'IN_PROGRESS', question: { id: 9, question_type_snapshot: 'SINGLE', options: [] }, answers: [] }] }])
    throw new Error(`Unexpected request: ${path}`)
  }
  const result = await api.signIn({ username: 'student', password: 'password' })
  assert.equal(result.currentUser.branch, 2)
  assert.equal(result.attempts[0].student, 7)
  assert.equal(result.attempts[0].question.question_type, 'SINGLE')
  assert.equal(calls.find((call) => call.path === '/api/accounts/login/').headers['X-CSRFToken'], 'test-token')
  assert.equal(calls.some((call) => call.path === '/api/cohorts/'), false)
})

test('session creation omits an unset status and refreshes server data', async () => {
  let posted
  globalThis.document = { cookie: 'csrftoken=test-token' }
  globalThis.fetch = async (path, options) => {
    if (options.method === 'POST' && path === '/api/cohorts/1/sessions/') {
      posted = JSON.parse(options.body)
      return json({ id: 12 }, 201)
    }
    const responses = {
      '/api/accounts/me/': { id: 1, username: 'admin', application_role: 'SUPER_ADMIN', branch: null },
      '/api/accounts/users/': [], '/api/branches/': [], '/api/curricula/': [], '/api/assessments/': [],
      '/api/cohorts/': [{ id: 1, branch: 1, students: [] }],
      '/api/cohorts/1/sessions/': [], '/api/cohorts/1/graduation-requirements/': null,
      '/api/cohorts/1/results/': { cohort: { id: 1 }, requirements: null },
      '/api/cohorts/1/results/history/': [], '/api/cohorts/1/certificates/': [],
      '/api/cohorts/1/attendance-report/': { cohort: { id: 1 }, students: [] },
    }
    if (!(path in responses)) throw new Error(`Unexpected request: ${path}`)
    return json(responses[path])
  }
  const result = await api.saveSession({ cohort: 1, title: 'Meeting', status: null })
  assert.equal('status' in posted, false)
  assert.equal(result.attendanceReports[0].cohort.id, 1)
})