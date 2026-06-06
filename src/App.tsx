import { PointerEvent, ReactElement, ReactNode, WheelEvent as ReactWheelEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clipboard, Maximize2, Minus, Moon, Plus, RefreshCw, Sun, Trash2 } from "lucide-react";

type ExpenseCategory = "식비" | "병원" | "의류" | "여행" | "경조사" | "기타";
type AccountType = "급여통장" | "생활비통장" | "투자계좌" | "비상금통장";
type Period = "monthly" | "yearly";

type FixedExpense = { id: string; name: string; amount: number; paymentMethod: string };
type VariableExpense = { id: string; date: string; category: ExpenseCategory; amount: number; memo: string };
type InvestmentProduct = { id: string; destination: string; broker: string; ratio: number };
type Account = { id: string; bank: string; name: string; number: string; type: AccountType };
type Card = { id: string; name: string; issuer: string; settlementAccount: string };
type FlowPosition = { x: number; y: number };
type FlowNode = { id: string; title: string; subtitle: string; x: number; y: number; tone: "teal" | "indigo" | "amber" | "zinc"; brand?: string };
type FlowEdge = { from: string; to: string };

type DashboardData = {
  principles: string;
  salary: number;
  sideIncome: number;
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  investmentProducts: InvestmentProduct[];
  accounts: Account[];
  cards: Card[];
  targetCash: number;
  currentCash: number;
  analysisPeriod: Period;
  darkMode: boolean;
  flowPositions: Record<string, FlowPosition>;
};

const STORAGE_KEY = "personal-finance-dashboard:v1";
const ViewModeContext = createContext(false);
const useReadOnly = () => useContext(ViewModeContext);
type Mode = "view" | "edit";
const expenseCategories: ExpenseCategory[] = ["식비", "병원", "의류", "여행", "경조사", "기타"];
const exceptionCategories: ExpenseCategory[] = ["병원", "경조사", "의류", "여행"];
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
  sideIncome: 300000,
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
  targetCash: 5000000,
  currentCash: 4300000,
  analysisPeriod: "monthly",
  darkMode: false,
  flowPositions: {},
};

function loadData(): DashboardData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultData;
    const next = { ...defaultData, ...JSON.parse(saved) } as DashboardData;
    if (next.analysisPeriod !== "monthly" && next.analysisPeriod !== "yearly") next.analysisPeriod = "monthly";
    return next;
  } catch {
    return defaultData;
  }
}

export default function App() {
  const [data, setData] = useState<DashboardData>(loadData);
  const [mode, setMode] = useState<Mode>("view");
  const [copyLabel, setCopyLabel] = useState("복사");
  const isView = mode === "view";

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    document.documentElement.classList.toggle("dark", data.darkMode);
  }, [data]);

  const totalIncome = data.salary + data.sideIncome;
  const totalFixed = data.fixedExpenses.reduce((sum, item) => sum + item.amount, 0);
  const disposableIncome = totalIncome - totalFixed;
  const totalInvestmentRatio = data.investmentProducts.reduce((sum, item) => sum + item.ratio, 0);
  const cashGap = Math.max(data.targetCash - data.currentCash, 0);

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
      items.forEach((item) => lines.push(`- ${item.destination || "투자상품"} ${won(disposableIncome * (item.ratio / 100))}`));
      lines.push("");
    });
    return lines.join("\n").trim();
  }, [disposableIncome, investmentsByBroker]);

  const accountFlow = useMemo(() => {
    const salary = data.accounts.find((item) => item.type === "급여통장");
    const living = data.accounts.find((item) => item.type === "생활비통장");
    const investments = data.accounts.filter((item) => item.type === "투자계좌");
    const position = (key: string, fallback: FlowPosition) => data.flowPositions[key] || fallback;
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    if (salary) {
      const key = flowKey("account", salary.id);
      nodes.push({
        id: key,
        title: `${salary.bank} ${salary.name}`.trim() || "급여통장",
        subtitle: salary.type,
        tone: "teal",
        brand: salary.bank,
        ...position(key, { x: 28, y: 120 }),
      });
    }
    if (living) {
      const key = flowKey("account", living.id);
      nodes.push({
        id: key,
        title: `${living.bank} ${living.name}`.trim() || "생활비통장",
        subtitle: living.type,
        tone: "indigo",
        brand: living.bank,
        ...position(key, { x: 300, y: 120 }),
      });
    }
    investments.forEach((item, index) => {
      const key = flowKey("account", item.id);
      nodes.push({
        id: key,
        title: `${item.bank} ${item.name}`.trim() || "투자계좌",
        subtitle: item.type,
        tone: "amber",
        brand: item.bank,
        ...position(key, { x: 570, y: 40 + index * 110 }),
      });
    });

    if (salary && living) edges.push({ from: flowKey("account", salary.id), to: flowKey("account", living.id) });
    if (living) investments.forEach((item) => edges.push({ from: flowKey("account", living.id), to: flowKey("account", item.id) }));
    return { nodes, edges };
  }, [data.accounts, data.flowPositions]);

  const cardFlow = useMemo(() => {
    const position = (key: string, fallback: FlowPosition) => data.flowPositions[key] || fallback;
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const settlementAccounts = Array.from(new Set(data.cards.map((card) => card.settlementAccount || "결제계좌")));

    data.cards.forEach((card, index) => {
      const key = flowKey("card", card.id);
      nodes.push({
        id: key,
        title: card.name || "카드",
        subtitle: card.issuer || "카드사",
        tone: "teal",
        brand: card.issuer,
        ...position(key, { x: 80 + (index % 2) * 240, y: 42 + Math.floor(index / 2) * 118 }),
      });
      edges.push({ from: key, to: flowKey("settlement", card.settlementAccount || "결제계좌") });
    });
    settlementAccounts.forEach((account, index) => {
      const key = flowKey("settlement", account);
      nodes.push({
        id: key,
        title: account,
        subtitle: "결제계좌",
        tone: "indigo",
        brand: account,
        ...position(key, { x: 570, y: 80 + index * 118 }),
      });
    });
    return { nodes, edges };
  }, [data.cards, data.flowPositions]);

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
    <main className="min-h-screen bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">브라우저에만 저장되는 로컬 대시보드</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">개인 재무 대시보드</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModeTabs mode={mode} onChange={setMode} />
            <IconToggle
              label={data.darkMode ? "라이트모드로 전환" : "다크모드로 전환"}
              icon={data.darkMode ? <Sun size={16} /> : <Moon size={16} />}
              onClick={() => patch("darkMode", !data.darkMode)}
            />
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="총 월 수입" value={won(totalIncome)} detail={`월급 ${won(data.salary)} + 부수입 ${won(data.sideIncome)}`} />
          <Metric title="총 고정 지출" value={won(totalFixed)} detail={`${data.fixedExpenses.length}개 항목`} />
          <Metric title="가처분소득" value={won(disposableIncome)} detail="변동 지출 제외" />
          <Metric title="현금 부족분" value={won(cashGap)} detail={`목표 ${won(data.targetCash)}`} intent={cashGap > 0 ? "warn" : "good"} />
        </section>

        <Section title="1. 자산 운영 원칙">
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

        <Section title="2. 월 수입">
          <div className="grid gap-3 md:grid-cols-3">
            <Money label="월급" value={data.salary} onChange={(value) => patch("salary", value)} />
            <Money label="부수입" value={data.sideIncome} onChange={(value) => patch("sideIncome", value)} />
            <Readout label="총 수입" value={won(totalIncome)} />
          </div>
        </Section>

        <Section title="3. 고정 지출" action={<Button label="추가" icon={<Plus size={16} />} onClick={() => patch("fixedExpenses", [...data.fixedExpenses, { id: newId(), name: "", amount: 0, paymentMethod: "" }])} />}>
          <Table
            columns={["이름", "금액", "결제수단", ""]}
            rows={data.fixedExpenses.map((item) => [
              <Text value={item.name} onChange={(value) => updateFixed(item.id, { name: value })} />,
              <NumberBox value={item.amount} onChange={(value) => updateFixed(item.id, { amount: value })} />,
              <Text value={item.paymentMethod} onChange={(value) => updateFixed(item.id, { paymentMethod: value })} />,
              <Delete onClick={() => patch("fixedExpenses", data.fixedExpenses.filter((row) => row.id !== item.id))} />,
            ])}
          />
          <div className="mt-4"><Readout label="총 고정 지출" value={won(totalFixed)} /></div>
        </Section>

        <Section title="4. 변동 지출" action={<Button label="추가" icon={<Plus size={16} />} onClick={() => patch("variableExpenses", [...data.variableExpenses, { id: newId(), date: new Date().toISOString().slice(0, 10), category: "식비", amount: 0, memo: "" }])} />}>
          <Table
            columns={["날짜", "카테고리", "금액", "메모", ""]}
            rows={data.variableExpenses.map((item) => [
              isView ? <span className="block text-sm text-zinc-800 dark:text-zinc-100">{item.date}</span> : <input className="field h-10" type="date" value={item.date} onChange={(event) => updateVariable(item.id, { date: event.target.value })} />,
              <Select value={item.category} options={expenseCategories} onChange={(value) => updateVariable(item.id, { category: value as ExpenseCategory })} />,
              <NumberBox value={item.amount} onChange={(value) => updateVariable(item.id, { amount: value })} />,
              <Text value={item.memo} onChange={(value) => updateVariable(item.id, { memo: value })} />,
              <Delete onClick={() => patch("variableExpenses", data.variableExpenses.filter((row) => row.id !== item.id))} />,
            ])}
          />
          <ChartBox>
            <AreaChart data={variableByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${Number(value) / 10000}만`} width={58} />
              <Tooltip formatter={(value) => won(Number(value))} />
              <Area type="monotone" dataKey="amount" name="월별 변동 지출" stroke="#0f766e" fill="#99f6e4" />
            </AreaChart>
          </ChartBox>

          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">예외 지출 통계</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">병원/경조사/의류/여행 변동 지출 합계</p>
              </div>
              <PeriodTabs value={data.analysisPeriod} onChange={(value) => patch("analysisPeriod", value)} />
            </div>
            <ChartBox tall>
              <BarChart data={exceptionStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `${Number(value) / 10000}만`} width={58} />
                <Tooltip formatter={(value) => won(Number(value))} />
                <Legend />
                <Bar dataKey="병원" stackId="a" fill="#14b8a6" />
                <Bar dataKey="경조사" stackId="a" fill="#f59e0b" />
                <Bar dataKey="의류" stackId="a" fill="#6366f1" />
                <Bar dataKey="여행" stackId="a" fill="#ef4444" />
              </BarChart>
            </ChartBox>
          </div>
        </Section>

        <Section title="5. 투자 배분" action={<Button label="추가" icon={<Plus size={16} />} onClick={() => patch("investmentProducts", [...data.investmentProducts, { id: newId(), destination: "", broker: "", ratio: 0 }])} />}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Readout label="가처분소득" value={won(disposableIncome)} />
            <Readout label="투자 비율 합계" value={`${totalInvestmentRatio}%`} intent={totalInvestmentRatio === 100 ? "good" : "warn"} />
            {totalInvestmentRatio < 100 && <p className="text-sm font-medium text-amber-700 dark:text-amber-300">투자 비율 합계가 100% 미만입니다.</p>}
          </div>
          <Table
            columns={["투자처", "증권사", "투자비율", "투자금액", ""]}
            rows={data.investmentProducts.map((item) => [
              <Text value={item.destination} onChange={(value) => updateInvestment(item.id, { destination: value })} />,
              <Text value={item.broker} onChange={(value) => updateInvestment(item.id, { broker: value })} />,
              <NumberBox value={item.ratio} suffix="%" onChange={(value) => updateInvestment(item.id, { ratio: Math.min(value, 100) })} />,
              <span className="font-medium">{won(disposableIncome * (item.ratio / 100))}</span>,
              <Delete onClick={() => patch("investmentProducts", data.investmentProducts.filter((row) => row.id !== item.id))} />,
            ])}
          />
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">투자 실행</h3>
              <Button label={copyLabel} icon={<Clipboard size={16} />} onClick={copyExecution} />
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-6">{executionText}</pre>
          </div>
        </Section>

        <Section title="6. 계좌 흐름도" action={<Button label="계좌 추가" icon={<Plus size={16} />} onClick={() => patch("accounts", [...data.accounts, { id: newId(), bank: "", name: "", number: "", type: "생활비통장" }])} />}>
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
          <EditableFlow
            nodes={accountFlow.nodes}
            edges={accountFlow.edges}
            onMove={updateFlowPosition}
            action={<Button label="배치 초기화" icon={<RefreshCw size={16} />} onClick={() => resetFlow(accountFlow.nodes.map((node) => node.id))} />}
          />
        </Section>

        <Section title="7. 카드 결제 흐름" action={<Button label="카드 추가" icon={<Plus size={16} />} onClick={() => patch("cards", [...data.cards, { id: newId(), name: "", issuer: "", settlementAccount: "" }])} />}>
          <Table
            columns={["카드명", "카드사", "결제계좌", ""]}
            rows={data.cards.map((item) => [
              <Text value={item.name} onChange={(value) => updateCard(item.id, { name: value })} />,
              <Text value={item.issuer} onChange={(value) => updateCard(item.id, { issuer: value })} />,
              <Text value={item.settlementAccount} onChange={(value) => updateCard(item.id, { settlementAccount: value })} />,
              <Delete onClick={() => patch("cards", data.cards.filter((row) => row.id !== item.id))} />,
            ])}
          />
          <EditableFlow
            nodes={cardFlow.nodes}
            edges={cardFlow.edges}
            onMove={updateFlowPosition}
            action={<Button label="배치 초기화" icon={<RefreshCw size={16} />} onClick={() => resetFlow(cardFlow.nodes.map((node) => node.id))} />}
          />
        </Section>

        <Section title="8. 현금 운영">
          <div className="grid gap-3 md:grid-cols-3">
            <Money label="목표 현금" value={data.targetCash} onChange={(value) => patch("targetCash", value)} />
            <Money label="현재 현금" value={data.currentCash} onChange={(value) => patch("currentCash", value)} />
            <Readout label="부족 금액" value={won(cashGap)} intent={cashGap > 0 ? "warn" : "good"} />
          </div>
        </Section>
      </div>
    </main>
    </ViewModeContext.Provider>
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

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const items: { value: Mode; label: string }[] = [
    { value: "view", label: "조회" },
    { value: "edit", label: "편집" },
  ];
  return (
    <div role="tablist" aria-label="모드" className="inline-flex h-10 rounded-md border border-zinc-200 bg-white p-0.5 text-sm font-medium shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {items.map((item) => {
        const active = mode === item.value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            className={`min-w-16 rounded px-3 transition ${active ? "bg-teal-700 text-white shadow-sm dark:bg-teal-500 dark:text-zinc-950" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
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
        className={`relative h-[420px] overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${panRef.current ? "cursor-grabbing" : "cursor-grab"}`}
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
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {!readOnly && action}
      </div>
      {children}
    </section>
  );
}

function Metric({ title, value, detail, intent }: { title: string; value: string; detail: string; intent?: "good" | "warn" }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone(intent)}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

function Readout({ label, value, intent }: { label: string; value: string; intent?: "good" | "warn" }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-base font-semibold ${tone(intent)}`}>{value}</p>
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
  if (readOnly) return <span className="block min-w-36 text-sm text-zinc-800 dark:text-zinc-100">{value || "-"}</span>;
  return <input className="field h-10 min-w-36" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function NumberBox({ value, onChange, suffix }: { value: number; onChange: (value: number) => void; suffix?: string }) {
  const readOnly = useReadOnly();
  if (readOnly) {
    return <span className="block min-w-28 text-sm font-medium text-zinc-800 dark:text-zinc-100">{format.format(value)}{suffix ? ` ${suffix}` : ""}</span>;
  }
  return (
    <div className="flex min-w-28 items-center gap-1">
      <input className="field h-10" inputMode="numeric" value={format.format(value)} onChange={(event) => onChange(toNumber(event.target.value))} />
      {suffix && <span className="text-sm text-zinc-500">{suffix}</span>}
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block min-w-32 text-sm text-zinc-800 dark:text-zinc-100">{value}</span>;
  return (
    <select className="field h-10 min-w-32" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function Button({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" title={label} className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" onClick={onClick}>
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-2 align-middle">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartBox({ children, tall = false }: { children: ReactElement; tall?: boolean }) {
  return (
    <div className={`mt-5 ${tall ? "h-80" : "h-64"}`}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
