import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Plus, Trash2 } from "lucide-react";

const inputClass =
  "mt-1 min-h-10 w-full border border-hub-line bg-white px-3 text-sm text-hub-ink";
const primaryClass =
  "inline-flex min-h-10 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:opacity-50";
const secondaryClass =
  "inline-flex min-h-10 items-center justify-center gap-2 border border-hub-line bg-white px-4 text-sm font-semibold hover:bg-[#f5f3f6] disabled:opacity-50";

function Field({ label, children }) {
  return (
    <label className="block text-xs font-semibold text-hub-muted">
      {label}
      {children}
    </label>
  );
}

function ErrorMessage({ message }) {
  return message ? (
    <p
      role="alert"
      className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
    >
      {message}
    </p>
  ) : null;
}

export function AssessmentManager({ snapshot, user, busy, onAction }) {
  const [tab, setTab] = useState("assessments");
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [reviewId, setReviewId] = useState(null);
  const [error, setError] = useState("");
  const cohorts = snapshot.cohorts.filter(
    (cohort) =>
      user.application_role === "SUPER_ADMIN" ||
      (user.application_role === "INSTRUCTOR"
        ? cohort.instructor === user.id
        : cohort.branch === user.branch),
  );
  const questions = snapshot.questions.filter(
    (question) =>
      user.application_role === "SUPER_ADMIN" ||
      question.branch === user.branch,
  );
  const assessments = snapshot.assessments.filter(
    (assessment) =>
      user.application_role === "SUPER_ADMIN" ||
      (user.application_role === "INSTRUCTOR"
        ? cohorts.some((cohort) => cohort.id === assessment.cohort)
        : assessment.branch === user.branch),
  );
  const review = assessments.find((assessment) => assessment.id === reviewId);

  async function act(method, ...args) {
    setError("");
    try {
      await onAction(method, ...args);
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    }
  }

  if (editingQuestion)
    return (
      <QuestionEditor
        question={editingQuestion}
        branches={snapshot.branches}
        user={user}
        busy={busy}
        error={error}
        onCancel={() => {
          setEditingQuestion(null);
          setError("");
        }}
        onSave={async (value) => {
          if (await act("saveQuestion", value)) setEditingQuestion(null);
        }}
      />
    );
  if (editingAssessment)
    return (
      <AssessmentEditor
        assessment={editingAssessment}
        cohorts={cohorts}
        questions={questions}
        curricula={snapshot.curricula}
        versions={snapshot.curriculumVersions}
        user={user}
        busy={busy}
        error={error}
        onCancel={() => {
          setEditingAssessment(null);
          setError("");
        }}
        onSave={async (value) => {
          if (await act("saveAssessment", value)) setEditingAssessment(null);
        }}
      />
    );
  if (review) {
    const attempts = snapshot.attempts.filter(
      (attempt) => attempt.assessment === review.id,
    );
    return (
      <div className="space-y-5">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-hub-purple"
          onClick={() => {
            setReviewId(null);
            setError("");
          }}
        >
          <ArrowLeft size={16} />
          Assessments
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{review.title}</h1>
            <p className="mt-1 text-sm text-hub-muted">
              {review.results_released
                ? "Results released"
                : "Results awaiting release"}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || review.results_released}
            className={primaryClass}
            onClick={() => act("releaseAssessment", review.id)}
          >
            Release results
          </button>
        </div>
        <ErrorMessage message={error} />
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
          {attempts.length ? (
            attempts.map((attempt) => {
              const student = snapshot.users.find(
                (item) => item.id === attempt.student,
              );
              return (
                <details key={attempt.id} className="p-4 text-sm">
                  <summary className="flex cursor-pointer flex-wrap justify-between gap-3">
                    <span>
                      <span className="block font-semibold">
                        {student
                          ? `${student.first_name} ${student.last_name}`
                          : "Student"}
                      </span>
                      <span className="mt-1 block text-xs text-hub-muted">
                        Attempt {attempt.attempt_number} ·{" "}
                        {attempt.status.replaceAll("_", " ")}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {attempt.score == null
                        ? "In progress"
                        : `${attempt.score} / ${attempt.max_score}`}
                    </span>
                  </summary>
                  {attempt.status !== "IN_PROGRESS" &&
                    review.questions.map((question) => (
                      <div
                        key={question.id}
                        className="mt-4 border-t border-hub-line pt-3"
                      >
                        <p className="font-semibold">{question.prompt}</p>
                        <p className="mt-1">
                          Selected:{" "}
                          {question.options
                            .filter((option) =>
                              (attempt.answers[question.id] ?? []).includes(
                                option.id,
                              ),
                            )
                            .map((option) => option.text)
                            .join(", ") || "No answer"}
                        </p>
                        <p className="mt-1">
                          Correct:{" "}
                          {question.options
                            .filter((option) =>
                              question.correct_option_ids.includes(option.id),
                            )
                            .map((option) => option.text)
                            .join(", ")}
                        </p>
                      </div>
                    ))}
                </details>
              );
            })
          ) : (
            <p className="p-5 text-sm text-hub-muted">No attempts yet.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Assessments</h1>
          <p className="mt-1 text-sm text-hub-muted">
            Question bank, quizzes and examinations
          </p>
        </div>
        <button
          type="button"
          className={primaryClass}
          onClick={() => {
            setError("");
            tab === "questions"
              ? setEditingQuestion({})
              : setEditingAssessment({});
          }}
        >
          <Plus size={16} />
          {tab === "questions" ? "New question" : "New assessment"}
        </button>
      </div>
      <div className="flex gap-5 border-b border-hub-line">
        <button
          type="button"
          onClick={() => setTab("assessments")}
          className={`border-b-2 pb-3 text-sm font-semibold ${tab === "assessments" ? "border-hub-purple text-hub-purple" : "border-transparent text-hub-muted"}`}
        >
          Assessments
        </button>
        <button
          type="button"
          onClick={() => setTab("questions")}
          className={`border-b-2 pb-3 text-sm font-semibold ${tab === "questions" ? "border-hub-purple text-hub-purple" : "border-transparent text-hub-muted"}`}
        >
          Question bank
        </button>
      </div>
      <ErrorMessage message={error} />
      {tab === "questions" ? (
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
          {questions.length ? (
            questions.map((question) => (
              <div
                key={question.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{question.prompt}</p>
                  <p className="mt-1 text-xs text-hub-muted">
                    {question.question_type === "SINGLE"
                      ? "Single answer"
                      : "Multiple answers"}{" "}
                    · {question.options.length} options
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => setEditingQuestion(question)}
                >
                  Edit
                </button>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm text-hub-muted">
              No questions in this branch yet.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
          {assessments.length ? (
            assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{assessment.title}</p>
                  <p className="mt-1 text-xs text-hub-muted">
                    {cohorts.find((cohort) => cohort.id === assessment.cohort)
                      ?.name ?? "Curriculum topic"}{" "}
                    ·{" "}
                    {assessment.assessment_type === "EXAM"
                      ? "Examination"
                      : "Quiz"}{" "}
                    · {assessment.status === "DRAFT" ? "Draft" : "Published"} ·{" "}
                    {assessment.questions.length} questions
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {assessment.status === "DRAFT" ? (
                    <>
                      <button
                        type="button"
                        className={secondaryClass}
                        onClick={() => setEditingAssessment(assessment)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className={primaryClass}
                        onClick={() => act("publishAssessment", assessment.id)}
                      >
                        Publish
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={secondaryClass}
                        onClick={() => setReviewId(assessment.id)}
                      >
                        Review results
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className={secondaryClass}
                        onClick={() => act("cloneAssessment", assessment.id)}
                      >
                        New version
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm text-hub-muted">No assessments yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  branches,
  user,
  busy,
  error,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState({
    branch: user.branch ?? branches[0]?.id ?? "",
    question_type: "SINGLE",
    prompt: "",
    explanation: "",
    options: [
      { text: "", is_correct: false },
      { text: "", is_correct: false },
    ],
    ...question,
  });
  function updateOption(index, values) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, position) =>
        position === index
          ? { ...option, ...values }
          : values.is_correct && current.question_type === "SINGLE"
            ? { ...option, is_correct: false }
            : option,
      ),
    }));
  }
  return (
    <form
      className="max-w-3xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-2 text-sm font-semibold text-hub-purple"
      >
        <ArrowLeft size={16} />
        Question bank
      </button>
      <h1 className="text-2xl font-semibold">
        {question.id ? "Edit question" : "New question"}
      </h1>
      <ErrorMessage message={error} />
      <div className="space-y-4 border-y border-hub-line bg-white p-5">
        {user.application_role === "SUPER_ADMIN" && (
          <Field label="Branch">
            <select
              className={inputClass}
              value={form.branch}
              disabled={Boolean(question.id)}
              onChange={(event) =>
                setForm({ ...form, branch: Number(event.target.value) })
              }
            >
              {branches
                .filter((branch) => branch.is_active)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Question">
          <textarea
            required
            className={`${inputClass} py-2`}
            rows="3"
            value={form.prompt}
            onChange={(event) =>
              setForm({ ...form, prompt: event.target.value })
            }
          />
        </Field>
        <Field label="Answer type">
          <select
            className={inputClass}
            value={form.question_type}
            onChange={(event) =>
              setForm({
                ...form,
                question_type: event.target.value,
                options: form.options.map((option) => ({
                  ...option,
                  is_correct: false,
                })),
              })
            }
          >
            <option value="SINGLE">Single answer</option>
            <option value="MULTIPLE">Multiple answers</option>
          </select>
        </Field>
        <fieldset>
          <legend className="text-xs font-semibold text-hub-muted">
            Answer options and correct answers
          </legend>
          <div className="mt-2 space-y-2">
            {form.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  aria-label={`Correct option ${index + 1}`}
                  type={form.question_type === "SINGLE" ? "radio" : "checkbox"}
                  name={form.question_type === "SINGLE" ? "correct" : undefined}
                  checked={option.is_correct}
                  onChange={(event) =>
                    updateOption(index, { is_correct: event.target.checked })
                  }
                />
                <input
                  required
                  aria-label={`Option ${index + 1}`}
                  className={inputClass}
                  value={option.text}
                  onChange={(event) =>
                    updateOption(index, { text: event.target.value })
                  }
                />
                <button
                  type="button"
                  title="Remove option"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={form.options.length <= 2}
                  onClick={() =>
                    setForm({
                      ...form,
                      options: form.options.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                  className="grid size-10 shrink-0 place-items-center text-hub-muted disabled:opacity-30"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-hub-purple"
            onClick={() =>
              setForm({
                ...form,
                options: [...form.options, { text: "", is_correct: false }],
              })
            }
          >
            + Add option
          </button>
        </fieldset>
        <Field label="Explanation (optional)">
          <textarea
            className={`${inputClass} py-2`}
            rows="2"
            value={form.explanation}
            onChange={(event) =>
              setForm({ ...form, explanation: event.target.value })
            }
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <button className={primaryClass} disabled={busy}>
          Save question
        </button>
        <button type="button" className={secondaryClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AssessmentEditor({
  assessment,
  cohorts,
  questions,
  curricula,
  versions,
  user,
  busy,
  error,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    cohort: cohorts[0]?.id ?? "",
    curriculum_topic: null,
    assessment_type: "QUIZ",
    timing_mode: "WHOLE",
    duration_seconds: 600,
    attempt_limit: 1,
    deadline_at: "",
    questions: [],
    ...assessment,
  });
  const [association, setAssociation] = useState(
    assessment.curriculum_topic ? "topic" : "cohort",
  );
  const topics = versions.flatMap((version) => {
    const curriculum = curricula.find((item) => item.id === version.curriculum);
    if (
      !curriculum ||
      (user.application_role !== "SUPER_ADMIN" &&
        curriculum.branch !== user.branch) ||
      version.status !== "PUBLISHED"
    )
      return [];
    return version.topics.map((topic) => ({
      ...topic,
      branch: curriculum.branch,
      label: `${curriculum.name} v${version.version_number} / ${topic.title}`,
    }));
  });
  const branch = association === "topic"
    ? topics.find((topic) => String(topic.id) === String(form.curriculum_topic))
        ?.branch
    : cohorts.find((cohort) => cohort.id === Number(form.cohort))?.branch;
  const available = questions.filter((question) => question.branch === branch);
  function updateQuestion(id, values) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === id ? { ...question, ...values } : question,
      ),
    }));
  }
  return (
    <form
      className="max-w-3xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-2 text-sm font-semibold text-hub-purple"
      >
        <ArrowLeft size={16} />
        Assessments
      </button>
      <h1 className="text-2xl font-semibold">
        {assessment.id ? "Edit draft" : "New assessment"}
      </h1>
      <ErrorMessage message={error} />
      <div className="space-y-4 border-y border-hub-line bg-white p-5">
        <Field label="Title">
          <input
            required
            className={inputClass}
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </Field>
        <Field label="Description">
          <textarea
            className={`${inputClass} py-2`}
            rows="2"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {user.application_role !== "INSTRUCTOR" && (
            <Field label="Assign to">
              <select
                className={inputClass}
                value={association}
                onChange={(event) => {
                  setAssociation(event.target.value);
                  setForm({ ...form, cohort: "", curriculum_topic: null, questions: [] });
                }}
              >
                <option value="cohort">Cohort</option>
                <option value="topic">Curriculum topic</option>
              </select>
            </Field>
          )}
          {association === "cohort" ? <Field label="Cohort">
            <select
              required
              className={inputClass}
              value={form.cohort ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  cohort: Number(event.target.value),
                  curriculum_topic: null,
                  questions: [],
                })
              }
            >
              <option value="">Choose a cohort</option>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </option>
              ))}
            </select>
          </Field> : <Field label="Curriculum topic">
            <select
              required
              className={inputClass}
              value={form.curriculum_topic ?? ""}
              onChange={(event) => setForm({ ...form, cohort: null, curriculum_topic: event.target.value, questions: [] })}
            >
              <option value="">Choose a curriculum topic</option>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
            </select>
          </Field>}
          <Field label="Type">
            <select
              className={inputClass}
              value={form.assessment_type}
              onChange={(event) =>
                setForm({ ...form, assessment_type: event.target.value })
              }
            >
              <option value="QUIZ">Quiz</option>
              <option value="EXAM">Examination</option>
            </select>
          </Field>
          <Field label="Timing">
            <select
              className={inputClass}
              value={form.timing_mode}
              onChange={(event) =>
                setForm({ ...form, timing_mode: event.target.value })
              }
            >
              <option value="WHOLE">Whole assessment</option>
              <option value="PER_QUESTION">Per question</option>
            </select>
          </Field>
          {form.timing_mode === "WHOLE" && (
            <Field label="Time limit (seconds)">
              <input
                required
                type="number"
                min="1"
                className={inputClass}
                value={form.duration_seconds ?? ""}
                onChange={(event) =>
                  setForm({ ...form, duration_seconds: event.target.value })
                }
              />
            </Field>
          )}
          <Field label="Attempt limit">
            <input
              required
              type="number"
              min="1"
              className={inputClass}
              value={form.attempt_limit}
              onChange={(event) =>
                setForm({ ...form, attempt_limit: event.target.value })
              }
            />
          </Field>
          <Field label="Deadline (optional)">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.deadline_at ? form.deadline_at.slice(0, 16) : ""}
              onChange={(event) =>
                setForm({ ...form, deadline_at: event.target.value })
              }
            />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">Questions</legend>
          <div className="mt-2 divide-y divide-hub-line border-y border-hub-line">
            {available.length ? (
              available.map((question) => {
                const selected = form.questions.find(
                  (item) => item.id === question.id,
                );
                return (
                  <div key={question.id} className="py-3">
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            questions: event.target.checked
                              ? [
                                  ...form.questions,
                                  {
                                    ...question,
                                    points: 1,
                                    time_limit_seconds: 60,
                                  },
                                ]
                              : form.questions.filter(
                                  (item) => item.id !== question.id,
                                ),
                          })
                        }
                      />
                      <span>{question.prompt}</span>
                    </label>
                    {selected && (
                      <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-2">
                        <Field label="Points">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className={inputClass}
                            value={selected.points}
                            onChange={(event) =>
                              updateQuestion(question.id, {
                                points: event.target.value,
                              })
                            }
                          />
                        </Field>
                        {form.timing_mode === "PER_QUESTION" && (
                          <Field label="Time limit (seconds)">
                            <input
                              type="number"
                              min="1"
                              className={inputClass}
                              value={selected.time_limit_seconds ?? ""}
                              onChange={(event) =>
                                updateQuestion(question.id, {
                                  time_limit_seconds: event.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="py-4 text-sm text-hub-muted">
                No questions available for this branch.
              </p>
            )}
          </div>
        </fieldset>
      </div>
      <div className="flex gap-2">
        <button className={primaryClass} disabled={busy}>
          Save draft
        </button>
        <button type="button" className={secondaryClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function StudentAssessments({
  snapshot,
  user,
  busy,
  onAction,
  onRefresh,
}) {
  const [attemptId, setAttemptId] = useState(null);
  const [selections, setSelections] = useState({});
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const attempt = snapshot.attempts.find((item) => item.id === attemptId);
  const assessment = snapshot.assessments.find(
    (item) => item.id === attempt?.assessment,
  );
  const question = attempt?.status === "IN_PROGRESS" ? attempt.question : null;
  const selectionKey = `${attemptId}-${question?.id}`;
  const selected =
    selections[selectionKey] ??
    (question ? (attempt.answers[question.id] ?? []) : []);
  function setSelected(value) {
    setSelections((current) => ({ ...current, [selectionKey]: value }));
  }
  const inProgress = attempt?.status === "IN_PROGRESS";
  useEffect(() => {
    if (!inProgress) return undefined;
    let ticks = 0;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      ticks += 1;
      if (ticks % 5 === 0) onRefresh().catch((failure) => setError(failure.message));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inProgress, onRefresh]);
  async function act(method, ...args) {
    setError("");
    try {
      const data = await onAction(method, ...args);
      return data;
    } catch (failure) {
      setError(failure.message);
      return null;
    }
  }
  if (attempt && assessment) {
    const deadlines = [attempt.deadline_at, attempt.question_deadline_at]
      .filter(Boolean)
      .map((deadline) => Date.parse(deadline));
    const seconds = deadlines.length
      ? Math.max(0, Math.ceil((Math.min(...deadlines) - now) / 1000))
      : 0;
    return (
      <div className="max-w-3xl space-y-5">
        <button
          type="button"
          onClick={() => setAttemptId(null)}
          className="flex items-center gap-2 text-sm font-semibold text-hub-purple"
        >
          <ArrowLeft size={16} />
          My assessments
        </button>
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{assessment.title}</h1>
            <p className="mt-1 text-sm text-hub-muted">
              Attempt {attempt.attempt_number}
            </p>
          </div>
          {question && (
            <div className="text-right text-sm font-semibold tabular-nums">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}{" "}
              remaining
            </div>
          )}
        </div>
        <ErrorMessage message={error} />
        {question ? (
          <div className="space-y-5 border-y border-hub-line bg-white p-5">
            <p className="text-xs font-semibold text-hub-muted">
              Question {attempt.current_question + 1} of{" "}
              {attempt.question_count}
            </p>
            <h2 className="text-lg font-semibold">{question.prompt}</h2>
            <div className="space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex min-h-12 items-center gap-3 border border-hub-line px-3 text-sm"
                >
                  <input
                    type={
                      question.question_type === "SINGLE" ? "radio" : "checkbox"
                    }
                    name="answer"
                    checked={selected.includes(option.id)}
                    onChange={(event) =>
                      setSelected(
                        question.question_type === "SINGLE"
                          ? [option.id]
                          : event.target.checked
                            ? [...selected, option.id]
                            : selected.filter((id) => id !== option.id),
                      )
                    }
                  />
                  {option.text}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={primaryClass}
                onClick={() =>
                  act(
                    "answerAssessment",
                    attempt.id,
                    question.id,
                    selected,
                    "next",
                  )
                }
              >
                {attempt.current_question === attempt.question_count - 1
                  ? "Submit assessment"
                  : "Save and continue"}
              </button>
              <button
                type="button"
                disabled={busy}
                className={secondaryClass}
                onClick={() =>
                  act(
                    "answerAssessment",
                    attempt.id,
                    question.id,
                    selected,
                    "save",
                  )
                }
              >
                Save answer
              </button>
              <button
                type="button"
                disabled={busy}
                className={secondaryClass}
                onClick={() =>
                  act(
                    "answerAssessment",
                    attempt.id,
                    question.id,
                    selected,
                    "submit",
                  )
                }
              >
                Submit now
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 border-y border-hub-line bg-white p-5">
            <h2 className="text-lg font-semibold">
              {attempt.status === "TIMED_OUT"
                ? "Time expired"
                : "Assessment submitted"}
            </h2>
            <p className="text-sm">
              {assessment.results_released
                ? `Score: ${attempt.score} / ${attempt.max_score}`
                : "Your results are awaiting release."}
            </p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">My assessments</h1>
        <p className="mt-1 text-sm text-hub-muted">
          Quizzes and examinations for your cohorts
        </p>
      </div>
      <ErrorMessage message={error} />
      <div className="divide-y divide-hub-line border-y border-hub-line bg-white">
        {snapshot.assessments.length ? (
          snapshot.assessments.map((item) => {
            const attempts = snapshot.attempts.filter(
              (entry) =>
                entry.assessment === item.id && entry.student === user.id,
            );
            const active = attempts.find(
              (entry) => entry.status === "IN_PROGRESS",
            );
            const closed =
              item.results_released ||
              (item.deadline_at && now >= Date.parse(item.deadline_at)) ||
              attempts.length >= item.attempt_limit;
            return (
              <div
                key={item.id}
                className="flex flex-wrap justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-hub-muted">
                    {item.assessment_type === "EXAM" ? "Examination" : "Quiz"} ·{" "}
                    {item.question_count} questions · {attempts.length} of{" "}
                    {item.attempt_limit} attempts used
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {attempts
                      .filter((entry) => entry.status !== "IN_PROGRESS")
                      .map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setAttemptId(entry.id)}
                          className="text-xs font-semibold text-hub-purple underline"
                        >
                          Attempt {entry.attempt_number}
                          {item.results_released
                            ? `: ${entry.score} / ${entry.max_score}`
                            : ": awaiting results"}
                        </button>
                      ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || (!active && closed)}
                  className={primaryClass}
                  onClick={async () => {
                    if (active) setAttemptId(active.id);
                    else {
                      const data = await act("startAssessment", item.id);
                      const started = data?.attempts
                        .filter(
                          (entry) =>
                            entry.assessment === item.id &&
                            entry.student === user.id,
                        )
                        .at(-1);
                      if (started) setAttemptId(started.id);
                    }
                  }}
                >
                  <ClipboardList size={16} />
                  {active
                    ? "Continue"
                    : closed
                      ? "Unavailable"
                      : "Start attempt"}
                </button>
              </div>
            );
          })
        ) : (
          <p className="p-5 text-sm text-hub-muted">
            No assessments are available yet.
          </p>
        )}
      </div>
    </div>
  );
}
