import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Bot,
  Briefcase,
  Database,
  Gauge,
  KeyRound,
  Radar,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Workflow,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TaskPayloadComposer, getVisibleTaskSections } from "./components/TaskPayloadComposer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { taskCatalog } from "./data/taskCatalog";
import { buildPayloadFromTaskForm, createTaskFormState, getTaskForm } from "./data/taskForms";
import { api } from "./lib/api";

const navItems = [
  { to: "/", label: "Operations", icon: Radar },
  { to: "/studio", label: "Task Studio", icon: Workflow },
  { to: "/access", label: "Access", icon: KeyRound },
];

const statusTone = {
  pending: "#f7b955",
  in_progress: "#ff7b6b",
  completed: "#4ad7a3",
  failed: "#f04f6e",
};

function findTaskTemplate(taskType) {
  return taskCatalog.find((item) => item.type === taskType) || taskCatalog[0];
}

function buildJobDraft(template = taskCatalog[0]) {
  const payloadForm = createTaskFormState(template.type);
  let payloadOverrideText = JSON.stringify(template.payload, null, 2);

  try {
    payloadOverrideText = JSON.stringify(buildPayloadFromTaskForm(template.type, payloadForm), null, 2);
  } catch {
    payloadOverrideText = JSON.stringify(template.payload, null, 2);
  }

  return {
    title: `${template.label} Mission`,
    description: template.blurb,
    task_type: template.type,
    payloadForm,
    payloadOverrideEnabled: false,
    payloadOverrideText,
    scheduled_at: "",
  };
}

function formatJson(value) {
  if (value == null) {
    return "None";
  }
  return JSON.stringify(value, null, 2);
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function getPayloadPreviewState(taskType, payloadForm, payloadOverrideEnabled, payloadOverrideText) {
  if (payloadOverrideEnabled) {
    try {
      const payload = payloadOverrideText ? JSON.parse(payloadOverrideText) : null;
      return {
        payload,
        text: formatJson(payload),
        error: "",
      };
    } catch {
      return {
        payload: null,
        text: payloadOverrideText,
        error: "Advanced payload must be valid JSON.",
      };
    }
  }

  try {
    const payload = buildPayloadFromTaskForm(taskType, payloadForm);
    return {
      payload,
      text: formatJson(payload),
      error: "",
    };
  } catch (error) {
    return {
      payload: null,
      text: "",
      error: error?.message || "Unable to generate payload.",
    };
  }
}

function App() {
  const location = useLocation();
  const queryClient = useQueryClient();

  const [activeUserId, setActiveUserId] = useState("1");
  const [jobSearch, setJobSearch] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState(taskCatalog[0].type);
  const [jobDraft, setJobDraft] = useState(() => buildJobDraft(taskCatalog[0]));
  const [composerError, setComposerError] = useState("");
  const [authState, setAuthState] = useState({
    login: { username: "", password: "" },
    register: { username: "", email: "", full_name: "", password: "" },
  });
  const [focusedJobId, setFocusedJobId] = useState(null);
  const deferredSearch = useDeferredValue(jobSearch);

  // Phase 1: Global Power-User Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search titles, task types, or statuses"]');
        if (searchInput) searchInput.focus();
      }
      if (e.key === 'Escape') {
        setFocusedJobId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 20_000,
    retry: false,
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs", activeUserId],
    queryFn: () => api.listJobs(activeUserId),
    enabled: Boolean(activeUserId),
    refetchInterval: 5_000,
    retry: false,
  });

  const focusedJobQuery = useQuery({
    queryKey: ["job", focusedJobId],
    queryFn: () => api.getJobInfo(focusedJobId),
    enabled: Boolean(focusedJobId),
    refetchInterval: 5_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: api.login,
  });

  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: (result) => {
      if (result?.user?.id) {
        setActiveUserId(String(result.user.id));
      }
    },
  });

  const createJobMutation = useMutation({
    mutationFn: api.createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", activeUserId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ jobId, status }) => api.updateJobStatus(jobId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", activeUserId] });
      queryClient.invalidateQueries({ queryKey: ["job", variables.jobId] });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: api.deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", activeUserId] });
      setFocusedJobId(null);
    },
  });

  const jobs = Array.isArray(jobsQuery.data) ? jobsQuery.data : [];
  const filteredJobs = jobs.filter((job) => {
    const haystack = `${job.title} ${job.description || ""} ${job.task_type} ${job.status}`.toLowerCase();
    return haystack.includes(deferredSearch.toLowerCase());
  });

  const statusCounts = [
    "pending",
    "in_progress",
    "completed",
    "failed",
  ].map((status) => ({
    name: status.replace("_", " "),
    value: jobs.filter((job) => job.status === status).length,
    fill: statusTone[status],
  }));

  const taskMix = taskCatalog
    .map((item) => ({
      name: item.label,
      total: jobs.filter((job) => job.task_type === item.type).length,
      fill: accentColor(item.accent),
    }))
    .filter((item) => item.total > 0)
    .slice(0, 8);

  const highlightedTemplate =
    taskCatalog.find((item) => item.type === selectedTaskType) || taskCatalog[0];
  const highlightedTaskForm = getTaskForm(selectedTaskType);
  const payloadPreview = getPayloadPreviewState(
    jobDraft.task_type,
    jobDraft.payloadForm,
    jobDraft.payloadOverrideEnabled,
    jobDraft.payloadOverrideText,
  );

  const recentActivity = [...jobs]
    .sort((left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at))
    .slice(0, 5);

  const queueMood = statusCounts.find((item) => item.name === "failed")?.value
    ? "Watch the queue"
    : statusCounts.find((item) => item.name === "in progress")?.value
      ? "Workers are flowing"
      : "Queue is calm";

  function handleTemplateChange(nextType) {
    const template = taskCatalog.find((item) => item.type === nextType) || taskCatalog[0];
    const payloadForm = createTaskFormState(template.type);
    let payloadOverrideText = JSON.stringify(template.payload, null, 2);

    try {
      payloadOverrideText = JSON.stringify(buildPayloadFromTaskForm(template.type, payloadForm), null, 2);
    } catch {
      payloadOverrideText = JSON.stringify(template.payload, null, 2);
    }

    setSelectedTaskType(template.type);

    startTransition(() => {
      setJobDraft((current) => ({
        ...current,
        title: `${template.label} Mission`,
        description: template.blurb,
        task_type: template.type,
        payloadForm,
        payloadOverrideEnabled: false,
        payloadOverrideText,
      }));
    });
  }

  function handlePayloadFieldChange(fieldName, value) {
    createJobMutation.reset();
    setComposerError("");
    setJobDraft((current) => ({
      ...current,
      payloadForm: {
        ...current.payloadForm,
        [fieldName]: value,
      },
    }));
  }

  function handlePayloadOverrideToggle() {
    createJobMutation.reset();
    setComposerError("");
    setJobDraft((current) => {
      const nextEnabled = !current.payloadOverrideEnabled;
      let nextOverrideText = current.payloadOverrideText;

      if (nextEnabled) {
        try {
          nextOverrideText = JSON.stringify(
            buildPayloadFromTaskForm(current.task_type, current.payloadForm),
            null,
            2,
          );
        } catch {
          nextOverrideText = current.payloadOverrideText;
        }
      }

      return {
        ...current,
        payloadOverrideEnabled: nextEnabled,
        payloadOverrideText: nextOverrideText,
      };
    });
  }

  function handleCreateJob(event) {
    event.preventDefault();
    const previewState = getPayloadPreviewState(
      jobDraft.task_type,
      jobDraft.payloadForm,
      jobDraft.payloadOverrideEnabled,
      jobDraft.payloadOverrideText,
    );

    if (previewState.error) {
      createJobMutation.reset();
      setComposerError(previewState.error);
      return;
    }

    setComposerError("");

    createJobMutation.mutate({
      title: jobDraft.title,
      description: jobDraft.description,
      status: "pending",
      user_id: Number(activeUserId),
      task_type: jobDraft.task_type,
      payload: previewState.payload,
      scheduled_at: jobDraft.scheduled_at || null,
    });
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <aside className="command-rail">
        <div className="brand-mark">
          <div className="brand-mark__glyph">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="eyebrow">Distributed Queue</p>
            <h1>PulseQueue</h1>
          </div>
        </div>

        <nav className="nav-stack">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-chip ${isActive ? "is-active" : ""}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="signal-card">
          <p className="eyebrow">Live Signal</p>
          <strong>{queueMood}</strong>
          <p>
            {jobs.length} tracked jobs, {statusCounts.find((item) => item.name === "completed")?.value || 0} already
            landed cleanly.
          </p>
        </div>

        <div className="signal-card signal-card--dense">
          <label className="field-label" htmlFor="active-user-id">
            Active User ID
          </label>
          <input
            id="active-user-id"
            className="text-input"
            value={activeUserId}
            onChange={(event) => setActiveUserId(event.target.value)}
            placeholder="1"
          />
        </div>
      </aside>

      <main className="main-stage">
        <header className="hero-banner">
          <div>
            <p className="eyebrow">Reactive Control Surface</p>
            <h2>Shape the queue, watch workers breathe, and launch task flows without leaving the room.</h2>
          </div>
          <div className="hero-actions">
            <a className="hero-link" href="/docs" target="_blank" rel="noreferrer">
              API Docs <ArrowRight size={16} />
            </a>
            <div className={`status-pill ${healthQuery.isSuccess ? "is-up" : "is-warm"}`}>
              <ShieldCheck size={16} />
              {healthQuery.isSuccess ? "Backend healthy" : "Checking API"}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            className="page-shell"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <Routes>
              <Route
                path="/"
                element={
                  <OperationsPage
                    jobs={jobs}
                    filteredJobs={filteredJobs}
                    jobSearch={jobSearch}
                    setJobSearch={setJobSearch}
                    statusCounts={statusCounts}
                    taskMix={taskMix}
                    recentActivity={recentActivity}
                    setFocusedJobId={setFocusedJobId}
                    focusedJob={focusedJobQuery.data}
                    updateStatusMutation={updateStatusMutation}
                    deleteJobMutation={deleteJobMutation}
                  />
                }
              />
              <Route
                path="/studio"
                element={
                  <StudioCatalogPage />
                }
              />
              <Route
                path="/studio/:taskType"
                element={
                  <TaskBuilderPage
                    activeUserId={activeUserId}
                    createJobMutation={createJobMutation}
                  />
                }
              />
              <Route
                path="/access"
                element={
                  <AccessPage
                    authState={authState}
                    setAuthState={setAuthState}
                    loginMutation={loginMutation}
                    registerMutation={registerMutation}
                    setActiveUserId={setActiveUserId}
                  />
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function OperationsPage({
  jobs,
  filteredJobs,
  jobSearch,
  setJobSearch,
  statusCounts,
  taskMix,
  recentActivity,
  setFocusedJobId,
  focusedJob,
  updateStatusMutation,
  deleteJobMutation,
}) {
  const completedCount = statusCounts.find((item) => item.name === "completed")?.value || 0;
  const failureCount = statusCounts.find((item) => item.name === "failed")?.value || 0;
  const inFlightCount = statusCounts.find((item) => item.name === "in progress")?.value || 0;

  return (
    <div className="page-grid">
      <section className="metrics-grid">
        <MetricCard icon={Gauge} tone="teal" label="Tracked Jobs" value={jobs.length} help="Live queue volume for the active user." />
        <MetricCard icon={BadgeCheck} tone="olive" label="Completed" value={completedCount} help="Jobs that made it through the pipeline." />
        <MetricCard icon={Briefcase} tone="coral" label="In Progress" value={inFlightCount} help="Workers currently pushing tasks forward." />
        <MetricCard icon={Activity} tone="amber" label="Failures" value={failureCount} help="Signals worth investigation before they cascade." />
      </section>

      <section className="panel panel--chart">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Queue Pulse</p>
            <h3>Status composition</h3>
          </div>
          <div className="panel__badge">polling every 5s</div>
        </div>
        <div className="chart-wrap chart-wrap--split">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusCounts} dataKey="value" nameKey="name" innerRadius={65} outerRadius={92} paddingAngle={4}>
                {statusCounts.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(12, 24, 43, 0.95)', 
                  borderColor: 'rgba(171, 196, 255, 0.1)', 
                  borderRadius: '16px',
                  color: '#f5f7ff',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(16px)'
                }}
                itemStyle={{ color: '#7fd9ff', fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="legend-stack">
            {statusCounts.map((item) => (
              <div key={item.name} className="legend-row">
                <span className="legend-dot" style={{ background: item.fill }} />
                <span>{item.name}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel panel--chart">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Task Mix</p>
            <h3>Where your queue energy is going</h3>
          </div>
          <div className="panel__badge">top active task types</div>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={taskMix.length ? taskMix : [{ name: "No jobs yet", total: 0, fill: "#5e6a8f" }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#9fb0d8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9fb0d8" allowDecimals={false} />
              <Tooltip 
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
                contentStyle={{ 
                  backgroundColor: 'rgba(12, 24, 43, 0.95)', 
                  borderColor: 'rgba(171, 196, 255, 0.1)', 
                  borderRadius: '16px',
                  color: '#f5f7ff',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(16px)'
                }}
                itemStyle={{ color: '#7fd9ff', fontWeight: 600 }}
              />
              <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                {(taskMix.length ? taskMix : [{ fill: "#5e6a8f" }]).map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Recent Activity</p>
            <h3>What the workers touched most recently</h3>
          </div>
        </div>
        <div className="activity-stack">
          {recentActivity.length ? (
            recentActivity.map((job) => (
              <button key={job.id} className="activity-item" onClick={() => setFocusedJobId(job.id)}>
                <div>
                  <strong>{job.title}</strong>
                  <p>{job.task_type}</p>
                </div>
                <div className={`status-patch status-${job.status}`}>{job.status}</div>
              </button>
            ))
          ) : (
            <EmptyState
              icon={Bot}
              title="No activity yet"
              copy="Create a job in Task Studio and this rail will turn into a live operations journal."
            />
          )}
        </div>
      </section>

      <section className="panel panel--wide">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Job Radar</p>
            <h3>Search, inspect, and steer queued work</h3>
          </div>
          <input
            className="text-input text-input--compact"
            value={jobSearch}
            onChange={(event) => setJobSearch(event.target.value)}
            placeholder="Search titles, task types, or statuses"
          />
        </div>

        <div className="job-grid">
          <div className="job-list">
            {filteredJobs.length ? (
              filteredJobs.map((job) => (
                <button key={job.id} className="job-row" onClick={() => setFocusedJobId(job.id)}>
                  <div>
                    <strong>{job.title}</strong>
                    <p>
                      {job.task_type} • {job.description || "No description"}
                    </p>
                  </div>
                  <div className={`status-patch status-${job.status}`}>{job.status}</div>
                </button>
              ))
            ) : (
              <EmptyState
                icon={Workflow}
                title="No matching jobs"
                copy="Change the search term or create a new mission in the studio."
              />
            )}
          </div>

          <div className="job-detail">
            {focusedJob ? (
              <>
                <div className="job-detail__header">
                  <div>
                    <p className="eyebrow">Focused Job</p>
                    <h4>{focusedJob.title}</h4>
                    <p>{focusedJob.description || "No description provided."}</p>
                  </div>
                  <div className={`status-patch status-${focusedJob.status}`}>{focusedJob.status}</div>
                </div>

                <div className="detail-meta">
                  <span>Task: {focusedJob.task_type}</span>
                  <span>Created: {formatDate(focusedJob.created_at)}</span>
                  <span>Scheduled: {formatDate(focusedJob.scheduled_at)}</span>
                </div>

                <div className="code-blocks">
                  <ErrorBoundary>
                    <JobPayloadViewer payload={focusedJob.payload} />
                  </ErrorBoundary>
                  <ErrorBoundary>
                    <JobResultViewer result={focusedJob.result} />
                  </ErrorBoundary>
                  <ErrorBoundary>
                    <JobErrorLogViewer error={focusedJob.error} />
                  </ErrorBoundary>
                </div>

                <div className="action-row">
                  <button
                    className="button button--ghost"
                    onClick={() => updateStatusMutation.mutate({ jobId: focusedJob.id, status: "pending" })}
                  >
                    Mark Pending
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() => updateStatusMutation.mutate({ jobId: focusedJob.id, status: "completed" })}
                  >
                    Mark Complete
                  </button>
                  <button
                    className="button button--danger"
                    onClick={() => deleteJobMutation.mutate(focusedJob.id)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                icon={Database}
                title="Pick a job to inspect"
                copy="Select any card from the radar to see payloads, results, and control actions."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StudioCatalogPage() {
  const navigate = useNavigate();

  return (
    <div className="page-grid">
      <section className="panel panel--wide">
        <div className="task-launch-hero">
          <div>
            <p className="eyebrow">Task Launcher</p>
            <h3>Pick a task and move into a dedicated builder made for that workflow.</h3>
            <p className="template-copy">
              Each task now opens its own page, shows the data it needs, and walks the user through the inputs step by step.
            </p>
          </div>
          <div className="hero-actions">
            <div className="status-pill status-pill--accent">
              {taskCatalog.length} task builders ready
            </div>
          </div>
        </div>
      </section>

      <section className="panel panel--wide">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Task Types</p>
            <h3>Open the task you want to configure</h3>
          </div>
          <div className="panel__badge">dedicated page per task</div>
        </div>

        <div className="atlas-grid atlas-grid--launcher">
          {taskCatalog.map((item, index) => {
            const schema = getTaskForm(item.type);
            const requiredFields = schema.fields.filter((field) => field.required).slice(0, 3);

            return (
              <motion.button
                key={item.type}
                className="atlas-card atlas-card--launch"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => navigate(`/studio/${item.type}`)}
              >
                <span className={`accent accent-${item.accent}`} />
                <div className="atlas-card__top">
                  <p>{item.family}</p>
                  <strong>{item.label}</strong>
                </div>
                <span>{item.blurb}</span>

                <div className="atlas-card__details">
                  {requiredFields.map((field) => (
                    <span key={field.name} className="template-pill">
                      {field.label}
                    </span>
                  ))}
                </div>

                <span className="atlas-card__cta">Open Builder</span>
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TaskBuilderPage({ activeUserId, createJobMutation }) {
  const navigate = useNavigate();
  const { taskType } = useParams();

  const template = findTaskTemplate(taskType);
  const taskForm = getTaskForm(template.type);
  const [jobDraft, setJobDraft] = useState(() => buildJobDraft(template));
  const [composerError, setComposerError] = useState("");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [uploadState, setUploadState] = useState({});

  useEffect(() => {
    if (taskType && taskType !== template.type) {
      navigate(`/studio/${template.type}`, { replace: true });
    }
  }, [navigate, taskType, template.type]);

  useEffect(() => {
    setJobDraft(buildJobDraft(template));
    setComposerError("");
    setActiveStepIndex(0);
    setUploadState({});
    createJobMutation.reset();
  }, [template.type]);

  const taskSections = getVisibleTaskSections(taskForm, jobDraft.payloadForm);
  const steps = ["Job Details", ...taskSections, "Review"];
  const currentStepName = steps[activeStepIndex];
  const isReviewStep = currentStepName === "Review";
  const isJobDetailsStep = currentStepName === "Job Details";
  const payloadPreview = getPayloadPreviewState(
    jobDraft.task_type,
    jobDraft.payloadForm,
    jobDraft.payloadOverrideEnabled,
    jobDraft.payloadOverrideText,
  );
  const requiredFields = taskForm.fields.filter((field) => field.required).slice(0, 8);

  useEffect(() => {
    setActiveStepIndex((current) => Math.min(current, steps.length - 1));
  }, [steps.length]);

  function handleTaskSwitch(nextType) {
    navigate(`/studio/${nextType}`);
  }

  function handleJobFieldChange(fieldName, value) {
    createJobMutation.reset();
    setComposerError("");
    setJobDraft((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  function handlePayloadFieldChange(fieldName, value) {
    createJobMutation.reset();
    setComposerError("");
    setJobDraft((current) => ({
      ...current,
      payloadForm: {
        ...current.payloadForm,
        [fieldName]: value,
      },
    }));
  }

  async function handleFieldUpload(field, files) {
    if (!files.length) {
      return;
    }

    const uploadLabel = files.length === 1 ? files[0].name : `${files.length} files`;
    setUploadState((current) => ({
      ...current,
      [field.name]: {
        status: "uploading",
        message: `Uploading ${uploadLabel}...`,
      },
    }));

    try {
      const response = await api.uploadFiles(files);
      const uploadedFiles = Array.isArray(response?.files) ? response.files : [];

      if (!uploadedFiles.length) {
        throw new Error("The backend did not return any uploaded file paths.");
      }

      createJobMutation.reset();
      setComposerError("");
      setJobDraft((current) => {
        const currentValue = current.payloadForm[field.name];
        const uploadedPaths = uploadedFiles
          .map((item) => item.path)
          .filter(Boolean);

        const nextValue =
          field.upload?.mode === "multiple"
            ? [
              ...(field.upload?.append
                ? String(currentValue ?? "")
                  .split(/\r?\n/)
                  .map((item) => item.trim())
                  .filter(Boolean)
                : []),
              ...uploadedPaths,
            ].join("\n")
            : uploadedPaths[0] || "";

        return {
          ...current,
          payloadForm: {
            ...current.payloadForm,
            [field.name]: nextValue,
          },
        };
      });

      setUploadState((current) => ({
        ...current,
        [field.name]: {
          status: "success",
          message:
            uploadedFiles.length === 1
              ? `${uploadedFiles[0].original_name} uploaded and linked to this field.`
              : `${uploadedFiles.length} files uploaded and linked to this field.`,
        },
      }));
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        [field.name]: {
          status: "error",
          message: error?.message || "Upload failed.",
        },
      }));
    }
  }

  function handlePayloadOverrideToggle() {
    createJobMutation.reset();
    setComposerError("");
    setJobDraft((current) => {
      const nextEnabled = !current.payloadOverrideEnabled;
      let nextOverrideText = current.payloadOverrideText;

      if (nextEnabled) {
        try {
          nextOverrideText = JSON.stringify(
            buildPayloadFromTaskForm(current.task_type, current.payloadForm),
            null,
            2,
          );
        } catch {
          nextOverrideText = current.payloadOverrideText;
        }
      }

      return {
        ...current,
        payloadOverrideEnabled: nextEnabled,
        payloadOverrideText: nextOverrideText,
      };
    });
  }

  function handleCreateJob(event) {
    event.preventDefault();
    const previewState = getPayloadPreviewState(
      jobDraft.task_type,
      jobDraft.payloadForm,
      jobDraft.payloadOverrideEnabled,
      jobDraft.payloadOverrideText,
    );

    if (previewState.error) {
      createJobMutation.reset();
      setComposerError(previewState.error);
      return;
    }

    setComposerError("");

    createJobMutation.mutate({
      title: jobDraft.title,
      description: jobDraft.description,
      status: "pending",
      user_id: Number(activeUserId),
      task_type: jobDraft.task_type,
      payload: previewState.payload,
      scheduled_at: jobDraft.scheduled_at || null,
    });
  }

  return (
    <div className="page-grid page-grid--builder">
      <section className="panel builder-rail">
        <div className="action-row">
          <button className="button button--ghost" type="button" onClick={() => navigate("/studio")}>
            <ArrowRight size={16} />
            All Tasks
          </button>
        </div>

        <div className="builder-task-head">
          <p className="eyebrow">Dedicated Builder</p>
          <h3>{template.label}</h3>
          <p className="template-copy">{template.blurb}</p>
        </div>

        <label className="field">
          <span className="field-label">Switch Task</span>
          <select
            className="text-input"
            value={template.type}
            onChange={(event) => handleTaskSwitch(event.target.value)}
          >
            {taskCatalog.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="step-stack">
          {steps.map((stepName, index) => (
            <button
              key={stepName}
              type="button"
              className={`builder-step ${index === activeStepIndex ? "is-active" : ""}`}
              onClick={() => setActiveStepIndex(index)}
            >
              <span className="builder-step__index">{index + 1}</span>
              <span className="builder-step__meta">
                <strong>{stepName}</strong>
                <small>{index === 0 ? "job basics" : index === steps.length - 1 ? "payload review" : "task inputs"}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel builder-stage">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Step {activeStepIndex + 1} of {steps.length}</p>
            <h3>{currentStepName}</h3>
          </div>
          <div className={`status-pill status-pill--accent accent-${template.accent}`}>
            {template.family}
          </div>
        </div>

        <form className="composer-form" onSubmit={handleCreateJob}>
          {isJobDetailsStep ? (
            <div className="guided-composer">
              <section className="composer-section">
                <div className="composer-section__header">
                  <p className="eyebrow">Job Setup</p>
                  <h4>Give this task a clear title and schedule</h4>
                </div>

                <div className="field-grid field-grid--guided">
                  <label className="field">
                    <span className="field-label">Task Type</span>
                    <input className="text-input" value={template.label} disabled />
                  </label>

                  <label className="field">
                    <span className="field-label">User ID</span>
                    <input className="text-input" value={activeUserId} disabled />
                  </label>

                  <label className="field field--span-2">
                    <span className="field-label">Title</span>
                    <input
                      className="text-input"
                      value={jobDraft.title}
                      onChange={(event) => handleJobFieldChange("title", event.target.value)}
                    />
                  </label>

                  <label className="field field--span-2">
                    <span className="field-label">Description</span>
                    <textarea
                      className="text-area"
                      value={jobDraft.description}
                      onChange={(event) => handleJobFieldChange("description", event.target.value)}
                    />
                  </label>

                  <label className="field field--span-2">
                    <span className="field-label">Schedule</span>
                    <input
                      type="datetime-local"
                      className="text-input"
                      value={jobDraft.scheduled_at}
                      onChange={(event) => handleJobFieldChange("scheduled_at", event.target.value)}
                    />
                  </label>
                </div>
              </section>
            </div>
          ) : null}

          {!isJobDetailsStep && !isReviewStep ? (
            <TaskPayloadComposer
              schema={taskForm}
              values={jobDraft.payloadForm}
              onChange={handlePayloadFieldChange}
              onUpload={handleFieldUpload}
              uploadState={uploadState}
              activeSectionName={currentStepName}
              showNote={false}
            />
          ) : null}

          {isReviewStep ? (
            <div className="guided-composer">
              <section className="composer-section">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">Payload Review</p>
                    <h3>{jobDraft.payloadOverrideEnabled ? "Advanced JSON Override" : "Generated Backend Payload"}</h3>
                  </div>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={handlePayloadOverrideToggle}
                  >
                    {jobDraft.payloadOverrideEnabled ? "Use Guided Fields" : "Advanced JSON"}
                  </button>
                </div>

                {jobDraft.payloadOverrideEnabled ? (
                  <textarea
                    className="text-area text-area--code"
                    value={jobDraft.payloadOverrideText}
                    onChange={(event) =>
                      setJobDraft((current) => ({
                        ...current,
                        payloadOverrideText: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <PanelCode title="Generated Payload" value={payloadPreview.text} />
                )}

                {payloadPreview.error ? (
                  <p className="feedback feedback--error">{payloadPreview.error}</p>
                ) : (
                  <p className="panel-subcopy">
                    This is the exact payload that will be sent to the backend for the selected task.
                  </p>
                )}
              </section>
            </div>
          ) : null}

          <div className="builder-navigation">
            <button
              className="button button--ghost"
              type="button"
              disabled={activeStepIndex === 0}
              onClick={() => setActiveStepIndex((current) => Math.max(0, current - 1))}
            >
              Previous
            </button>

            {isReviewStep ? (
              <button className="button button--primary" type="submit" disabled={createJobMutation.isPending}>
                {createJobMutation.isPending ? "Creating..." : "Create Job"}
              </button>
            ) : (
              <button
                className="button button--primary"
                type="button"
                onClick={() => setActiveStepIndex((current) => Math.min(steps.length - 1, current + 1))}
              >
                Next
              </button>
            )}
          </div>

          {composerError ? <p className="feedback feedback--error">{composerError}</p> : null}
          {createJobMutation.error ? <p className="feedback feedback--error">{createJobMutation.error.message}</p> : null}
          {createJobMutation.isSuccess ? <p className="feedback feedback--success">Job created and queued successfully.</p> : null}
        </form>
      </section>

      <section className="panel builder-summary">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Task Summary</p>
            <h3>What this task needs</h3>
          </div>
        </div>

        <div className="builder-note">{taskForm.note}</div>

        <div className="template-pill-stack">
          {requiredFields.map((field) => (
            <span key={field.name} className="template-pill">
              {field.label}
            </span>
          ))}
        </div>

        <PanelCode title="Current Payload" value={payloadPreview.text || JSON.stringify(template.payload, null, 2)} />
      </section>
    </div>
  );
}

function StudioPage({
  highlightedTemplate,
  highlightedTaskForm,
  payloadPreview,
  selectedTaskType,
  onTemplateChange,
  jobDraft,
  setJobDraft,
  onPayloadFieldChange,
  onPayloadOverrideToggle,
  activeUserId,
  createJobMutation,
  composerError,
  onSubmit,
}) {
  return (
    <div className="page-grid page-grid--studio">
      <section className="panel panel--wide">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Task Atlas</p>
            <h3>Choose a mission profile, then shape the payload</h3>
          </div>
          <div className="panel__badge">20 task types ready</div>
        </div>

        <div className="atlas-grid">
          {taskCatalog.map((item, index) => (
            <motion.button
              key={item.type}
              className={`atlas-card ${selectedTaskType === item.type ? "is-selected" : ""}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => onTemplateChange(item.type)}
            >
              <span className={`accent accent-${item.accent}`} />
              <div className="atlas-card__top">
                <p>{item.family}</p>
                <strong>{item.label}</strong>
              </div>
              <span>{item.blurb}</span>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Mission Builder</p>
            <h3>Compose the next job</h3>
          </div>
        </div>

        <form className="composer-form" onSubmit={onSubmit}>
          <div className="field-grid">
            <label className="field">
              <span className="field-label">Task Type</span>
              <select value={selectedTaskType} onChange={(event) => onTemplateChange(event.target.value)} className="text-input">
                {taskCatalog.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">User ID</span>
              <input className="text-input" value={activeUserId} disabled />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Title</span>
            <input
              className="text-input"
              value={jobDraft.title}
              onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">Description</span>
            <textarea
              className="text-area"
              value={jobDraft.description}
              onChange={(event) => setJobDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">Schedule</span>
            <input
              type="datetime-local"
              className="text-input"
              value={jobDraft.scheduled_at}
              onChange={(event) => setJobDraft((current) => ({ ...current, scheduled_at: event.target.value }))}
            />
          </label>

          <TaskPayloadComposer
            schema={highlightedTaskForm}
            values={jobDraft.payloadForm}
            onChange={onPayloadFieldChange}
          />

          <div className="payload-preview">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Payload Output</p>
                <h3>{jobDraft.payloadOverrideEnabled ? "Advanced JSON Override" : "Generated Backend Payload"}</h3>
              </div>
              <button
                className="button button--ghost"
                type="button"
                onClick={onPayloadOverrideToggle}
              >
                {jobDraft.payloadOverrideEnabled ? "Use Guided Fields" : "Advanced JSON"}
              </button>
            </div>

            {jobDraft.payloadOverrideEnabled ? (
              <textarea
                className="text-area text-area--code"
                value={jobDraft.payloadOverrideText}
                onChange={(event) =>
                  setJobDraft((current) => ({
                    ...current,
                    payloadOverrideText: event.target.value,
                  }))
                }
              />
            ) : (
              <PanelCode title="Generated Payload" value={payloadPreview.text} />
            )}

            {payloadPreview.error ? (
              <p className="feedback feedback--error">{payloadPreview.error}</p>
            ) : (
              <p className="panel-subcopy">
                The form above is translated directly into the payload the backend receives.
              </p>
            )}
          </div>

          <div className="action-row">
            <button className="button button--primary" type="submit" disabled={createJobMutation.isPending}>
              {createJobMutation.isPending ? "Launching..." : "Create Job"}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setJobDraft(buildJobDraft(highlightedTemplate))}
            >
              Reset Form
            </button>
          </div>

          {composerError ? <p className="feedback feedback--error">{composerError}</p> : null}
          {createJobMutation.error ? <p className="feedback feedback--error">{createJobMutation.error.message}</p> : null}
          {createJobMutation.isSuccess ? <p className="feedback feedback--success">Job created and queued successfully.</p> : null}
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Template Signal</p>
            <h3>{highlightedTemplate.label}</h3>
          </div>
          <div className={`status-pill status-pill--accent accent-${highlightedTemplate.accent}`}>
            {highlightedTemplate.family}
          </div>
        </div>
        <p className="template-copy">{highlightedTemplate.blurb}</p>
        <div className="template-pill-stack">
          {highlightedTaskForm.fields
            .filter((field) => field.required)
            .slice(0, 8)
            .map((field) => (
              <span key={field.name} className="template-pill">
                {field.label}
              </span>
            ))}
        </div>
        <div className="builder-note">
          {highlightedTaskForm.note}
        </div>
        <PanelCode title="Current Payload" value={payloadPreview.text || JSON.stringify(highlightedTemplate.payload, null, 2)} />
      </section>
    </div>
  );
}

function AccessPage({ authState, setAuthState, loginMutation, registerMutation, setActiveUserId }) {
  function updateAuthForm(section, field, value) {
    setAuthState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function handleLogin(event) {
    event.preventDefault();
    loginMutation.mutate(authState.login, {
      onSuccess: (result) => {
        if (result?.user?.id) {
          setActiveUserId(String(result.user.id));
        }
      },
    });
  }

  function handleRegister(event) {
    event.preventDefault();
    registerMutation.mutate(authState.register);
  }

  return (
    <div className="page-grid page-grid--access">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Identity</p>
            <h3>Sign in to follow an operator lane</h3>
          </div>
        </div>

        <form className="composer-form" onSubmit={handleLogin}>
          <label className="field">
            <span className="field-label">Username</span>
            <input
              className="text-input"
              value={authState.login.username}
              onChange={(event) => updateAuthForm("login", "username", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              className="text-input"
              value={authState.login.password}
              onChange={(event) => updateAuthForm("login", "password", event.target.value)}
            />
          </label>
          <button className="button button--primary" type="submit" disabled={loginMutation.isPending}>
            <UserRound size={16} />
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </button>
          {loginMutation.error ? <p className="feedback feedback--error">{loginMutation.error.message}</p> : null}
          {loginMutation.isSuccess ? (
            <p className="feedback feedback--success">
              {loginMutation.data?.message}. Active user is now {loginMutation.data?.user?.id || "set"}.
            </p>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Onboard</p>
            <h3>Create a fresh operator identity</h3>
          </div>
        </div>

        <form className="composer-form" onSubmit={handleRegister}>
          <label className="field">
            <span className="field-label">Username</span>
            <input
              className="text-input"
              value={authState.register.username}
              onChange={(event) => updateAuthForm("register", "username", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              className="text-input"
              value={authState.register.email}
              onChange={(event) => updateAuthForm("register", "email", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Full Name</span>
            <input
              className="text-input"
              value={authState.register.full_name}
              onChange={(event) => updateAuthForm("register", "full_name", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              className="text-input"
              value={authState.register.password}
              onChange={(event) => updateAuthForm("register", "password", event.target.value)}
            />
          </label>
          <button className="button button--primary" type="submit" disabled={registerMutation.isPending}>
            <ShieldCheck size={16} />
            {registerMutation.isPending ? "Creating..." : "Register"}
          </button>
          {registerMutation.error ? <p className="feedback feedback--error">{registerMutation.error.message}</p> : null}
          {registerMutation.isSuccess ? (
            <p className="feedback feedback--success">
              {registerMutation.data?.message}. New user id: {registerMutation.data?.user?.id}.
            </p>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Why this surface works</p>
            <h3>Built for operators, not just endpoints</h3>
          </div>
        </div>
        <div className="principles">
          <Principle icon={Radar} title="Reactive by default" copy="Live polling, instant refocus, and charted signals keep the system feeling awake." />
          <Principle icon={AudioLines} title="Design with rhythm" copy="Motion, color, and hierarchy are tuned to make status changes obvious without looking generic." />
          <Principle icon={Bot} title="Task-aware composition" copy="The studio knows every task type, so payload authoring starts with strong presets instead of blank screens." />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, help, tone }) {
  return (
    <motion.div
      className={`metric-card tone-${tone}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
    >
      <div className="metric-card__icon">
        <Icon size={18} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{help}</span>
      </div>
    </motion.div>
  );
}

function PanelCode({ title, value }) {
  return (
    <div className="code-panel">
      <p className="eyebrow">{title}</p>
      <pre>{value}</pre>
    </div>
  );
}

const PayloadDataNode = ({ data, depth = 0, colorTheme = "blue" }) => {
  const isGreen = colorTheme === "green";
  const textColor = isGreen ? "text-[#4ad7a3]/80" : "text-[#7fd9ff]/80";
  const borderColor = isGreen ? "border-[#4ad7a3]/20" : "border-[#7fd9ff]/20";
  const hoverColor = isGreen ? "hover:border-[#4ad7a3]/30" : "hover:border-[rgba(127,217,255,0.2)]";

  if (typeof data !== "object" || data === null) {
    return <span className={`font-sans text-sm ${isGreen ? "text-[#e8fff5]" : "text-[#e6f0ff]"} break-words flex-1 leading-relaxed`}>{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-[#9fb0d8] text-sm italic">{"[]"} empty</span>;
    return (
      <div className="flex flex-col gap-2 w-full mt-1">
        {data.map((item, idx) => (
          <div key={idx} className="bg-black/20 p-2.5 rounded-lg border border-white/5">
            <PayloadDataNode data={item} depth={depth + 1} colorTheme={colorTheme} />
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) return <span className="text-[#9fb0d8] text-sm italic">{"{}"} empty</span>;

  return (
    <div className={`grid gap-2 w-full ${depth > 0 ? "mt-1" : ""}`}>
      {entries.map(([key, value]) => {
        const isComplex = typeof value === "object" && value !== null;
        return (
          <div key={key} className={`flex flex-col ${!isComplex ? "sm:flex-row sm:items-start" : ""} gap-1.5 sm:gap-2 ${depth === 0 ? `bg-black/30 p-3 rounded-xl border border-white/5 transition-colors ${hoverColor}` : `border-l-2 ${borderColor} pl-3`}`}>
            <span className={`${depth === 0 ? "sm:w-[140px]" : "w-auto"} shrink-0 font-mono text-[0.7rem] ${textColor} font-bold break-all mt-0.5`}>
              {key}
            </span>
            <div className="flex-1 w-full overflow-hidden">
              <PayloadDataNode data={value} depth={depth + 1} colorTheme={colorTheme} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

function JobPayloadViewer({ payload }) {
  if (!payload || payload === "None") return <PanelCode title="Payload" value="None" />;

  let data = payload;
  if (typeof payload === "string") {
    try { data = JSON.parse(payload); } catch (e) { }
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return (
      <div className="flex flex-col gap-3 bg-[#0a1324]/60 p-5 rounded-2xl border border-[rgba(171,196,255,0.1)]">
        <h4 className="text-[0.65rem] font-mono tracking-widest text-[#9fb0d8] uppercase font-bold mb-1 flex items-center gap-2">
          <Activity size={14} /> Mission Configuration Parameters
        </h4>
        <PayloadDataNode data={data} colorTheme="blue" />
      </div>
    );
  }

  return <PanelCode title="Raw Payload Parameter" value={formatJson(payload)} />;
}

function JobResultViewer({ result }) {
  if (!result || result === "None") return <PanelCode title="Result" value="None" />;

  try {
    const data = typeof result === "string" ? JSON.parse(result) : result;
    
    if (data && typeof data === "object") {
      // Auto-detect ANY page blocks format generically!
      const possiblePagesArray = data.pages || data.blocks || data.data || [];
      if (Array.isArray(possiblePagesArray) && possiblePagesArray.length > 0) {
         let allBlocks = [];
         if (possiblePagesArray[0]?.blocks) {
             allBlocks = possiblePagesArray.flatMap(p => p.blocks || []);
         } else if (possiblePagesArray[0]?.text) {
             // Directly formatted blocks array
             allBlocks = possiblePagesArray;
         }
         
         if (allBlocks.length > 0) {
            return (
              <div className="flex flex-col gap-4 bg-[#10121a]/80 p-5 rounded-2xl border border-[rgba(171,196,255,0.16)] shadow-lg mt-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#38d7c0]" />
                  <h4 className="text-xs font-mono tracking-widest text-[#9fb0d8] uppercase font-semibold">Vision Intelligence Pipeline</h4>
                </div>
                <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {allBlocks.map((b, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between items-start bg-black/40 p-4 rounded-xl border border-[rgba(171,196,255,0.06)] hover:border-[#38d7c0]/30 transition-all group">
                      <span className="text-[#f5f7ff] font-sans leading-relaxed group-hover:text-white break-words">{b.text}</span>
                      {b.confidence != null && (
                        <span className="text-[0.65rem] shrink-0 font-mono tracking-wider bg-[#38d7c0]/10 text-[#38d7c0] px-3 py-1.5 rounded-full border border-[#38d7c0]/20 sm:ml-4 mt-3 sm:mt-0">
                          CONF: {(b.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
         }
      }
      
      // Generic JSON Display fallback if not OCR Blocks
      if (!Array.isArray(data)) {
        return (
          <div className="flex flex-col gap-3 bg-[#0a1324]/60 p-5 rounded-2xl border border-[rgba(74,215,163,0.1)] mt-2">
            <h4 className="text-[0.65rem] font-mono tracking-widest text-[#4ad7a3] uppercase font-bold mb-1 flex items-center gap-2">
              <BadgeCheck size={14} /> Output Telemetry
            </h4>
            <PayloadDataNode data={data} colorTheme="green" />
          </div>
        );
      }
    }
  } catch (e) {
    // fallthrough
  }

  return <PanelCode title="Raw Output" value={formatJson(result)} />;
}

function JobErrorLogViewer({ error }) {
  if (!error || error === "None") return <PanelCode title="Logs & Errors" value="Systems clear. No operational anomalies." />;

  const rawText = String(error);
  const lines = rawText.split("\n");
  const warnings = lines.filter(l => l.toLowerCase().includes("warning"));
  const critical = lines.filter(l => l.toLowerCase().includes("traceback") || l.toLowerCase().includes("error") || l.toLowerCase().includes("exception"));

  return (
    <div className="flex flex-col gap-4 mt-4">
      {warnings.length > 0 && (
        <div className="bg-[#f7b955]/10 border-l-[3px] border-[#f7b955] p-4 rounded-r-xl shadow-sm">
          <p className="text-xs uppercase tracking-widest font-semibold text-[#f7b955] mb-3 font-mono">System Warnings</p>
          <div className="flex flex-col gap-2">
            {warnings.map((w, i) => <p key={i} className="text-xs font-mono text-[#f7b955]/90 leading-relaxed border-b border-[#f7b955]/10 pb-2 last:border-0 last:pb-0">{w}</p>)}
          </div>
        </div>
      )}
      {critical.length > 0 && (
        <div className="bg-[#f04f6e]/10 border-l-[3px] border-[#f04f6e] p-4 rounded-r-xl shadow-sm">
          <p className="text-xs uppercase tracking-widest font-semibold text-[#f04f6e] mb-3 font-mono">Critical Diagnostic Failure</p>
          <div className="flex flex-col gap-2">
            {critical.map((c, i) => <p key={i} className="text-[0.7rem] font-mono text-[#f04f6e]/90 leading-relaxed">{c}</p>)}
          </div>
        </div>
      )}

      {(warnings.length > 0 || critical.length > 0) ? (
        <details className="group cursor-pointer">
          <summary className="text-[0.7rem] uppercase tracking-widest font-semibold text-[#9fb0d8] hover:text-white transition-colors list-none flex items-center gap-2">
            <Activity size={14} /> Toggle Full Context Trace
          </summary>
          <pre className="mt-3 p-4 bg-black/60 rounded-xl overflow-x-auto text-[0.75rem] leading-relaxed font-mono text-[#d5e0ff]/70 border border-white/5 whitespace-pre-wrap">
            {rawText}
          </pre>
        </details>
      ) : (
        <PanelCode title="Unclassified Log" value={rawText} />
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, copy }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon size={22} />
      </div>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function Principle({ icon: Icon, title, copy }) {
  return (
    <div className="principle-card">
      <div className="principle-card__icon">
        <Icon size={18} />
      </div>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function accentColor(accent) {
  const palette = {
    teal: "#38d7c0",
    orange: "#ff9a49",
    amber: "#f7c55d",
    coral: "#ff6f61",
    sky: "#7fd9ff",
    olive: "#94d05f",
  };
  return palette[accent] || "#7fd9ff";
}

export default App;
