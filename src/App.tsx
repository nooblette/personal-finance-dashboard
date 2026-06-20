import { PointerEvent, ReactElement, ReactNode, WheelEvent as ReactWheelEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Area,
  AreaChart,
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
import { ArrowDownRight, ArrowUpRight, ChevronDown, Clipboard, Maximize2, Minus, Moon, Plus, RefreshCw, Sun, Trash2, Wallet } from "lucide-react";

type ExpenseCategory = string;
type AccountType = "급여통장" | "생활비통장" | "투자계좌" | "비상금통장";
type Period = "monthly" | "yearly";

type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  paymentMethod: string;
  bank?: string;
  account?: string;
  cardIssuer?: string;
  cardName?: string;
};
type PaymentKind = "card" | "transfer" | "other";
type VariableExpense = { id: string; date: string; category: ExpenseCategory; amount: number; memo: string };
type SideIncome = { id: string; name: string; amount: number };
type InvestmentProduct = { id: string; destination: string; broker: string; ratio: number };
type Account = { id: string; bank: string; name: string; number: string; type: AccountType };
type Card = { id: string; name: string; issuer: string; settlementAccount: string };
type FlowPosition = { x: number; y: number };
type FlowNode = { id: string; title: string; subtitle: string; x: number; y: number; tone: "teal" | "indigo" | "amber" | "zinc"; brand?: string };
type FlowEdge = { from: string; to: string };

type DashboardData = {
  principles: string;
  salary: number;
  sideIncomes: SideIncome[];
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  investmentProducts: InvestmentProduct[];
  accounts: Account[];
  cards: Card[];
  investmentBase: number | null;
  expenseCategories: string[];
  analysisPeriod: Period;
  darkMode: boolean;
  flowPositions: Record<string, FlowPosition>;
};

const STORAGE_KEY = "personal-finance-dashboard:v1";
const ViewModeContext = createContext(false);
const useReadOnly = () => useContext(ViewModeContext);
type Mode = "view" | "edit";
const defaultExpenseCategories: string[] = ["식비", "병원", "의류", "여행", "경조사", "기타"];
const paymentMethodOptions: string[] = ["카드", "계좌이체", "자동이체", "현금", "기타"];

function paymentKind(method: string): PaymentKind {
  if (method.includes("카드")) return "card";
  if (method.includes("이체")) return "transfer";
  return "other";
}
const exceptionCategories: string[] = ["병원", "경조사", "의류", "여행"];
const accountTypes: AccountType[] = ["급여통장", "생활비통장", "투자계좌", "비상금통장"];

type BrandStyle = { label: string; bg: string; fg: string };
const brandTable: Record<string, BrandStyle> = {
  "농협": { label: "NH", bg: "bg-green-600", fg: "text-white" },
  "NH농협": { label: "NH", bg: "bg-green-600", fg: "text-white" },
  "국민은행": { label: "KB", bg: "bg-yellow-400", fg: "text-zinc-900" },
  "KB국민": { label: "KB", bg: "bg-yellow-400", fg: "text-zinc-900" },
  "신한": { label: "신한", bg: "bg-blue-700", fg: "text-white" },
  "신한은행": { label: "신한", bg: "bg-blue-700", fg: "text-white" },
  "우리은행": { label: "우리", bg: "bg-sky-700", fg: "text-white" },
  "하나": { label: "하나", bg: "bg-teal-700", fg: "text-white" },
  "하나은행": { label: "하나", bg: "bg-teal-700", fg: "text-white" },
  "카카오뱅크": { label: "kakao", bg: "bg-yellow-300", fg: "text-zinc-900" },
  "토스뱅크": { label: "toss", bg: "bg-blue-500", fg: "text-white" },
  "토스": { label: "toss", bg: "bg-blue-500", fg: "text-white" },
  "IBK기업": { label: "IBK", bg: "bg-blue-600", fg: "text-white" },
  "SC제일": { label: "SC", bg: "bg-emerald-700", fg: "text-white" },
  "미래에셋": { label: "미래", bg: "bg-orange-500", fg: "text-white" },
  "한국투자": { label: "한투", bg: "bg-red-600", fg: "text-white" },
  "삼성카드": { label: "삼성", bg: "bg-blue-800", fg: "text-white" },
  "삼성": { label: "삼성", bg: "bg-blue-800", fg: "text-white" },
  "현대카드": { label: "현대", bg: "bg-zinc-900", fg: "text-white" },
  "현대": { label: "현대", bg: "bg-zinc-900", fg: "text-white" },
  "신한카드": { label: "신한", bg: "bg-blue-700", fg: "text-white" },
  "롯데카드": { label: "롯데", bg: "bg-red-700", fg: "text-white" },
  "BC카드": { label: "BC", bg: "bg-rose-600", fg: "text-white" },
  "하나카드": { label: "하나", bg: "bg-teal-700", fg: "text-white" },
  "우리카드": { label: "우리", bg: "bg-sky-700", fg: "text-white" },
  "국민카드": { label: "KB", bg: "bg-yellow-400", fg: "text-zinc-900" },
};

function brandStyle(brand?: string): BrandStyle {
  if (!brand) return { label: "?", bg: "bg-zinc-300 dark:bg-zinc-700", fg: "text-zinc-700 dark:text-zinc-200" };
  const direct = brandTable[brand];
  if (direct) return direct;
  const key = Object.keys(brandTable).find((name) => brand.includes(name));
  if (key) return brandTable[key];
  return { label: brand.slice(0, 2), bg: "bg-zinc-400 dark:bg-zinc-600", fg: "text-white" };
}
const format = new Intl.NumberFormat("ko-KR");
const newId = () => crypto.randomUUID();
const won = (value: number) => `${format.format(Math.round(value || 0))}원`;
const toNumber = (value: string) => Number(value.replace(/,/g, "")) || 0;

const defaultData: DashboardData = {
  principles: "- 현금 500만원 유지\n- 병원비는 현금 사용\n- 경조사비는 현금 사용\n- 여행비는 현금 사용\n- 익월 급여일에 현금 복구",
  salary: 4200000,
  sideIncomes: [{ id: newId(), name: "부수입", amount: 300000 }],
  fixedExpenses: [
    { id: newId(), name: "월세", amount: 800000, paymentMethod: "계좌이체" },
    { id: newId(), name: "통신비", amount: 80000, paymentMethod: "카드" },
    { id: newId(), name: "보험", amount: 120000, paymentMethod: "자동이체" },
    { id: newId(), name: "넷플릭스", amount: 17000, paymentMethod: "카드" },
  ],
  variableExpenses: [
    { id: newId(), date: "2026-05-03", category: "식비", amount: 180000, memo: "장보기" },
    { id: newId(), date: "2026-05-09", category: "병원", amount: 75000, memo: "진료" },
    { id: newId(), date: "2026-05-17", category: "경조사", amount: 100000, memo: "축의금" },
    { id: newId(), date: "2026-04-20", category: "여행", amount: 280000, memo: "숙소 예약" },
  ],
  investmentProducts: [
    { id: newId(), destination: "ISA S&P500", broker: "미래에셋", ratio: 50 },
    { id: newId(), destination: "QQQ", broker: "한국투자", ratio: 10 },
    { id: newId(), destination: "NVIDIA", broker: "한국투자", ratio: 10 },
    { id: newId(), destination: "Alphabet", broker: "한국투자", ratio: 5 },
    { id: newId(), destination: "SGOV", broker: "미래에셋", ratio: 25 },
  ],
  accounts: [
    { id: newId(), bank: "농협", name: "급여통장", number: "000-0000-0000", type: "급여통장" },
    { id: newId(), bank: "국민은행", name: "생활비통장", number: "111-1111-1111", type: "생활비통장" },
    { id: newId(), bank: "미래에셋", name: "ISA", number: "222-2222-2222", type: "투자계좌" },
    { id: newId(), bank: "한국투자", name: "해외주식", number: "333-3333-3333", type: "투자계좌" },
  ],
  cards: [
    { id: newId(), name: "현대카드 Zero", issuer: "현대카드", settlementAccount: "농협 급여통장" },
    { id: newId(), name: "삼성카드", issuer: "삼성카드", settlementAccount: "국민은행 생활비통장" },
  ],
  investmentBase: null,
  expenseCategories: defaultExpenseCategories,
  analysisPeriod: "monthly",
  darkMode: false,
  flowPositions: {},
};

function loadData(): DashboardData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultData;
    const parsed = JSON.parse(saved) as Partial<DashboardData> & { sideIncome?: number };
    const next = { ...defaultData, ...parsed } as DashboardData;
    if (next.analysisPeriod !== "monthly" && next.analysisPeriod !== "yearly") next.analysisPeriod = "monthly";
    if (!Array.isArray(next.expenseCategories) || next.expenseCategories.length === 0) {
      next.expenseCategories = defaultExpenseCategories;
    }
    if (!Array.isArray(next.sideIncomes)) {
      const legacy = typeof parsed.sideIncome === "number" ? parsed.sideIncome : 0;
      next.sideIncomes = legacy > 0 ? [{ id: newId(), name: "부수입", amount: legacy }] : [];
    }
    if (next.investmentBase === undefined) next.investmentBase = null;
    return next;
  } catch {
    return defaultData;
  }
}

export default function App() {
  const [savedData, setSavedData] = useState<DashboardData>(loadData);
  const [draft, setDraft] = useState<DashboardData>(() => savedData);
  const [mode, setMode] = useState<Mode>("view");
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [copyLabel, setCopyLabel] = useState("복사");
  const [variableDetailOpen, setVariableDetailOpen] = useState(false);
  const isView = mode === "view";
  const data = isView ? savedData : draft;
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedData), [draft, savedData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
  }, [savedData]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", data.darkMode);
  }, [data.darkMode]);

  useEffect(() => {
    if (mode === "edit") setDraft(savedData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const setData = (updater: (current: DashboardData) => DashboardData) => {
    if (isView) setSavedData(updater);
    else setDraft(updater);
  };

  const saveDraft = () => setSavedData(draft);
  const discardDraft = () => setDraft(savedData);
  const requestMode = (next: Mode) => {
    if (next === mode) return;
    if (mode === "edit" && isDirty) {
      setPendingMode(next);
      return;
    }
    setMode(next);
  };
  const resolvePending = (action: "save" | "discard" | "cancel") => {
    if (action === "cancel" || pendingMode === null) {
      setPendingMode(null);
      return;
    }
    if (action === "save") setSavedData(draft);
    if (action === "discard") setDraft(savedData);
    setMode(pendingMode);
    setPendingMode(null);
  };

  const totalSideIncome = data.sideIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = data.salary + totalSideIncome;
  const investmentBaseAmount = data.investmentBase ?? Math.max(totalIncome - data.fixedExpenses.reduce((sum, item) => sum + item.amount, 0), 0);
  const totalFixed = data.fixedExpenses.reduce((sum, item) => sum + item.amount, 0);
  const disposableIncome = totalIncome - totalFixed;
  const totalInvestmentRatio = data.investmentProducts.reduce((sum, item) => sum + item.ratio, 0);

  const variableByMonth = useMemo(() => {
    const groups = data.variableExpenses.reduce<Record<string, number>>((acc, item) => {
      const key = item.date.slice(0, 7) || "미지정";
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {});
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));
  }, [data.variableExpenses]);

  const variableMonthlyAverage = variableByMonth.length
    ? Math.round(variableByMonth.reduce((sum, item) => sum + item.amount, 0) / variableByMonth.length)
    : 0;
  const variableMonthlyMax = variableByMonth.reduce((max, item) => Math.max(max, item.amount), 0);

  const exceptionStats = useMemo(() => {
    const empty = () => ({ 병원: 0, 경조사: 0, 의류: 0, 여행: 0 });
    const groups = data.variableExpenses
      .filter((item) => exceptionCategories.includes(item.category))
      .reduce<Record<string, ReturnType<typeof empty>>>((acc, item) => {
        const date = new Date(`${item.date}T00:00:00`);
        const key = data.analysisPeriod === "yearly" ? `${date.getFullYear()}` : item.date.slice(0, 7);
        acc[key] = acc[key] || empty();
        acc[key][item.category as keyof ReturnType<typeof empty>] += item.amount;
        return acc;
      }, {});
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({ period, ...values }));
  }, [data.variableExpenses, data.analysisPeriod]);

  const investmentsByBroker = useMemo(() => {
    return data.investmentProducts.reduce<Record<string, InvestmentProduct[]>>((acc, item) => {
      const broker = item.broker || "미지정";
      acc[broker] = acc[broker] || [];
      acc[broker].push(item);
      return acc;
    }, {});
  }, [data.investmentProducts]);

  const executionText = useMemo(() => {
    const lines = ["이번 달 투자", ""];
    Object.entries(investmentsByBroker).forEach(([broker, items]) => {
      lines.push(broker);
      items.forEach((item) => lines.push(`- ${item.destination || "투자상품"} ${won(investmentBaseAmount * (item.ratio / 100))}`));
      lines.push("");
    });
    return lines.join("\n").trim();
  }, [investmentBaseAmount, investmentsByBroker]);

  const expenseFlow = useMemo(() => {
    const position = (key: string, fallback: FlowPosition) => data.flowPositions[key] || fallback;
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const salary = data.accounts.find((item) => item.type === "급여통장");
    const living = data.accounts.find((item) => item.type === "생활비통장");
    const investments = data.accounts.filter((item) => item.type === "투자계좌");
    const others = data.accounts.filter((item) => item.type === "비상금통장");
    const accountLabel = (item: Account) => `${item.bank} ${item.name}`.trim() || item.type;

    if (salary) {
      const key = flowKey("account", salary.id);
      nodes.push({ id: key, title: accountLabel(salary), subtitle: salary.type, tone: "teal", brand: salary.bank, ...position(key, { x: 28, y: 150 }) });
    }
    if (living) {
      const key = flowKey("account", living.id);
      nodes.push({ id: key, title: accountLabel(living), subtitle: living.type, tone: "indigo", brand: living.bank, ...position(key, { x: 300, y: 150 }) });
    }
    investments.forEach((item, index) => {
      const key = flowKey("account", item.id);
      nodes.push({ id: key, title: accountLabel(item), subtitle: item.type, tone: "amber", brand: item.bank, ...position(key, { x: 570, y: 40 + index * 110 }) });
    });
    others.forEach((item, index) => {
      const key = flowKey("account", item.id);
      nodes.push({ id: key, title: accountLabel(item), subtitle: item.type, tone: "indigo", brand: item.bank, ...position(key, { x: 570, y: 380 + index * 110 }) });
    });

    if (salary && living) edges.push({ from: flowKey("account", salary.id), to: flowKey("account", living.id) });
    if (living) investments.forEach((item) => edges.push({ from: flowKey("account", living.id), to: flowKey("account", item.id) }));

    const matchAccount = (settlement: string) => {
      const trimmed = settlement.trim();
      if (!trimmed) return undefined;
      return data.accounts.find((item) => {
        const label = accountLabel(item);
        return label === trimmed || label.includes(trimmed) || trimmed.includes(label) || trimmed.includes(item.bank) || trimmed.includes(item.name);
      });
    };

    data.cards.forEach((card, index) => {
      const cardKey = flowKey("card", card.id);
      nodes.push({ id: cardKey, title: card.name || "카드", subtitle: card.issuer || "카드사", tone: "zinc", brand: card.issuer, ...position(cardKey, { x: 28, y: 320 + index * 110 }) });
      const matched = matchAccount(card.settlementAccount || "");
      if (matched) {
        edges.push({ from: cardKey, to: flowKey("account", matched.id) });
      } else if (card.settlementAccount) {
        const settleKey = flowKey("settlement", card.settlementAccount);
        if (!nodes.find((node) => node.id === settleKey)) {
          nodes.push({ id: settleKey, title: card.settlementAccount, subtitle: "결제계좌", tone: "zinc", brand: card.settlementAccount, ...position(settleKey, { x: 300, y: 320 + index * 110 }) });
        }
        edges.push({ from: cardKey, to: settleKey });
      }
    });
    return { nodes, edges };
  }, [data.accounts, data.cards, data.flowPositions]);

  const patch = <K extends keyof DashboardData>(key: K, value: DashboardData[K]) => setData((current) => ({ ...current, [key]: value }));
  const copyExecution = async () => {
    await navigator.clipboard.writeText(executionText);
    setCopyLabel("복사됨");
    window.setTimeout(() => setCopyLabel("복사"), 1200);
  };

  const updateFixed = (id: string, item: Partial<FixedExpense>) =>
    patch("fixedExpenses", data.fixedExpenses.map((row) => (row.id === id ? { ...row, ...item } : row)));
  const updateVariable = (id: string, item: Partial<VariableExpense>) =>
    patch("variableExpenses", data.variableExpenses.map((row) => (row.id === id ? { ...row, ...item } : row)));
  const updateInvestment = (id: string, item: Partial<InvestmentProduct>) => {
    const next = data.investmentProducts.map((row) => (row.id === id ? { ...row, ...item } : row));
    if (next.reduce((sum, row) => sum + row.ratio, 0) <= 100) patch("investmentProducts", next);
  };
  const updateAccount = (id: string, item: Partial<Account>) => patch("accounts", data.accounts.map((row) => (row.id === id ? { ...row, ...item } : row)));
  const updateCard = (id: string, item: Partial<Card>) => patch("cards", data.cards.map((row) => (row.id === id ? { ...row, ...item } : row)));
  const updateFlowPosition = (nodeId: string, position: FlowPosition) => {
    patch("flowPositions", { ...data.flowPositions, [nodeId]: position });
  };
  const resetFlow = (nodeIds: string[]) => {
    const next = { ...data.flowPositions };
    nodeIds.forEach((nodeId) => delete next[nodeId]);
    patch("flowPositions", next);
  };

  return (
    <ViewModeContext.Provider value={isView}>
    <main className="min-h-screen bg-zinc-100 text-zinc-950 antialiased transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      <div className={`mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8 lg:py-8 ${!isView ? "pb-24 sm:pb-28" : ""}`}>
        <header className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">개인 재무 대시보드</h1>
            </div>
            <IconToggle
              label={data.darkMode ? "라이트모드로 전환" : "다크모드로 전환"}
              icon={data.darkMode ? <Sun size={16} /> : <Moon size={16} />}
              onClick={() => {
                const next = !data.darkMode;
                setSavedData((current) => ({ ...current, darkMode: next }));
                setDraft((current) => ({ ...current, darkMode: next }));
              }}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ModeTabs mode={mode} onChange={requestMode} dirty={isDirty} />
            {!isView && (
              <div className="flex items-center justify-end gap-2">
                {isDirty && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">미저장 변경</span>}
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  disabled={!isDirty}
                  onClick={discardDraft}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-full bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400"
                  disabled={!isDirty}
                  onClick={saveDraft}
                >
                  저장
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <IncomeMetric
            salary={data.salary}
            sideIncomes={data.sideIncomes}
            totalIncome={totalIncome}
            totalSideIncome={totalSideIncome}
            onSalaryChange={(value) => patch("salary", value)}
            onSideIncomesChange={(rows) => patch("sideIncomes", rows)}
          />
          <Metric title="총 고정 지출" value={won(totalFixed)} detail={`${data.fixedExpenses.length}개 항목`} icon={<ArrowDownRight size={16} />} accent="rose" />
          <Metric title="가처분소득" value={won(disposableIncome)} detail="변동 지출 제외" icon={<Wallet size={16} />} accent="indigo" />
        </section>

        <Section title="포트폴리오" action={<Button label="추가" icon={<Plus size={16} />} onClick={() => patch("investmentProducts", [...data.investmentProducts, { id: newId(), destination: "", broker: "", ratio: 0 }])} />}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <InvestmentBaseControl value={data.investmentBase} fallback={disposableIncome} onChange={(value) => patch("investmentBase", value)} />
            <Readout label="투자 비율 합계" value={`${totalInvestmentRatio}%`} intent={totalInvestmentRatio === 100 ? "good" : "warn"} />
            {totalInvestmentRatio < 100 && <p className="text-sm font-medium text-amber-700 dark:text-amber-300">투자 비율 합계가 100% 미만입니다.</p>}
          </div>
          <PortfolioDonut products={data.investmentProducts} baseAmount={investmentBaseAmount} />
          {!isView && (
            <Table
              columns={["투자처", "증권사", "투자비율", "투자금액", ""]}
              rows={data.investmentProducts.map((item) => [
                <Text value={item.destination} onChange={(value) => updateInvestment(item.id, { destination: value })} />,
                <Text value={item.broker} onChange={(value) => updateInvestment(item.id, { broker: value })} />,
                <NumberBox value={item.ratio} suffix="%" onChange={(value) => updateInvestment(item.id, { ratio: Math.min(value, 100) })} />,
                <span className="font-medium">{won(investmentBaseAmount * (item.ratio / 100))}</span>,
                <Delete onClick={() => patch("investmentProducts", data.investmentProducts.filter((row) => row.id !== item.id))} />,
              ])}
            />
          )}
          {!isView && (
            <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">투자 실행</h3>
                <Button label={copyLabel} icon={<Clipboard size={16} />} onClick={copyExecution} />
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-6">{executionText}</pre>
            </div>
          )}
        </Section>

        <Section title="지출 흐름도">
          <EditableFlow
            nodes={expenseFlow.nodes}
            edges={expenseFlow.edges}
            onMove={updateFlowPosition}
            action={<Button label="배치 초기화" icon={<RefreshCw size={16} />} onClick={() => resetFlow(expenseFlow.nodes.map((node) => node.id))} />}
          />
          {!isView && (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold tracking-tight">계좌</h3>
                  <Button label="추가" icon={<Plus size={16} />} onClick={() => patch("accounts", [...data.accounts, { id: newId(), bank: "", name: "", number: "", type: "생활비통장" }])} />
                </div>
                <Table
                  columns={["은행명", "계좌명", "계좌번호", "유형", ""]}
                  rows={data.accounts.map((item) => [
                    <Text value={item.bank} onChange={(value) => updateAccount(item.id, { bank: value })} />,
                    <Text value={item.name} onChange={(value) => updateAccount(item.id, { name: value })} />,
                    <Text value={item.number} onChange={(value) => updateAccount(item.id, { number: value })} />,
                    <Select value={item.type} options={accountTypes} onChange={(value) => updateAccount(item.id, { type: value as AccountType })} />,
                    <Delete onClick={() => patch("accounts", data.accounts.filter((row) => row.id !== item.id))} />,
                  ])}
                />
              </div>
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold tracking-tight">카드</h3>
                  <Button label="추가" icon={<Plus size={16} />} onClick={() => patch("cards", [...data.cards, { id: newId(), name: "", issuer: "", settlementAccount: "" }])} />
                </div>
                <Table
                  columns={["카드명", "카드사", "결제계좌", ""]}
                  rows={data.cards.map((item) => [
                    <Text value={item.name} onChange={(value) => updateCard(item.id, { name: value })} />,
                    <Text value={item.issuer} onChange={(value) => updateCard(item.id, { issuer: value })} />,
                    <Text value={item.settlementAccount} onChange={(value) => updateCard(item.id, { settlementAccount: value })} />,
                    <Delete onClick={() => patch("cards", data.cards.filter((row) => row.id !== item.id))} />,
                  ])}
                />
              </div>
            </div>
          )}
        </Section>

        <Section title="고정 지출" action={<Button label="추가" icon={<Plus size={16} />} onClick={() => patch("fixedExpenses", [...data.fixedExpenses, { id: newId(), name: "", amount: 0, paymentMethod: "카드" }])} />}>
          <Table
            columns={["이름", "금액", "결제수단", "결제 은행/카드사", "결제 계좌/카드명", ""]}
            rows={data.fixedExpenses.map((item) => {
              const kind = paymentKind(item.paymentMethod);
              return [
                <Text value={item.name} onChange={(value) => updateFixed(item.id, { name: value })} />,
                <NumberBox value={item.amount} onChange={(value) => updateFixed(item.id, { amount: value })} />,
                <PaymentMethodSelect value={item.paymentMethod} onChange={(value) => updateFixed(item.id, { paymentMethod: value })} />,
                <PaymentDetailField
                  kind={kind}
                  cardValue={item.cardIssuer ?? ""}
                  transferValue={item.bank ?? ""}
                  onCardChange={(value) => updateFixed(item.id, { cardIssuer: value })}
                  onTransferChange={(value) => updateFixed(item.id, { bank: value })}
                />,
                <PaymentDetailField
                  kind={kind}
                  cardValue={item.cardName ?? ""}
                  transferValue={item.account ?? ""}
                  onCardChange={(value) => updateFixed(item.id, { cardName: value })}
                  onTransferChange={(value) => updateFixed(item.id, { account: value })}
                />,
                <Delete onClick={() => patch("fixedExpenses", data.fixedExpenses.filter((row) => row.id !== item.id))} />,
              ];
            })}
          />
          <div className="mt-4"><Readout label="총 고정 지출" value={won(totalFixed)} /></div>
        </Section>

        <Section title="변동 지출" action={<Button label="추가" icon={<Plus size={16} />} onClick={() => { patch("variableExpenses", [...data.variableExpenses, { id: newId(), date: new Date().toISOString().slice(0, 10), category: data.expenseCategories[0] ?? "기타", amount: 0, memo: "" }]); setVariableDetailOpen(true); }} />}>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-left ring-1 ring-zinc-200/60 transition hover:bg-zinc-100 dark:bg-zinc-950 dark:ring-zinc-800 dark:hover:bg-zinc-800/60"
            aria-expanded={variableDetailOpen}
            onClick={() => setVariableDetailOpen((open) => !open)}
          >
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">상세 내역</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{data.variableExpenses.length}건</span>
            </span>
            <ChevronDown size={16} className={`text-zinc-500 transition dark:text-zinc-400 ${variableDetailOpen ? "rotate-180" : ""}`} />
          </button>
          {variableDetailOpen && (
            <div className="mt-3">
              <Table
                columns={["날짜", "카테고리", "금액", "메모", ""]}
                rows={data.variableExpenses.map((item) => [
                  isView ? <span className="block text-sm text-zinc-800 dark:text-zinc-100">{item.date}</span> : <input className="field h-10" type="date" value={item.date} onChange={(event) => updateVariable(item.id, { date: event.target.value })} />,
                  <CategorySelect value={item.category} options={data.expenseCategories} onChange={(value) => updateVariable(item.id, { category: value })} onAddCategory={(name) => patch("expenseCategories", Array.from(new Set([...data.expenseCategories, name])))} />,
                  <NumberBox value={item.amount} onChange={(value) => updateVariable(item.id, { amount: value })} />,
                  <Text value={item.memo} onChange={(value) => updateVariable(item.id, { memo: value })} />,
                  <Delete onClick={() => patch("variableExpenses", data.variableExpenses.filter((row) => row.id !== item.id))} />,
                ])}
              />
            </div>
          )}
          <div className="mt-6 rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight">월별 변동 지출 추이</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">평균 {won(variableMonthlyAverage)} · 최대 {won(variableMonthlyMax)}</p>
              </div>
            </div>
            <ChartBox>
              <AreaChart data={variableByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="varGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonthLabel} tickLine={false} axisLine={false} tick={chartTick} />
                <YAxis tickFormatter={formatWonAxis} tickLine={false} axisLine={false} width={48} tick={chartTick} />
                <Tooltip content={<MoneyTooltip labelFormatter={formatMonthLabel} />} cursor={{ stroke: "#14b8a6", strokeOpacity: 0.2, strokeWidth: 1.5 }} />
                <Area type="monotone" dataKey="amount" name="변동 지출" stroke="#14b8a6" strokeWidth={2.5} fill="url(#varGrad)" dot={{ r: 3, fill: "#14b8a6", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ChartBox>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight">예외 지출 통계</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">병원·경조사·의류·여행 카테고리 누적</p>
              </div>
              <PeriodTabs value={data.analysisPeriod} onChange={(value) => patch("analysisPeriod", value)} />
            </div>
            <CategoryLegend categories={exceptionLegend} />
            {exceptionStats.length === 0 ? (
              <p className="mt-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">아직 예외 지출 기록이 없습니다.</p>
            ) : (
              <ChartBox tall>
                <BarChart data={exceptionStats} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={28}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                  <XAxis dataKey="period" tickFormatter={(value) => formatPeriodLabel(value, data.analysisPeriod)} tickLine={false} axisLine={false} tick={chartTick} />
                  <YAxis tickFormatter={formatWonAxis} tickLine={false} axisLine={false} width={48} tick={chartTick} />
                  <Tooltip content={<MoneyTooltip labelFormatter={(value) => formatPeriodLabel(String(value), data.analysisPeriod)} />} cursor={{ fill: "currentColor", fillOpacity: 0.04 }} />
                  {exceptionLegend.map((item, index) => {
                    const isLast = index === exceptionLegend.length - 1;
                    return (
                      <Bar
                        key={item.key}
                        dataKey={item.key}
                        stackId="a"
                        fill={item.color}
                        radius={isLast ? [8, 8, 0, 0] : 0}
                      />
                    );
                  })}
                </BarChart>
              </ChartBox>
            )}
          </div>
        </Section>

        <Section title="자산 운영 원칙">
          {isView ? (
            <div className="markdown-preview min-h-32 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <ReactMarkdown>{data.principles}</ReactMarkdown>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <textarea className="field min-h-56 resize-y py-3" value={data.principles} onChange={(event) => patch("principles", event.target.value)} />
              <div className="markdown-preview min-h-56 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <ReactMarkdown>{data.principles}</ReactMarkdown>
              </div>
            </div>
          )}
        </Section>

      </div>
      {!isView && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            {isDirty ? (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">미저장 변경</span>
            ) : (
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">모든 변경이 저장됨</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                disabled={!isDirty}
                onClick={discardDraft}
              >
                취소
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-full bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400"
                disabled={!isDirty}
                onClick={saveDraft}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingMode !== null && (
        <UnsavedDialog
          onSave={() => resolvePending("save")}
          onDiscard={() => resolvePending("discard")}
          onCancel={() => resolvePending("cancel")}
        />
      )}
    </main>
    </ViewModeContext.Provider>
  );
}

function UnsavedDialog({ onSave, onDiscard, onCancel }: { onSave: () => void; onDiscard: () => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="unsaved-title" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 id="unsaved-title" className="text-lg font-bold tracking-tight">저장하지 않은 변경 사항</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          편집한 내용이 아직 저장되지 않았습니다. 어떻게 처리할까요?
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950"
            onClick={onDiscard}
          >
            변경 버리기
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400"
            onClick={onSave}
          >
            저장하고 이동
          </button>
        </div>
      </div>
    </div>
  );
}

function PeriodTabs({ value, onChange }: { value: Period; onChange: (value: Period) => void }) {
  const items: { value: Period; label: string }[] = [
    { value: "monthly", label: "월별" },
    { value: "yearly", label: "연도별" },
  ];
  return (
    <div role="tablist" aria-label="기간" className="inline-flex h-9 rounded-md border border-zinc-200 bg-white p-0.5 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            className={`min-w-14 rounded px-3 transition ${active ? "bg-teal-700 text-white shadow-sm dark:bg-teal-500 dark:text-zinc-950" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ModeTabs({ mode, onChange, dirty = false }: { mode: Mode; onChange: (mode: Mode) => void; dirty?: boolean }) {
  const items: { value: Mode; label: string }[] = [
    { value: "view", label: "조회" },
    { value: "edit", label: "편집" },
  ];
  return (
    <div role="tablist" aria-label="모드" className="grid h-11 w-full grid-cols-2 rounded-xl bg-white p-1 text-sm font-medium shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800 sm:inline-grid sm:w-auto sm:min-w-[200px]">
      {items.map((item) => {
        const active = mode === item.value;
        const showDot = item.value === "edit" && dirty;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            className={`relative rounded-lg px-3 transition ${active ? "bg-zinc-900 text-white shadow dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {showDot && <span aria-label="미저장 변경" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500" />}
          </button>
        );
      })}
    </div>
  );
}

function flowKey(scope: string, id: string) {
  return `${scope}:${id}`;
}

type Viewport = { scale: number; x: number; y: number };
const minScale = 0.4;
const maxScale = 2.5;
const initialViewport: Viewport = { scale: 1, x: 0, y: 0 };

function EditableFlow({ nodes, edges, onMove, action }: { nodes: FlowNode[]; edges: FlowEdge[]; onMove: (nodeId: string, position: FlowPosition) => void; action?: ReactNode }) {
  const readOnly = useReadOnly();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const viewportRef = useRef<Viewport>(initialViewport);
  viewportRef.current = viewport;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const toContentCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const v = viewportRef.current;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>, node: FlowNode) => {
    if (readOnly) return;
    const coords = toContentCoords(event.clientX, event.clientY);
    if (!coords) return;
    event.stopPropagation();
    dragRef.current = {
      id: node.id,
      offsetX: coords.x - node.x,
      offsetY: coords.y - node.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const coords = toContentCoords(event.clientX, event.clientY);
    if (!coords) return;
    onMove(drag.id, { x: coords.x - drag.offsetX, y: coords.y - drag.offsetY });
  };

  const stopDrag = (event: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      vx: viewportRef.current.x,
      vy: viewportRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    setViewport((current) => ({ ...current, x: pan.vx + (event.clientX - pan.startX), y: pan.vy + (event.clientY - pan.startY) }));
  };

  const stopPan = (event: PointerEvent<HTMLDivElement>) => {
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const zoomBy = (factor: number, anchorClientX?: number, anchorClientY?: number) => {
    setViewport((current) => {
      const nextScale = clamp(current.scale * factor, minScale, maxScale);
      if (nextScale === current.scale) return current;
      const rect = canvasRef.current?.getBoundingClientRect();
      const cx = anchorClientX !== undefined && rect ? anchorClientX - rect.left : (rect?.width ?? 0) / 2;
      const cy = anchorClientY !== undefined && rect ? anchorClientY - rect.top : (rect?.height ?? 0) / 2;
      const k = nextScale / current.scale;
      return { scale: nextScale, x: cx - k * (cx - current.x), y: cy - k * (cy - current.y) };
    });
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaY) < 10) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.1 : 0.9, event.clientX, event.clientY);
  };

  const resetView = () => setViewport(initialViewport);

  return (
    <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex h-9 items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <button type="button" title="축소" aria-label="축소" className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => zoomBy(0.9)}>
            <Minus size={15} />
          </button>
          <span className="min-w-12 text-center text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300">{Math.round(viewport.scale * 100)}%</span>
          <button type="button" title="확대" aria-label="확대" className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => zoomBy(1.1)}>
            <Plus size={15} />
          </button>
          <button type="button" title="원래대로" aria-label="원래대로" className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={resetView}>
            <Maximize2 size={14} />
          </button>
        </div>
        {!readOnly && action}
      </div>
      <div
        ref={canvasRef}
        className={`relative h-[320px] touch-none overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sm:h-[420px] ${panRef.current ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onWheel={onWheel}
      >
        <div className="absolute left-0 top-0 h-full w-full origin-top-left" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <marker id="arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x + 180}
                  y1={from.y + 42}
                  x2={to.x}
                  y2={to.y + 42}
                  className="text-zinc-400 dark:text-zinc-500"
                  stroke="currentColor"
                  strokeWidth="2"
                  markerEnd="url(#arrow)"
                />
              );
            })}
          </svg>
          {nodes.map((node) => {
            const style = brandStyle(node.brand);
            return (
              <button
                key={node.id}
                type="button"
                className={`absolute flex h-[84px] w-[180px] touch-none items-center gap-3 rounded-lg border px-3 text-left shadow-sm transition hover:shadow-md ${flowTone(node.tone)} ${readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                onPointerDown={(event) => startDrag(event, node)}
                onPointerMove={moveDrag}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-tight ${style.bg} ${style.fg}`}>
                  {style.label}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{node.title}</span>
                  <span className="mt-0.5 truncate text-xs opacity-70">{node.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function flowTone(tone: FlowNode["tone"]) {
  if (tone === "teal") return "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-50";
  if (tone === "indigo") return "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-50";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50";
  return "border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50";
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const readOnly = useReadOnly();
  return (
    <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <h2 className="text-base font-bold tracking-tight sm:text-lg">{title}</h2>
        {!readOnly && action}
      </div>
      {children}
    </section>
  );
}

type MetricAccent = "teal" | "rose" | "indigo" | "amber" | "emerald";

function metricAccentClasses(accent: MetricAccent) {
  const map: Record<MetricAccent, string> = {
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  };
  return map[accent];
}

function Metric({ title, value, detail, intent, icon, accent = "teal" }: { title: string; value: string; detail: string; intent?: "good" | "warn"; icon?: ReactNode; accent?: MetricAccent }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 transition hover:shadow-md dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
        {icon && (
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${metricAccentClasses(accent)}`}>{icon}</span>
        )}
      </div>
      <p className={`mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-[26px] ${tone(intent)}`}>{value}</p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

function IncomeMetric({
  salary,
  sideIncomes,
  totalIncome,
  totalSideIncome,
  onSalaryChange,
  onSideIncomesChange,
}: {
  salary: number;
  sideIncomes: SideIncome[];
  totalIncome: number;
  totalSideIncome: number;
  onSalaryChange: (value: number) => void;
  onSideIncomesChange: (rows: SideIncome[]) => void;
}) {
  const readOnly = useReadOnly();
  if (readOnly) {
    return (
      <Metric
        title="총 월 수입"
        value={won(totalIncome)}
        detail={`월급 ${won(salary)} + 부수입 ${won(totalSideIncome)}`}
        icon={<ArrowUpRight size={16} />}
        accent="teal"
      />
    );
  }
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 transition hover:shadow-md dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 월 수입</p>
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${metricAccentClasses("teal")}`}><ArrowUpRight size={16} /></span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-[26px]">{won(totalIncome)}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-zinc-500 dark:text-zinc-400">월급</span>
          <input
            className="field h-9 flex-1 min-w-0"
            inputMode="numeric"
            value={format.format(salary)}
            onChange={(event) => onSalaryChange(toNumber(event.target.value))}
          />
        </label>
        {sideIncomes.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-xs">
            <input
              className="field h-9 w-12 shrink-0 truncate text-zinc-500 dark:text-zinc-400"
              placeholder="부수입"
              value={item.name}
              onChange={(event) => onSideIncomesChange(sideIncomes.map((row) => (row.id === item.id ? { ...row, name: event.target.value } : row)))}
            />
            <input
              className="field h-9 flex-1 min-w-0"
              inputMode="numeric"
              value={format.format(item.amount)}
              onChange={(event) => onSideIncomesChange(sideIncomes.map((row) => (row.id === item.id ? { ...row, amount: toNumber(event.target.value) } : row)))}
            />
            <button
              type="button"
              title="삭제"
              aria-label="부수입 삭제"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
              onClick={() => onSideIncomesChange(sideIncomes.filter((row) => row.id !== item.id))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="self-start text-xs font-medium text-teal-700 transition hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
          onClick={() => onSideIncomesChange([...sideIncomes, { id: newId(), name: "", amount: 0 }])}
        >
          + 부수입 추가
        </button>
      </div>
    </div>
  );
}

function InvestmentBaseControl({ value, fallback, onChange }: { value: number | null; fallback: number; onChange: (value: number | null) => void }) {
  const readOnly = useReadOnly();
  const isAuto = value === null;
  const effective = isAuto ? fallback : value;
  if (readOnly) {
    return (
      <div className="rounded-xl bg-zinc-50 px-4 py-2.5 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">투자 기준액 {isAuto && <span className="ml-1 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">자동</span>}</p>
        <p className="mt-1 text-base font-bold tabular-nums">{won(effective)}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-zinc-50 px-4 py-2.5 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">투자 기준액</p>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-zinc-300 text-teal-700 focus:ring-teal-600 dark:border-zinc-600 dark:bg-zinc-900"
            checked={!isAuto}
            onChange={(event) => onChange(event.target.checked ? fallback : null)}
          />
          직접 입력
        </label>
      </div>
      {isAuto ? (
        <p className="mt-1 text-base font-bold tabular-nums">{won(effective)} <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">(가처분소득)</span></p>
      ) : (
        <input
          className="field mt-1 h-9"
          inputMode="numeric"
          value={format.format(value ?? 0)}
          onChange={(event) => onChange(toNumber(event.target.value))}
        />
      )}
    </div>
  );
}

function Readout({ label, value, intent }: { label: string; value: string; intent?: "good" | "warn" }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-4 py-2.5 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-base font-bold tabular-nums ${tone(intent)}`}>{value}</p>
    </div>
  );
}

function tone(intent?: "good" | "warn") {
  if (intent === "good") return "text-teal-700 dark:text-teal-300";
  if (intent === "warn") return "text-amber-700 dark:text-amber-300";
  return "";
}

function Money({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const readOnly = useReadOnly();
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
      {readOnly ? (
        <div className="flex h-11 items-center rounded-md border border-transparent bg-zinc-50 px-3 text-sm font-semibold dark:bg-zinc-950">{won(value)}</div>
      ) : (
        <input className="field h-11" inputMode="numeric" value={format.format(value)} onChange={(event) => onChange(toNumber(event.target.value))} />
      )}
    </label>
  );
}

function Text({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-36">{value || "-"}</span>;
  return <input className="field h-10 sm:min-w-36" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function NumberBox({ value, onChange, suffix }: { value: number; onChange: (value: number) => void; suffix?: string }) {
  const readOnly = useReadOnly();
  if (readOnly) {
    return <span className="block text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-100 sm:min-w-28">{format.format(value)}{suffix ? ` ${suffix}` : ""}</span>;
  }
  return (
    <div className="flex items-center gap-1 sm:min-w-28">
      <input className="field h-10" inputMode="numeric" value={format.format(value)} onChange={(event) => onChange(toNumber(event.target.value))} />
      {suffix && <span className="text-sm text-zinc-500">{suffix}</span>}
    </div>
  );
}

function PaymentMethodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-24">{value || "-"}</span>;
  const hasCustom = value && !paymentMethodOptions.includes(value);
  return (
    <select className="field h-10 sm:min-w-24" value={value} onChange={(event) => onChange(event.target.value)}>
      {!value && <option value="">선택</option>}
      {hasCustom && <option value={value}>{value}</option>}
      {paymentMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function PaymentDetailField({
  kind,
  cardValue,
  transferValue,
  onCardChange,
  onTransferChange,
}: {
  kind: PaymentKind;
  cardValue: string;
  transferValue: string;
  onCardChange: (value: string) => void;
  onTransferChange: (value: string) => void;
}) {
  const readOnly = useReadOnly();
  if (kind === "other") {
    if (readOnly) return <span className="block text-sm text-zinc-400 dark:text-zinc-500 sm:min-w-32">-</span>;
    return <span className="block text-sm text-zinc-400 dark:text-zinc-500 sm:min-w-32">해당 없음</span>;
  }
  const value = kind === "card" ? cardValue : transferValue;
  const onChange = kind === "card" ? onCardChange : onTransferChange;
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-32">{value || "-"}</span>;
  return <input className="field h-10 sm:min-w-32" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-32">{value}</span>;
  return (
    <select className="field h-10 sm:min-w-32" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

const ADD_CATEGORY_VALUE = "__add_category__";
function CategorySelect({ value, options, onChange, onAddCategory }: { value: string; options: string[]; onChange: (value: string) => void; onAddCategory: (name: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-32">{value}</span>;
  return (
    <select
      className="field h-10 sm:min-w-32"
      value={options.includes(value) ? value : ""}
      onChange={(event) => {
        if (event.target.value === ADD_CATEGORY_VALUE) {
          const name = window.prompt("새 카테고리 이름")?.trim();
          if (!name) return;
          if (!options.includes(name)) onAddCategory(name);
          onChange(name);
          return;
        }
        onChange(event.target.value);
      }}
    >
      {!options.includes(value) && value && <option value="">{value} (사용 중)</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
      <option value={ADD_CATEGORY_VALUE}>+ 새 카테고리 추가</option>
    </select>
  );
}

function Button({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" title={label} className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function IconToggle({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function Delete({ onClick }: { onClick: () => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return null;
  return (
    <button type="button" title="삭제" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:hover:bg-red-950" onClick={onClick}>
      <Trash2 size={16} />
    </button>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  const readOnly = useReadOnly();
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-zinc-100 transition hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2.5 align-middle">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((row, rowIndex) => {
          const labeled = row
            .map((cell, i) => ({ cell, label: columns[i] }))
            .filter((entry) => entry.label);
          const actions = row.filter((_, i) => !columns[i]);
          return (
            <div key={rowIndex} className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 dark:bg-zinc-950 dark:ring-zinc-800">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                {labeled.map((entry, i) => (
                  <div key={i} className="contents">
                    <dt className="self-center text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{entry.label}</dt>
                    <dd className="min-w-0 self-center">{entry.cell}</dd>
                  </div>
                ))}
              </dl>
              {!readOnly && actions.length > 0 && (
                <div className="mt-3 flex justify-end gap-2">{actions}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ChartBox({ children, tall = false }: { children: ReactElement; tall?: boolean }) {
  return (
    <div className={`mt-4 ${tall ? "h-72 sm:h-80" : "h-56 sm:h-64"}`}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const chartTick = { fill: "currentColor", fontSize: 11, opacity: 0.7 } as const;

const exceptionLegend = [
  { key: "병원", color: "#14b8a6" },
  { key: "경조사", color: "#f59e0b" },
  { key: "의류", color: "#6366f1" },
  { key: "여행", color: "#ef4444" },
] as const;

function formatWonAxis(value: number | string) {
  const n = Number(value);
  if (!n) return "0";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  return format.format(n);
}

function formatMonthLabel(value: string) {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[2])}월`;
}

function formatPeriodLabel(value: string, period: Period) {
  if (period === "yearly") return `${value}년`;
  return formatMonthLabel(value);
}

const portfolioPalette = [
  "#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#22c55e", "#8b5cf6", "#0ea5e9", "#f97316", "#ec4899", "#14b8a6",
];

function PortfolioDonut({ products, baseAmount }: { products: InvestmentProduct[]; baseAmount: number }) {
  const data = products
    .filter((item) => item.ratio > 0)
    .map((item, index) => ({
      name: item.destination || "미지정",
      broker: item.broker,
      value: item.ratio,
      amount: baseAmount * (item.ratio / 100),
      color: portfolioPalette[index % portfolioPalette.length],
    }));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (data.length === 0) {
    return (
      <div className="mb-4 rounded-2xl bg-zinc-50/80 p-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:text-zinc-400 dark:ring-zinc-800">
        투자 항목과 비율을 입력하면 포트폴리오가 시각화됩니다.
      </div>
    );
  }
  return (
    <div className="mb-5 grid gap-5 rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-5 lg:grid-cols-[260px_1fr] lg:items-center">
      <div className="relative mx-auto h-[220px] w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={62} outerRadius={92} stroke="none" paddingAngle={1.5}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: true, y: true }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 배분</span>
          <span className="mt-0.5 text-xl font-bold tabular-nums">{total}%</span>
          <span className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{won(baseAmount * (total / 100))}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.map((item) => (
          <li key={item.name} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
            {item.broker && <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">{item.broker}</span>}
            <span className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">{item.value}%</span>
            <span className="w-24 text-right font-semibold tabular-nums">{won(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name: string; broker?: string; value: number; amount: number; color: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload;
  if (!entry) return null;
  return (
    <div className="relative z-50 rounded-xl border border-zinc-200 p-3 text-xs shadow-xl dark:border-zinc-700" style={{ backgroundColor: "var(--tooltip-bg, #ffffff)" }}>
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-white dark:bg-zinc-900" />
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
        <span className="font-semibold">{entry.name}</span>
      </div>
      {entry.broker && <p className="mt-1 text-zinc-500 dark:text-zinc-400">{entry.broker}</p>}
      <p className="mt-1 tabular-nums">{entry.value}% · {won(entry.amount)}</p>
    </div>
  );
}

function CategoryLegend({ categories }: { categories: ReadonlyArray<{ key: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-700">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.key}
        </span>
      ))}
    </div>
  );
}

type TooltipPayload = { name?: string; value?: number | string; color?: string; dataKey?: string | number };

function MoneyTooltip({ active, payload, label, labelFormatter }: { active?: boolean; payload?: TooltipPayload[]; label?: string | number; labelFormatter?: (value: string) => string }) {
  if (!active || !payload || payload.length === 0) return null;
  const visible = payload.filter((entry) => Number(entry.value) > 0);
  if (visible.length === 0) return null;
  const total = visible.reduce((sum, entry) => sum + Number(entry.value ?? 0), 0);
  const labelText = labelFormatter && typeof label === "string" ? labelFormatter(label) : String(label ?? "");
  return (
    <div className="rounded-xl bg-white p-3 text-xs shadow-lg ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-700">
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{labelText}</p>
      <div className="mt-2 flex flex-col gap-1">
        {visible.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="text-zinc-500 dark:text-zinc-400">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{won(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
      {visible.length > 1 && (
        <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-1.5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          <span className="text-zinc-500 dark:text-zinc-400">합계</span>
          <span className="font-semibold tabular-nums">{won(total)}</span>
        </div>
      )}
    </div>
  );
}
