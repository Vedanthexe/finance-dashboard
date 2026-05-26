import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const STORAGE_KEY = 'finance-dashboard-v2'

const PERIODS = ['today', 'week', 'month', 'quarter', 'year']
const PERIOD_LABELS = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}
const PERIOD_SCALE = {
  today: 1 / 30,
  week: 7 / 30,
  month: 1,
  quarter: 3,
  year: 12,
}

const DEFAULT_INCOME = {
  salary: '',
  freelance: '',
  investments: '',
  other: '',
}
const DEFAULT_EXPENSES = {
  rent: '',
  food: '',
  transport: '',
  subscriptions: '',
  misc: '',
}
const EXPENSE_LABELS = {
  rent: 'Rent',
  food: 'Food',
  transport: 'Transport',
  subscriptions: 'Subscriptions',
  misc: 'Misc',
}
const INCOME_LABELS = {
  salary: 'Salary',
  freelance: 'Freelance',
  investments: 'Investments',
  other: 'Other',
}

const TX_CATEGORIES = [
  'Salary',
  'Freelance',
  'Food',
  'Transport',
  'Rent',
  'Subscriptions',
  'Misc',
  'Other',
]

const DEFAULT_GOALS = [
  {
    id: 'emergency',
    name: 'Emergency Fund',
    current: '400000',
    target: '600000',
    monthlyContribution: '15000',
  },
  {
    id: 'laptop',
    name: 'Laptop Fund',
    current: '35000',
    target: '70000',
    monthlyContribution: '8000',
  },
  {
    id: 'vacation',
    name: 'Vacation Fund',
    current: '12000',
    target: '50000',
    monthlyContribution: '5000',
  },
]

const DEFAULT_TRANSACTIONS = [
  {
    id: 't1',
    label: 'Salary credit',
    amount: '280000',
    date: '2026-05-01',
    type: 'in',
    category: 'Salary',
    ledgerApplied: false,
  },
  {
    id: 't2',
    label: 'Rent payment',
    amount: '40000',
    date: '2026-05-03',
    type: 'out',
    category: 'Rent',
    ledgerApplied: false,
  },
  {
    id: 't3',
    label: 'Swiggy',
    amount: '850',
    date: '2026-05-12',
    type: 'out',
    category: 'Food',
    ledgerApplied: false,
  },
]

const DEFAULT_BILLS = [
  { id: 'b1', name: 'Electricity', amount: '3200', due: '2026-05-28' },
  { id: 'b2', name: 'Internet', amount: '999', due: '2026-06-02' },
]

const DEFAULT_RECURRING = [
  { id: 'r1', name: 'Netflix', amount: '649', cadence: 'Monthly' },
  { id: 'r2', name: 'Gym', amount: '2500', cadence: 'Monthly' },
]


const T = {
  bg: '#0A0A0A',
  card: '#111111',
  border: '#222222',
  borderSubtle: '#1A1A1A',
  text: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textMuted: '#6B6B6B',
  positive: '#10B981',
  positiveMuted: 'rgba(16, 185, 129, 0.08)',
  negative: '#F43F5E',
  negativeMuted: 'rgba(244, 63, 94, 0.08)',
  accent: '#10B981',
  inputBg: '#161616',
  inputBorder: '#2A2A2A',
  track: '#1E1E1E',
  gridLine: '#222222',
}

const CHART_ANIMATION = { animationDuration: 400, animationEasing: 'ease-out' }

function parseNum(value) {
  const n = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatCompact(n) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (abs >= 100000) return `₹${(n / 100000).toFixed(abs % 100000 === 0 ? 0 : 1)}L`
  if (abs >= 1000) return `₹${Math.round(n / 1000)}k`
  return formatCurrency(n)
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthKey(d)
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatTxDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

function scaleMetric(value, period) {
  return value * (PERIOD_SCALE[period] ?? 1)
}

function applyTransactionDelta(income, expenses, customExpenses, category, type, amount, sign = 1) {
  const delta = amount * sign
  const nextIncome = { ...income, custom: [...(income.custom || [])] }
  const nextExpenses = { ...expenses }

  if (type === 'in') {
    if (category === 'Salary') {
      nextIncome.salary = String(parseNum(nextIncome.salary) + delta)
    } else if (category === 'Freelance') {
      nextIncome.freelance = String(parseNum(nextIncome.freelance) + delta)
    } else {
      nextIncome.other = String(parseNum(nextIncome.other) + delta)
    }
    return { income: nextIncome, expenses: nextExpenses, customExpenses }
  }

  const expenseKey = {
    Food: 'food',
    Transport: 'transport',
    Rent: 'rent',
    Subscriptions: 'subscriptions',
    Misc: 'misc',
    Other: 'misc',
  }[category]

  if (expenseKey) {
    nextExpenses[expenseKey] = String(parseNum(nextExpenses[expenseKey]) + delta)
  } else {
    nextExpenses.misc = String(parseNum(nextExpenses.misc) + delta)
  }

  return { income: nextIncome, expenses: nextExpenses, customExpenses }
}

function computeMetrics(income, expenses, customExpenses, netWorth) {
  const incomeBase = Object.entries(income)
    .filter(([k]) => k !== 'custom')
    .reduce((s, [, v]) => s + parseNum(v), 0)
  const totalIncome =
    incomeBase + (income.custom || []).reduce((s, c) => s + parseNum(c.amount), 0)
  const totalExpenses =
    Object.values(expenses).reduce((s, v) => s + parseNum(v), 0) +
    customExpenses.reduce((s, c) => s + parseNum(c.amount), 0)
  const monthlySavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0
  return {
    totalIncome,
    totalExpenses,
    monthlySavings,
    savingsRate,
    netWorth: parseNum(netWorth),
    subscriptions: parseNum(expenses.subscriptions),
  }
}

function buildSnapshot(income, expenses, customExpenses, netWorth) {
  return { ...computeMetrics(income, expenses, customExpenses, netWorth), at: Date.now() }
}

function migrateV1(parsed) {
  return {
    income: { ...DEFAULT_INCOME, ...parsed.income, custom: [] },
    expenses: { ...DEFAULT_EXPENSES, ...parsed.expenses },
    customExpenses: parsed.customExpenses || [],
    netWorth: '',
    debt: '0',
    savingsGoals: DEFAULT_GOALS,
    transactions: DEFAULT_TRANSACTIONS,
    upcomingBills: DEFAULT_BILLS,
    recurringPayments: DEFAULT_RECURRING,
    history: {},
    selectedMonth: monthKey(),
    period: 'month',
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const v1 = localStorage.getItem('finance-dashboard-v1')
      if (v1) return migrateV1(JSON.parse(v1))
      return null
    }
    const parsed = JSON.parse(raw)
    return {
      income: { ...DEFAULT_INCOME, ...parsed.income, custom: parsed.income?.custom || [] },
      expenses: { ...DEFAULT_EXPENSES, ...parsed.expenses },
      customExpenses: parsed.customExpenses || [],
      netWorth: parsed.netWorth ?? '',
      debt: parsed.debt ?? '0',
      savingsGoals: parsed.savingsGoals?.length ? parsed.savingsGoals : DEFAULT_GOALS,
      transactions: parsed.transactions?.length ? parsed.transactions : DEFAULT_TRANSACTIONS,
      upcomingBills: parsed.upcomingBills?.length ? parsed.upcomingBills : DEFAULT_BILLS,
      recurringPayments: parsed.recurringPayments?.length ? parsed.recurringPayments : DEFAULT_RECURRING,
      history: parsed.history || {},
      selectedMonth: parsed.selectedMonth || monthKey(),
      period: parsed.period || 'month',
    }
  } catch {
    return null
  }
}

function seedHistoryIfEmpty(history, currentSnap, month) {
  if (Object.keys(history).length > 0) return history
  const prev = shiftMonth(month, -1)
  return {
    [prev]: {
      totalIncome: currentSnap.totalIncome * 0.88,
      totalExpenses: currentSnap.totalExpenses * 1.08,
      monthlySavings: currentSnap.monthlySavings * 0.85,
      savingsRate: currentSnap.savingsRate * 0.92,
      netWorth: currentSnap.netWorth * 0.97,
      subscriptions: currentSnap.subscriptions * 0.7,
      foodExpense: parseNum(DEFAULT_EXPENSES.food),
    },
  }
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="fd-tooltip">
      {label && <div className="fd-tooltip-label">{label}</div>}
      {payload.map((entry) => (
        <div key={entry.name} className="fd-tooltip-row">
          <span className="fd-tooltip-dot" style={{ background: entry.color || entry.fill }} />
          <span className="fd-tooltip-name">{entry.name}</span>
          <span className="fd-tooltip-value">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ data, color = T.positive, height = 28 }) {
  if (!data?.length) return null
  const w = 72
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={w} height={height} className="fd-sparkline" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  )
}

function TrendBadge({ change, invert = false }) {
  const isUp = change >= 0
  const good = invert ? !isUp : isUp
  const arrow = isUp ? '↑' : '↓'
  const cls = good ? 'fd-trend--good' : change === 0 ? 'fd-trend--neutral' : 'fd-trend--bad'
  return (
    <span className={`fd-trend ${cls}`}>
      {arrow} {Math.abs(change).toFixed(1)}% vs last month
    </span>
  )
}

function SummaryCard({ label, value, change, sparkData, valueClass = '', invertTrend = false }) {
  const sparkColor =
    valueClass.includes('expense') || valueClass.includes('negative') ? T.negative : T.positive
  return (
    <div className="fd-summary-card">
      <div className="fd-summary-top">
        <span className="fd-summary-label">{label}</span>
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
      <div className={`fd-summary-value ${valueClass}`}>{value}</div>
      <TrendBadge change={change} invert={invertTrend} />
    </div>
  )
}

function SectionHeader({ children }) {
  return <h2 className="fd-section-title">{children}</h2>
}

function Card({ children, className = '' }) {
  return <section className={`fd-card ${className}`}>{children}</section>
}

function MoneyInput({ value, onChange, compact = false, placeholder = '0' }) {
  return (
    <input
      className={`fd-input ${compact ? 'fd-input--inline' : ''}`}
      type="number"
      min="0"
      step="any"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ─── Editable List Item ────────────────────────────────────────────────────
function EditableListItem({ item, fields, onSave, onDelete, renderRow }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...item })

  const handleSave = () => {
    onSave(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ padding: '12px 0', borderBottom: `1px solid ${T.border}` }}>
        {fields.map((f) => (
          <div key={f.key} style={{ marginBottom: 8 }}>
            <label className="fd-label">{f.label}</label>
            <input
              className="fd-input"
              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
              value={draft[f.key] ?? ''}
              placeholder={f.placeholder ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
              style={{ marginBottom: 0 }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="fd-btn-primary" style={{ fontSize: 11, padding: '6px 12px' }} onClick={handleSave}>Save</button>
          <button type="button" className="fd-btn-ghost" style={{ fontSize: 11 }} onClick={() => { setDraft({ ...item }); setEditing(false) }}>Cancel</button>
          <button type="button" className="fd-btn-ghost" style={{ fontSize: 11, color: T.negative, marginLeft: 'auto' }} onClick={onDelete}>Delete</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fd-list-item" style={{ paddingRight: 64 }}>
      {renderRow(item)}
      <button type="button" className="fd-tx-delete" style={{ opacity: 0, right: 30 }}
        onClick={onDelete} aria-label="Delete">✕</button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
          padding: '3px 8px', fontSize: 11, color: T.textMuted,
          background: T.inputBg, border: `1px solid ${T.border}`,
          borderRadius: 6, cursor: 'pointer',
        }}
      >Edit</button>
    </div>
  )
}

function AddItemRow({ fields, onAdd }) {
  const [open, setOpen] = useState(false)
  const empty = Object.fromEntries(fields.map((f) => [f.key, '']))
  const [draft, setDraft] = useState(empty)

  const handleAdd = () => {
    if (!draft[fields[0].key]?.trim()) return
    onAdd(draft)
    setDraft(empty)
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="fd-tx-add-btn" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
        + Add
      </button>
    )
  }

  return (
    <div style={{ padding: '12px 0 4px', borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
      {fields.map((f) => (
        <div key={f.key} style={{ marginBottom: 8 }}>
          <label className="fd-label">{f.label}</label>
          <input
            className="fd-input"
            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
            value={draft[f.key]}
            placeholder={f.placeholder ?? ''}
            onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
            style={{ marginBottom: 0 }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" className="fd-btn-primary" style={{ fontSize: 11, padding: '6px 12px' }} onClick={handleAdd}>Add</button>
        <button type="button" className="fd-btn-ghost" style={{ fontSize: 11 }} onClick={() => { setDraft(empty); setOpen(false) }}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Editable Goal ──────────────────────────────────────────────────────────
function EditableGoal({ goal, monthlySavings, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...goal })

  const current = parseNum(goal.current)
  const target = parseNum(goal.target)
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const suggested = parseNum(goal.monthlyContribution) || Math.max(1000, monthlySavings * 0.15)

  if (editing) {
    return (
      <div className="fd-goal">
        {[
          { key: 'name', label: 'Goal name', type: 'text' },
          { key: 'current', label: 'Current (₹)', type: 'number' },
          { key: 'target', label: 'Target (₹)', type: 'number' },
          { key: 'monthlyContribution', label: 'Monthly contribution (₹)', type: 'number' },
        ].map((f) => (
          <div key={f.key} style={{ marginBottom: 8 }}>
            <label className="fd-label">{f.label}</label>
            <input
              className="fd-input"
              type={f.type}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
              style={{ marginBottom: 0 }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="fd-btn-primary" style={{ fontSize: 11, padding: '6px 12px' }}
            onClick={() => { onSave(draft); setEditing(false) }}>Save</button>
          <button type="button" className="fd-btn-ghost" style={{ fontSize: 11 }}
            onClick={() => { setDraft({ ...goal }); setEditing(false) }}>Cancel</button>
          <button type="button" className="fd-btn-ghost" style={{ fontSize: 11, color: T.negative, marginLeft: 'auto' }}
            onClick={onDelete}>Delete</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fd-goal">
      <div className="fd-goal-head">
        <span className="fd-goal-name">{goal.name}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="fd-goal-amt">{formatCompact(current)} / {formatCompact(target)}</span>
          <button type="button" className="fd-btn-ghost" style={{ fontSize: 11, padding: '2px 7px' }}
            onClick={() => setEditing(true)}>Edit</button>
        </div>
      </div>
      <div className="fd-progress-track"><div className="fd-progress-fill" style={{ width: `${pct}%` }} /></div>
      <div className="fd-goal-meta"><span>{pct.toFixed(0)}% complete</span><span>Est. {estimateCompletion(goal, monthlySavings)}</span></div>
      <div className="fd-goal-meta"><span>Suggested: {formatCompact(suggested)}/mo</span></div>
    </div>
  )
}

// ─── Groww Portfolio Section ────────────────────────────────────────────────

function generateInsights({ metrics, prev, scaled, savingsRate, expenseItems, goals, periodLabel }) {
  const insights = []
  const subDelta = metrics.subscriptions - (prev?.subscriptions || 0)
  if (subDelta > 500) {
    insights.push({ type: 'warning', text: `Subscription spending increased ${formatCurrency(subDelta)} vs last month` })
  } else if (subDelta < -500) {
    insights.push({ type: 'positive', text: `Subscription spending decreased ${formatCurrency(Math.abs(subDelta))}` })
  }

  const food = expenseItems.find((e) => e.name === 'Food')
  if (food && prev?.foodExpense) {
    const foodChg = pctChange(food.value, prev.foodExpense)
    if (foodChg <= -5) {
      insights.push({ type: 'positive', text: `Food spending decreased by ${Math.abs(foodChg).toFixed(0)}%` })
    } else if (foodChg >= 10) {
      insights.push({ type: 'warning', text: `Food spending increased by ${foodChg.toFixed(0)}%` })
    }
  }

  if (savingsRate > 0) {
    insights.push({ type: 'neutral', text: `You saved ${savingsRate.toFixed(1)}% of income this ${periodLabel.toLowerCase()}` })
  }

  const annual = scaled.monthlySavings * 12
  if (annual > 0) {
    insights.push({ type: 'neutral', text: `At current pace you'll save ${formatCompact(annual)}/year` })
  }

  const expChg = prev ? pctChange(metrics.totalExpenses, prev.totalExpenses) : 0
  if (expChg >= 12) {
    insights.push({ type: 'warning', text: `Expenses increased ${expChg.toFixed(0)}% vs last month` })
  } else if (metrics.monthlySavings > (prev?.monthlySavings || 0) && prev?.monthlySavings) {
    const savChg = pctChange(metrics.monthlySavings, prev.monthlySavings)
    if (savChg >= 5) {
      insights.push({ type: 'positive', text: `Saved ${savChg.toFixed(0)}% more than last month` })
    }
  }

  const emergency = goals.find((g) => g.name.toLowerCase().includes('emergency'))
  if (emergency) {
    const gap = parseNum(emergency.target) - parseNum(emergency.current)
    const suggest = Math.min(gap, Math.max(5000, scaled.monthlySavings * 0.25))
    if (gap > 0 && suggest > 0) {
      insights.push({ type: 'tip', text: `Move ${formatCompact(suggest)} toward ${emergency.name}` })
    }
  }

  // Groww insight

  return insights.slice(0, 6)
}

function computeHealthScores(metrics, goals, debt) {
  const savingsScore = Math.min(100, Math.max(0, metrics.savingsRate * 1.2))
  const spendRatio = metrics.totalIncome > 0 ? metrics.totalExpenses / metrics.totalIncome : 1
  const spendingScore = Math.min(100, Math.max(0, (1 - spendRatio) * 100))
  const emergency = goals.find((g) => g.name.toLowerCase().includes('emergency'))
  const emergencyScore = emergency
    ? Math.min(100, (parseNum(emergency.current) / Math.max(parseNum(emergency.target), 1)) * 100)
    : 50
  const debtScore = debt <= 0 ? 100 : Math.max(0, 100 - debt / 10000)
  const overall = Math.round((savingsScore + spendingScore + emergencyScore + debtScore) / 4)
  return {
    overall,
    savings: Math.round(savingsScore),
    spending: Math.round(spendingScore),
    emergency: Math.round(emergencyScore),
    debt: Math.round(debtScore),
  }
}

function estimateCompletion(goal, monthlySavings) {
  const remaining = parseNum(goal.target) - parseNum(goal.current)
  if (remaining <= 0) return 'Complete'
  const contrib = parseNum(goal.monthlyContribution) || monthlySavings * 0.15
  if (contrib <= 0) return '—'
  const months = Math.ceil(remaining / contrib)
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

function App({ session }) {
  const [income, setIncome] = useState({ ...DEFAULT_INCOME, custom: [] })
  const [expenses, setExpenses] = useState(DEFAULT_EXPENSES)
  const [customExpenses, setCustomExpenses] = useState([])
  const [netWorth, setNetWorth] = useState('')
  const [debt, setDebt] = useState('0')
  const [savingsGoals, setSavingsGoals] = useState(DEFAULT_GOALS)
  const [transactions, setTransactions] = useState(DEFAULT_TRANSACTIONS)
  const [upcomingBills, setUpcomingBills] = useState(DEFAULT_BILLS)
  const [recurringPayments, setRecurringPayments] = useState(DEFAULT_RECURRING)
  const [history, setHistory] = useState({})
  const [period, setPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const [formsOpen, setFormsOpen] = useState(false)
  const [newExpName, setNewExpName] = useState('')
  const [newExpAmount, setNewExpAmount] = useState('')
  const [newIncName, setNewIncName] = useState('')
  const [newIncAmount, setNewIncAmount] = useState('')
  const [txFormOpen, setTxFormOpen] = useState(false)
  const [txDate, setTxDate] = useState(todayISO)
  const [txDescription, setTxDescription] = useState('')
  const [txCategory, setTxCategory] = useState('Food')
  const [txAmount, setTxAmount] = useState('')
  const [txType, setTxType] = useState('out')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) { setHydrated(true); return }
    supabase
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .single()
      .then(({ data: row }) => {
        const saved = row?.data
        if (saved) {
          setIncome({ ...DEFAULT_INCOME, ...saved.income, custom: saved.income?.custom || [] })
          setExpenses({ ...DEFAULT_EXPENSES, ...saved.expenses })
          setCustomExpenses(saved.customExpenses || [])
          setNetWorth(saved.netWorth ?? '')
          setDebt(saved.debt ?? '0')
          setSavingsGoals(saved.savingsGoals?.length ? saved.savingsGoals : DEFAULT_GOALS)
          setTransactions(saved.transactions?.length ? saved.transactions : DEFAULT_TRANSACTIONS)
          setUpcomingBills(saved.upcomingBills?.length ? saved.upcomingBills : DEFAULT_BILLS)
          setRecurringPayments(saved.recurringPayments?.length ? saved.recurringPayments : DEFAULT_RECURRING)
          setHistory(saved.history || {})
          setSelectedMonth(saved.selectedMonth || monthKey())
          setPeriod(saved.period || 'month')
        }
        setHydrated(true)
      })
  }, [session])

  const metrics = useMemo(
    () => computeMetrics(income, expenses, customExpenses, netWorth),
    [income, expenses, customExpenses, netWorth],
  )

  useEffect(() => {
    if (!hydrated) return
    const userId = session?.user?.id
    if (!userId) return
    const snap = buildSnapshot(income, expenses, customExpenses, netWorth)
    const monthSnap = { ...snap, foodExpense: parseNum(expenses.food) }
    setHistory((prev) => {
      const nextHistory = { ...prev, [selectedMonth]: monthSnap }
      const payload = {
        income, expenses, customExpenses, netWorth, debt,
        savingsGoals, transactions, upcomingBills, recurringPayments,
        history: nextHistory, selectedMonth, period,
      }
      supabase
        .from('user_data')
        .upsert({ user_id: userId, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .then(() => {})
      return nextHistory
    })
  }, [income, expenses, customExpenses, netWorth, debt, savingsGoals, transactions, upcomingBills, recurringPayments, selectedMonth, period, hydrated])

  const historyWithSeed = useMemo(() => {
    const snap = buildSnapshot(income, expenses, customExpenses, netWorth)
    const merged = { ...history, [selectedMonth]: { ...snap, foodExpense: parseNum(expenses.food) } }
    return seedHistoryIfEmpty(merged, snap, selectedMonth)
  }, [history, income, expenses, customExpenses, netWorth, selectedMonth])

  const prevMonth = shiftMonth(selectedMonth, -1)
  const prev = historyWithSeed[prevMonth]

  const scaled = useMemo(() => ({
    totalIncome: scaleMetric(metrics.totalIncome, period),
    totalExpenses: scaleMetric(metrics.totalExpenses, period),
    monthlySavings: scaleMetric(metrics.monthlySavings, period),
    savingsRate: metrics.savingsRate,
    netWorth: metrics.netWorth,
  }), [metrics, period])

  const prevScaled = prev
    ? {
        totalIncome: scaleMetric(prev.totalIncome, period),
        totalExpenses: scaleMetric(prev.totalExpenses, period),
        monthlySavings: scaleMetric(prev.monthlySavings, period),
        savingsRate: prev.savingsRate,
        netWorth: prev.netWorth,
      }
    : null

  const sparkFromHistory = (key) => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const k = shiftMonth(selectedMonth, -i)
      months.push(historyWithSeed[k]?.[key] ?? (i === 0 ? metrics[key] : 0))
    }
    return months
  }

  const expenseItems = useMemo(() => {
    const items = Object.entries(EXPENSE_LABELS).map(([key, name]) => ({
      key, name, value: parseNum(expenses[key]),
    }))
    customExpenses.forEach((c) => {
      if (c.name?.trim()) items.push({ key: c.id, name: c.name.trim(), value: parseNum(c.amount) })
    })
    return items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  }, [expenses, customExpenses])

  const maxExpense = expenseItems[0]?.value || 1

  const incomeTrendData = useMemo(() => {
    const rows = []
    for (let i = 5; i >= 0; i--) {
      const k = shiftMonth(selectedMonth, -i)
      const h = historyWithSeed[k]
      const label = `${k.slice(5)}/${k.slice(2, 4)}`
      rows.push({
        month: label,
        income: scaleMetric(h?.totalIncome ?? (i === 0 ? metrics.totalIncome : 0), period),
        expenses: scaleMetric(h?.totalExpenses ?? (i === 0 ? metrics.totalExpenses : 0), period),
      })
    }
    return rows
  }, [historyWithSeed, selectedMonth, period, metrics])

  const insights = useMemo(
    () => generateInsights({ metrics, prev, scaled, savingsRate: metrics.savingsRate, expenseItems, goals: savingsGoals, periodLabel: PERIOD_LABELS[period] }),
    [metrics, prev, scaled, expenseItems, savingsGoals, period],
  )

  const health = useMemo(
    () => computeHealthScores(metrics, savingsGoals, parseNum(debt)),
    [metrics, savingsGoals, debt],
  )

  const healthTrend = prev
    ? pctChange(health.overall, Math.round((Math.min(100, prev.savingsRate * 1.2) + Math.min(100, (1 - prev.totalExpenses / Math.max(prev.totalIncome, 1)) * 100) + 50 + 100) / 4))
    : 0

  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 12; i++) opts.push(shiftMonth(monthKey(), -i))
    return opts
  }, [])

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions],
  )

  const removeCustomCategory = (id) => setCustomExpenses((p) => p.filter((c) => c.id !== id))

  const resetTxForm = () => {
    setTxDate(todayISO())
    setTxDescription('')
    setTxCategory('Food')
    setTxAmount('')
    setTxType('out')
  }

  const addTransaction = (e) => {
    e.preventDefault()
    const amount = parseNum(txAmount)
    if (!txDescription.trim() || amount <= 0) return
    const tx = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      label: txDescription.trim(),
      amount: String(amount),
      date: txDate,
      type: txType === 'in' ? 'in' : 'out',
      category: txCategory,
      ledgerApplied: true,
    }
    const updated = applyTransactionDelta(income, expenses, customExpenses, txCategory, tx.type, amount, 1)
    setIncome(updated.income)
    setExpenses(updated.expenses)
    setTransactions((prev) => [tx, ...prev])
    resetTxForm()
    setTxFormOpen(false)
  }

  const deleteTransaction = (id) => {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return
    if (tx.ledgerApplied) {
      const updated = applyTransactionDelta(income, expenses, customExpenses, tx.category || 'Other', tx.type, parseNum(tx.amount), -1)
      setIncome(updated.income)
      setExpenses(updated.expenses)
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  if (!hydrated) {
    return (
      <div className="fd-app" style={{ minHeight: '100vh', background: T.bg, padding: '32px 16px', color: T.textMuted, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}><p style={{ margin: 0 }}>Loading…</p></div>
      </div>
    )
  }

  return (
    <div className="fd-app">
      <style>{`
        .fd-app {
          --fd-bg: ${T.bg};
          --fd-card: ${T.card};
          --fd-border: ${T.border};
          min-height: 100vh;
          background: var(--fd-bg);
          color: ${T.text};
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          padding: 32px 16px 48px;
          box-sizing: border-box;
        }
        .fd-shell { max-width: 900px; margin: 0 auto; }
        .fd-topbar { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
        .fd-brand { font-size: 13px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: ${T.textMuted}; margin: 0 0 8px; }
        .fd-title { font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.03em; }
        .fd-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .fd-period-group { display: flex; background: ${T.card}; border: 1px solid var(--fd-border); border-radius: 12px; padding: 3px; }
        .fd-period-btn { padding: 6px 12px; font-size: 11px; font-weight: 500; color: ${T.textMuted}; background: transparent; border: none; border-radius: 8px; cursor: pointer; }
        .fd-period-btn--active { background: ${T.inputBg}; color: ${T.positive}; }
        .fd-month-select { padding: 8px 12px; font-size: 12px; color: ${T.text}; background: ${T.inputBg}; border: 1px solid ${T.inputBorder}; border-radius: 12px; outline: none; cursor: pointer; }
        .fd-sync-badge { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${T.textMuted}; padding: 8px 12px; border: 1px solid var(--fd-border); border-radius: 12px; background: ${T.card}; }
        .fd-summary-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (min-width: 768px) { .fd-summary-row { grid-template-columns: repeat(4, 1fr); } }
        .fd-summary-card { background: ${T.card}; border: 1px solid var(--fd-border); border-radius: 12px; padding: 20px; }
        .fd-summary-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .fd-summary-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.2em; color: ${T.textMuted}; }
        .fd-summary-value { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 8px; color: ${T.text}; }
        @media (min-width: 768px) { .fd-summary-value { font-size: 30px; } }
        .fd-summary-value--income, .fd-summary-value--savings { color: ${T.positive}; }
        .fd-summary-value--expense, .fd-summary-value--negative { color: ${T.negative}; }
        .fd-summary-value--neutral { color: ${T.text}; }
        .fd-trend { font-size: 11px; font-weight: 500; }
        .fd-trend--good { color: ${T.positive}; }
        .fd-trend--bad { color: ${T.negative}; }
        .fd-trend--neutral { color: ${T.textMuted}; }
        .fd-sparkline { opacity: 0.7; }
        .fd-card { background: ${T.card}; border: 1px solid var(--fd-border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .fd-section-title { font-size: 11px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: ${T.textMuted}; margin: 0 0 16px; padding-left: 12px; border-left: 2px solid ${T.accent}; }
        .fd-insights-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .fd-insight { display: flex; gap: 10px; padding: 12px 14px; border-radius: 12px; font-size: 13px; color: ${T.textSecondary}; border: 1px solid var(--fd-border); }
        .fd-insight--positive { border-color: rgba(16,185,129,0.2); background: ${T.positiveMuted}; }
        .fd-insight--warning { border-color: rgba(244,63,94,0.2); background: ${T.negativeMuted}; }
        .fd-insight--tip { border-color: rgba(16,185,129,0.15); background: ${T.positiveMuted}; }
        .fd-chart-wrap { width: 100%; height: 192px; }
        .fd-two-col { display: grid; gap: 20px; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .fd-two-col { grid-template-columns: 1fr 1fr; } }
        .fd-three-col { display: grid; gap: 20px; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .fd-three-col { grid-template-columns: repeat(3, 1fr); } }
        .fd-expense-row { margin-bottom: 16px; }
        .fd-expense-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .fd-expense-name { font-size: 13px; color: ${T.textSecondary}; }
        .fd-expense-amt { font-size: 13px; font-weight: 600; color: ${T.negative}; }
        .fd-expense-pct { font-size: 11px; color: ${T.textMuted}; margin-left: 6px; }
        .fd-expense-track { height: 6px; background: ${T.track}; border-radius: 999px; overflow: hidden; }
        .fd-expense-fill { height: 100%; background: ${T.negative}; border-radius: 999px; transition: width 0.4s ease; }
        .fd-goal { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--fd-border); }
        .fd-goal:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
        .fd-goal-head { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .fd-goal-name { font-weight: 600; font-size: 13px; }
        .fd-goal-amt { font-size: 12px; color: ${T.textMuted}; }
        .fd-goal-meta { display: flex; justify-content: space-between; font-size: 11px; color: ${T.textMuted}; margin-top: 8px; }
        .fd-progress-track { height: 6px; background: ${T.track}; border-radius: 999px; overflow: hidden; }
        .fd-progress-fill { height: 100%; background: ${T.positive}; border-radius: 999px; transition: width 0.4s ease; }
        .fd-list-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--fd-border); position: relative; }
        .fd-list-item:hover .fd-tx-delete { opacity: 1; }
        .fd-list-item:last-child { border-bottom: none; }
        .fd-list-label { font-size: 13px; color: ${T.text}; }
        .fd-list-sub { font-size: 11px; color: ${T.textMuted}; margin-top: 2px; }
        .fd-list-amt { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .fd-list-amt--in { color: ${T.positive}; }
        .fd-list-amt--out { color: ${T.negative}; }
        .fd-tx-delete { position: absolute; right: 0; top: 50%; transform: translateY(-50%); padding: 4px 8px; font-size: 14px; line-height: 1; color: ${T.textMuted}; background: ${T.inputBg}; border: 1px solid var(--fd-border); border-radius: 6px; cursor: pointer; opacity: 0; transition: opacity 0.15s, color 0.15s; }
        .fd-tx-delete:hover { color: ${T.negative}; border-color: rgba(244,63,94,0.35); }
        .fd-list-item--tx { padding-right: 36px; }
        .fd-tx-add-btn { width: 100%; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; font-weight: 600; color: ${T.positive}; background: transparent; border: 1px dashed rgba(16,185,129,0.4); border-radius: 8px; cursor: pointer; }
        .fd-tx-add-btn:hover { background: ${T.positiveMuted}; }
        .fd-tx-form { padding: 16px 0 8px; margin-bottom: 12px; border-top: 1px solid var(--fd-border); border-bottom: 1px solid var(--fd-border); }
        .fd-label { display: block; font-size: 11px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: ${T.textMuted}; margin-bottom: 8px; }
        .fd-input { width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 13px; color: ${T.text}; background: ${T.inputBg}; border: 1px solid ${T.inputBorder}; border-radius: 8px; outline: none; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
        .fd-input:focus { border-color: #3a3a3a; }
        .fd-input--inline { max-width: 108px; margin-bottom: 0; }
        .fd-tx-toggle { display: flex; gap: 8px; margin-bottom: 12px; }
        .fd-tx-toggle-btn { flex: 1; padding: 9px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 8px; border: 1px solid ${T.inputBorder}; cursor: pointer; background: ${T.inputBg}; color: ${T.textMuted}; }
        .fd-tx-toggle-btn--in-active { background: ${T.positiveMuted}; color: ${T.positive}; border-color: rgba(16,185,129,0.35); }
        .fd-tx-toggle-btn--out-active { background: ${T.negativeMuted}; color: ${T.negative}; border-color: rgba(244,63,94,0.35); }
        .fd-btn-primary { padding: 10px 16px; font-size: 12px; font-weight: 600; color: ${T.bg}; background: ${T.positive}; border: none; border-radius: 8px; cursor: pointer; }
        .fd-btn-ghost { padding: 6px 10px; font-size: 11px; color: ${T.textMuted}; background: transparent; border: 1px solid var(--fd-border); border-radius: 8px; cursor: pointer; }
        .fd-health-score { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .fd-health-score span { font-size: 14px; color: ${T.textMuted}; font-weight: 500; }
        .fd-health-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media (min-width: 600px) { .fd-health-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 768px) { .fd-health-grid { grid-template-columns: repeat(4, 1fr); } }
        .fd-health-item label { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${T.textMuted}; margin-bottom: 8px; }
        .fd-form-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--fd-border); }
        .fd-form-row label { flex: 0 0 96px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.textMuted}; }
        .fd-forms-toggle { width: 100%; padding: 14px 20px; margin-bottom: 20px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: ${T.textMuted}; background: ${T.card}; border: 1px solid var(--fd-border); border-radius: 12px; cursor: pointer; text-align: left; }
        .fd-forms-grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .fd-forms-grid { grid-template-columns: 1fr 1fr; } }
        .fd-add-line { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .fd-empty { font-size: 12px; color: ${T.textMuted}; text-align: center; padding: 16px; }
        .fd-tooltip { background: ${T.card}; border: 1px solid var(--fd-border); border-radius: 12px; padding: 12px 16px; }
        .fd-tooltip-label { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: ${T.textMuted}; margin-bottom: 8px; }
        .fd-tooltip-row { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-top: 4px; }
        .fd-tooltip-dot { width: 6px; height: 6px; border-radius: 1px; }
        .fd-tooltip-name { flex: 1; color: ${T.textMuted}; }
        .fd-tooltip-value { font-weight: 600; color: ${T.text}; }
        .recharts-cartesian-grid-horizontal line { stroke: ${T.gridLine}; }
        .recharts-text { fill: ${T.textMuted}; font-size: 10px; }
      `}</style>

      <div className="fd-shell">
        <header className="fd-topbar">
          <div>
            <p className="fd-brand">Personal Finance</p>
            <h1 className="fd-title">Dashboard</h1>
          </div>
          <div className="fd-controls">
            <div className="fd-period-group" role="tablist">
              {PERIODS.map((p) => (
                <button key={p} type="button" role="tab" aria-selected={period === p}
                  className={`fd-period-btn ${period === p ? 'fd-period-btn--active' : ''}`}
                  onClick={() => setPeriod(p)}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <select className="fd-month-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} aria-label="Select month">
              {monthOptions.map((m) => (<option key={m} value={m}>{formatMonthLabel(m)}</option>))}
            </select>
            <span className="fd-sync-badge">● Auto-saved</span>
            <button type="button" onClick={() => supabase.auth.signOut()} style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F43F5E', padding: '6px 14px', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', marginLeft: 8 }}>Sign out</button>
          </div>
        </header>

        <div className="fd-summary-row">
          <SummaryCard label="Net Worth" value={formatCompact(scaled.netWorth)} change={pctChange(scaled.netWorth, prevScaled?.netWorth ?? 0)} sparkData={sparkFromHistory('netWorth')} valueClass="fd-summary-value--neutral" />
          <SummaryCard label="Monthly Savings" value={formatCurrency(scaled.monthlySavings)} change={pctChange(scaled.monthlySavings, prevScaled?.monthlySavings ?? 0)} sparkData={sparkFromHistory('monthlySavings')} valueClass="fd-summary-value--savings" />
          <SummaryCard label="Cash Flow" value={`${scaled.monthlySavings >= 0 ? '+' : ''}${formatCurrency(scaled.monthlySavings)}`} change={pctChange(scaled.monthlySavings, prevScaled?.monthlySavings ?? 0)} sparkData={sparkFromHistory('monthlySavings')} valueClass={scaled.monthlySavings >= 0 ? 'fd-summary-value--income' : 'fd-summary-value--negative'} />
          <SummaryCard label="Savings Rate" value={`${metrics.savingsRate.toFixed(1)}%`} change={pctChange(metrics.savingsRate, prev?.savingsRate ?? 0)} sparkData={sparkFromHistory('savingsRate')} valueClass="fd-summary-value--savings" />
        </div>

        <Card>
          <SectionHeader>Insights</SectionHeader>
          {insights.length === 0 ? (
            <p className="fd-empty">Add income and expenses to generate insights.</p>
          ) : (
            <ul className="fd-insights-list">
              {insights.map((item, i) => (
                <li key={i} className={`fd-insight fd-insight--${item.type === 'positive' ? 'positive' : item.type === 'warning' ? 'warning' : item.type === 'tip' ? 'tip' : ''}`}>
                  <span>
                    {item.type === 'positive' ? '✅ ' : item.type === 'warning' ? '⚠️ ' : item.type === 'tip' ? '💡 ' : '• '}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader>Income trend</SectionHeader>
          <div className="fd-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incomeTrendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: T.border }} />
                <Area type="monotone" dataKey="income" name="Income" stroke={T.positive} fill={T.positive} fillOpacity={0.08} strokeWidth={1.5} {...CHART_ANIMATION} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={T.negative} fill={T.negative} fillOpacity={0.06} strokeWidth={1.5} {...CHART_ANIMATION} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
<div className="fd-two-col">
          <Card>
            <SectionHeader>Expenses</SectionHeader>
            {expenseItems.length === 0 ? (
              <p className="fd-empty">No expenses entered</p>
            ) : (
              expenseItems.map((item) => {
                const pct = metrics.totalExpenses > 0 ? ((item.value / metrics.totalExpenses) * 100).toFixed(0) : 0
                return (
                  <div key={item.key} className="fd-expense-row">
                    <div className="fd-expense-head">
                      <span className="fd-expense-name">{item.name}<span className="fd-expense-pct">{pct}%</span></span>
                      <span className="fd-expense-amt">{formatCompact(item.value)}</span>
                    </div>
                    <div className="fd-expense-track">
                      <div className="fd-expense-fill" style={{ width: `${(item.value / maxExpense) * 100}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </Card>

          <Card>
            <SectionHeader>Savings goals</SectionHeader>
            {savingsGoals.map((goal) => (
              <EditableGoal
                key={goal.id}
                goal={goal}
                monthlySavings={metrics.monthlySavings}
                onSave={(updated) => setSavingsGoals((p) => p.map((g) => g.id === goal.id ? updated : g))}
                onDelete={() => setSavingsGoals((p) => p.filter((g) => g.id !== goal.id))}
              />
            ))}
            <AddItemRow
              fields={[
                { key: 'name', label: 'Goal name', type: 'text' },
                { key: 'current', label: 'Current amount (₹)', type: 'number' },
                { key: 'target', label: 'Target amount (₹)', type: 'number' },
                { key: 'monthlyContribution', label: 'Monthly contribution (₹)', type: 'number' },
              ]}
              onAdd={(vals) => setSavingsGoals((p) => [...p, { id: crypto.randomUUID?.() ?? String(Date.now()), ...vals }])}
            />
          </Card>
        </div>

        <div className="fd-three-col">
          <Card>
            <SectionHeader>Recent transactions</SectionHeader>
            <button type="button" className="fd-tx-add-btn" onClick={() => setTxFormOpen((o) => !o)} aria-expanded={txFormOpen}>
              {txFormOpen ? '− Cancel' : '+ Add Transaction'}
            </button>
            {txFormOpen && (
              <form className="fd-tx-form" onSubmit={addTransaction}>
                <label className="fd-label" htmlFor="tx-date">Date</label>
                <input id="tx-date" className="fd-input" type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
                <label className="fd-label" htmlFor="tx-desc">Description</label>
                <input id="tx-desc" className="fd-input" type="text" placeholder="What was this for?" value={txDescription} onChange={(e) => setTxDescription(e.target.value)} />
                <label className="fd-label" htmlFor="tx-cat">Category</label>
                <select id="tx-cat" className="fd-input" value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                  {TX_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                <label className="fd-label" htmlFor="tx-amt">Amount</label>
                <MoneyInput value={txAmount} onChange={setTxAmount} />
                <span className="fd-label">Type</span>
                <div className="fd-tx-toggle">
                  <button type="button" className={`fd-tx-toggle-btn ${txType === 'in' ? 'fd-tx-toggle-btn--in-active' : ''}`} onClick={() => setTxType('in')}>Income</button>
                  <button type="button" className={`fd-tx-toggle-btn ${txType === 'out' ? 'fd-tx-toggle-btn--out-active' : ''}`} onClick={() => setTxType('out')}>Expense</button>
                </div>
                <button type="submit" className="fd-btn-primary">Save transaction</button>
              </form>
            )}
            {sortedTransactions.length === 0 ? (
              <p className="fd-empty">No transactions yet</p>
            ) : (
              sortedTransactions.map((t) => (
                <div key={t.id} className="fd-list-item fd-list-item--tx">
                  <div>
                    <div className="fd-list-label">{t.label}</div>
                    <div className="fd-list-sub">{t.category || 'Other'} · {formatTxDate(t.date)}</div>
                  </div>
                  <span className={`fd-list-amt fd-list-amt--${t.type === 'in' ? 'in' : 'out'}`}>
                    {t.type === 'in' ? '+' : '−'}{formatCurrency(parseNum(t.amount))}
                  </span>
                  <button type="button" className="fd-tx-delete" onClick={() => deleteTransaction(t.id)} aria-label={`Delete ${t.label}`}>✕</button>
                </div>
              ))
            )}
          </Card>

          <Card>
            <SectionHeader>Upcoming bills</SectionHeader>
            {upcomingBills.map((b) => (
              <EditableListItem
                key={b.id}
                item={b}
                fields={[
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'amount', label: 'Amount', type: 'number' },
                  { key: 'due', label: 'Due date', type: 'date' },
                ]}
                onSave={(updated) => setUpcomingBills((p) => p.map((x) => x.id === b.id ? updated : x))}
                onDelete={() => setUpcomingBills((p) => p.filter((x) => x.id !== b.id))}
                renderRow={(item) => (
                  <>
                    <div><div className="fd-list-label">{item.name}</div><div className="fd-list-sub">Due {item.due}</div></div>
                    <span className="fd-list-amt fd-list-amt--out">{formatCurrency(parseNum(item.amount))}</span>
                  </>
                )}
              />
            ))}
            <AddItemRow
              fields={[
                { key: 'name', label: 'Bill name', type: 'text' },
                { key: 'amount', label: 'Amount', type: 'number' },
                { key: 'due', label: 'Due date', type: 'date' },
              ]}
              onAdd={(vals) => setUpcomingBills((p) => [...p, { id: crypto.randomUUID?.() ?? String(Date.now()), ...vals }])}
            />
          </Card>

          <Card>
            <SectionHeader>Recurring payments</SectionHeader>
            {recurringPayments.map((r) => (
              <EditableListItem
                key={r.id}
                item={r}
                fields={[
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'amount', label: 'Amount', type: 'number' },
                  { key: 'cadence', label: 'Cadence', type: 'text' },
                ]}
                onSave={(updated) => setRecurringPayments((p) => p.map((x) => x.id === r.id ? updated : x))}
                onDelete={() => setRecurringPayments((p) => p.filter((x) => x.id !== r.id))}
                renderRow={(item) => (
                  <>
                    <div><div className="fd-list-label">{item.name}</div><div className="fd-list-sub">{item.cadence}</div></div>
                    <span className="fd-list-amt fd-list-amt--out">{formatCurrency(parseNum(item.amount))}</span>
                  </>
                )}
              />
            ))}
            <AddItemRow
              fields={[
                { key: 'name', label: 'Payment name', type: 'text' },
                { key: 'amount', label: 'Amount', type: 'number' },
                { key: 'cadence', label: 'Cadence', type: 'text', placeholder: 'Monthly' },
              ]}
              onAdd={(vals) => setRecurringPayments((p) => [...p, { id: crypto.randomUUID?.() ?? String(Date.now()), ...vals }])}
            />
          </Card>
        </div>

        <Card>
          <SectionHeader>Financial health</SectionHeader>
          <div style={{ marginBottom: 20 }}>
            <div className="fd-health-score">{health.overall}<span> / 100</span></div>
            <TrendBadge change={healthTrend} />
          </div>
          <div className="fd-health-grid">
            {[['Savings', health.savings], ['Spending', health.spending], ['Emergency fund', health.emergency], ['Debt', health.debt]].map(([label, score]) => (
              <div key={label} className="fd-health-item">
                <label><span>{label}</span><strong>{score}</strong></label>
                <div className="fd-progress-track"><div className="fd-progress-fill" style={{ width: `${score}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="fd-form-row" style={{ marginTop: 16, border: 'none' }}>
            <label>Net worth (₹)</label>
            <MoneyInput value={netWorth} onChange={setNetWorth} />
          </div>
          <div className="fd-form-row" style={{ border: 'none' }}>
            <label>Total debt (₹)</label>
            <MoneyInput value={debt} onChange={setDebt} />
          </div>
        </Card>

        <button type="button" className="fd-forms-toggle" onClick={() => setFormsOpen((o) => !o)} aria-expanded={formsOpen}>
          {formsOpen ? '▼' : '▶'} Edit income & expenses
        </button>

        {formsOpen && (
          <div className="fd-forms-grid">
            <Card>
              <SectionHeader>Income sources</SectionHeader>
              {Object.entries(INCOME_LABELS).map(([key, label]) => (
                <div key={key} className="fd-form-row">
                  <label htmlFor={`inc-${key}`}>{label}</label>
                  <MoneyInput value={income[key]} onChange={(v) => setIncome((p) => ({ ...p, [key]: v }))} />
                </div>
              ))}
              {(income.custom || []).map((c) => (
                <div key={c.id} className="fd-form-row">
                  <label>{c.name}</label>
                  <MoneyInput compact value={c.amount} onChange={(v) => setIncome((p) => ({ ...p, custom: p.custom.map((x) => x.id === c.id ? { ...x, amount: v } : x) }))} />
                  <button type="button" className="fd-btn-ghost" onClick={() => setIncome((p) => ({ ...p, custom: p.custom.filter((x) => x.id !== c.id) }))}>×</button>
                </div>
              ))}
              <div className="fd-add-line">
                <input className="fd-input" placeholder="Source name" value={newIncName} onChange={(e) => setNewIncName(e.target.value)} />
                <MoneyInput compact value={newIncAmount} onChange={setNewIncAmount} />
                <button type="button" className="fd-btn-primary" onClick={() => {
                  const name = newIncName.trim()
                  if (!name) return
                  setIncome((p) => ({ ...p, custom: [...(p.custom || []), { id: crypto.randomUUID?.() ?? String(Date.now()), name, amount: newIncAmount }] }))
                  setNewIncName('')
                  setNewIncAmount('')
                }}>+ Add</button>
              </div>
            </Card>

            <Card>
              <SectionHeader>Expenses</SectionHeader>
              {Object.entries(EXPENSE_LABELS).map(([key, label]) => (
                <div key={key} className="fd-form-row">
                  <label htmlFor={`exp-${key}`}>{label}</label>
                  <MoneyInput value={expenses[key]} onChange={(v) => setExpenses((p) => ({ ...p, [key]: v }))} />
                </div>
              ))}
              {customExpenses.map((c) => (
                <div key={c.id} className="fd-form-row">
                  <label>{c.name}</label>
                  <MoneyInput compact value={c.amount} onChange={(v) => setCustomExpenses((p) => p.map((x) => x.id === c.id ? { ...x, amount: v } : x))} />
                  <button type="button" className="fd-btn-ghost" onClick={() => removeCustomCategory(c.id)}>×</button>
                </div>
              ))}
              <div className="fd-add-line">
                <input className="fd-input" placeholder="Category" value={newExpName} onChange={(e) => setNewExpName(e.target.value)} />
                <MoneyInput compact value={newExpAmount} onChange={setNewExpAmount} />
                <button type="button" className="fd-btn-primary" onClick={() => {
                  const name = newExpName.trim()
                  if (!name) return
                  setCustomExpenses((p) => [...p, { id: crypto.randomUUID?.() ?? String(Date.now()), name, amount: newExpAmount }])
                  setNewExpName('')
                  setNewExpAmount('')
                }}>+ Add category</button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
