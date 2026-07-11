import { ChangeEvent, PointerEvent, ReactElement, ReactNode, WheelEvent as ReactWheelEvent, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, Clipboard, LogOut, Maximize2, Minus, Moon, Pencil, Plus, RefreshCw, Sun, Trash2, Wallet, X } from "lucide-react";
import { BrandIcon, BrandKind, BrandLabel, BrandSelect, brandsByKind, getBrand } from "./brandLibrary";
import { AuthGate } from "./auth/AuthGate";
import { VaultSetup } from "./auth/VaultSetup";
import { VaultUnlock } from "./auth/VaultUnlock";
import { migrateLegacyEntriesIfAny } from "./auth/legacyMigration";
import { useEncryptedEntries } from "./hooks/useEncryptedEntries";
import { clearCachedDek, readCachedDek } from "./lib/dekCache";
import { supabase } from "./lib/supabase";

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
  included?: boolean;
  paymentDay?: string;
  category?: string;
};
type PaymentKind = "card" | "transfer" | "other";
type VariableExpense = { id: string; date: string; category: ExpenseCategory; amount: number; memo: string };
type SideIncome = { id: string; name: string; amount: number };
type InvestmentProduct = { id: string; destination: string; broker: string; ratio: number; accountType: string; accountNumber?: string };
type Account = { id: string; bank: string; name: string; number: string; type: AccountType };
type Card = { id: string; name: string; issuer: string; settlementAccount: string; settlementAccountId?: string };
type FlowPosition = { x: number; y: number };
type FlowNode = { id: string; title: string; subtitle: string; x: number; y: number; tone: "teal" | "indigo" | "amber" | "zinc"; brand?: string; brandKind?: BrandKind };
type FlowEdge = { from: string; to: string };
type CustomFlowEdge = FlowEdge & { id: string };

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
  fixedExpenseCategories: string[];
  analysisPeriod: Period;
  darkMode: boolean;
  flowPositions: Record<string, FlowPosition>;
  customFlowEdges: CustomFlowEdge[];
};

const ViewModeContext = createContext(true);
const useReadOnly = () => useContext(ViewModeContext);
const defaultExpenseCategories: string[] = ["식비", "병원", "의류", "여행", "경조사", "기타"];
const defaultFixedExpenseCategories: string[] = ["주거비", "통신비", "구독", "생활비", "보험", "교통", "기타"];
const paymentMethodOptions: string[] = ["카드", "계좌이체", "자동이체", "현금", "기타"];
const investmentAccountTypeOptions: string[] = ["위탁(일반)", "ISA", "해외주식", "연금저축", "IRP", "CMA", "기타"];

function paymentKind(method: string): PaymentKind {
  if (method.includes("카드")) return "card";
  if (method.includes("이체")) return "transfer";
  return "other";
}
const accountTypes: AccountType[] = ["급여통장", "생활비통장", "투자계좌", "비상금통장"];
// 카테고리 색상 팔레트 (등록 순으로 cycle)
const categoryPalette = ["#14b8a6", "#f59e0b", "#6366f1", "#ef4444", "#8b5cf6", "#0ea5e9", "#10b981", "#f97316", "#ec4899"];

const format = new Intl.NumberFormat("ko-KR");
const newId = () => crypto.randomUUID();
const won = (value: number) => `${format.format(Math.round(value || 0))}원`;
const toNumber = (value: string) => Number(value.replace(/,/g, "")) || 0;

const defaultData: DashboardData = {
  principles: "- 현금 500만원 유지\n- 병원비는 현금 사용\n- 경조사비는 현금 사용\n- 여행비는 현금 사용\n- 익월 급여일에 현금 복구",
  salary: 3000000,
  sideIncomes: [{ id: newId(), name: "부수입", amount: 200000 }],
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
    { id: newId(), destination: "ISA S&P500", broker: "미래에셋", ratio: 50, accountType: "ISA" },
    { id: newId(), destination: "QQQ", broker: "한국투자", ratio: 10, accountType: "해외주식" },
    { id: newId(), destination: "NVIDIA", broker: "한국투자", ratio: 10, accountType: "해외주식" },
    { id: newId(), destination: "Alphabet", broker: "한국투자", ratio: 5, accountType: "해외주식" },
    { id: newId(), destination: "SGOV", broker: "미래에셋", ratio: 25, accountType: "ISA" },
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
  fixedExpenseCategories: defaultFixedExpenseCategories,
  analysisPeriod: "monthly",
  darkMode: false,
  flowPositions: {},
  customFlowEdges: [],
};

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function normalizeDashboardData(raw: unknown): DashboardData {
  if (!raw || typeof raw !== "object") {
    return { ...defaultData, darkMode: prefersDark() };
  }
  const parsed = raw as Partial<DashboardData> & { sideIncome?: number };
  const next = { ...defaultData, ...parsed } as DashboardData;
  if (next.analysisPeriod !== "monthly" && next.analysisPeriod !== "yearly") next.analysisPeriod = "monthly";
  if (!Array.isArray(next.expenseCategories) || next.expenseCategories.length === 0) {
    next.expenseCategories = defaultExpenseCategories;
  }
  if (!Array.isArray(next.fixedExpenseCategories) || next.fixedExpenseCategories.length === 0) {
    next.fixedExpenseCategories = defaultFixedExpenseCategories;
  }
  if (!Array.isArray(next.sideIncomes)) {
    const legacy = typeof parsed.sideIncome === "number" ? parsed.sideIncome : 0;
    next.sideIncomes = legacy > 0 ? [{ id: newId(), name: "부수입", amount: legacy }] : [];
  }
  if (next.investmentBase === undefined) next.investmentBase = null;
  if (!Array.isArray(next.customFlowEdges)) next.customFlowEdges = [];
  if (Array.isArray(next.investmentProducts)) {
    next.investmentProducts = next.investmentProducts.map((item) => ({
      ...item,
      accountType: item.accountType && item.accountType.length > 0 ? item.accountType : "위탁(일반)",
    }));
  }
  return next;
}

interface DashboardProps {
  initialData: DashboardData;
  onChange: (next: DashboardData) => void;
  onSignOut?: () => void;
}

function Dashboard({ initialData, onChange, onSignOut }: DashboardProps) {
  const [savedData, setSavedData] = useState<DashboardData>(initialData);
  const [copyLabel, setCopyLabel] = useState("복사");
  const [variableDetailOpen, setVariableDetailOpen] = useState(false);
  const [fixedSort, setFixedSort] = useState<"input" | "name" | "amount-desc" | "amount-asc" | "day-asc" | "day-desc" | "method">("input");
  const [variableSort, setVariableSort] = useState<"date-desc" | "date-asc" | "input">("date-desc");
  const [flowNodeOpen, setFlowNodeOpen] = useState<string | null>(null);
  const [fixedCategoryFilter, setFixedCategoryFilter] = useState<"included" | "excluded" | "all">("included");
  const [portfolioListOpen, setPortfolioListOpen] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [cardsOpen, setCardsOpen] = useState(true);
  const [fixedDetailOpen, setFixedDetailOpen] = useState(true);
  const data = savedData;

  // 첫 마운트는 hydrate 결과 그대로이므로 onChange 트리거 skip — 이후 사용자 변경분만 위로 전달
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onChange(savedData);
  }, [savedData, onChange]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", data.darkMode);
  }, [data.darkMode]);

  const totalSideIncome = data.sideIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = data.salary + totalSideIncome;
  const includedFixed = data.fixedExpenses.filter((item) => item.included !== false);
  const sortedFixedExpenses = useMemo(() => {
    const arr = [...data.fixedExpenses];
    const dayOf = (item: FixedExpense) => {
      const n = Number(item.paymentDay);
      return Number.isFinite(n) && n > 0 ? n : Infinity;
    };
    switch (fixedSort) {
      case "name": arr.sort((a, b) => a.name.localeCompare(b.name, "ko")); break;
      case "amount-desc": arr.sort((a, b) => b.amount - a.amount); break;
      case "amount-asc": arr.sort((a, b) => a.amount - b.amount); break;
      case "day-asc": arr.sort((a, b) => dayOf(a) - dayOf(b)); break;
      case "day-desc": arr.sort((a, b) => dayOf(b) - dayOf(a)); break;
      case "method": arr.sort((a, b) => a.paymentMethod.localeCompare(b.paymentMethod, "ko")); break;
      default: break;
    }
    return arr;
  }, [data.fixedExpenses, fixedSort]);
  const sortedVariableExpenses = useMemo(() => {
    const arr = [...data.variableExpenses];
    switch (variableSort) {
      case "date-desc": arr.sort((a, b) => b.date.localeCompare(a.date)); break;
      case "date-asc": arr.sort((a, b) => a.date.localeCompare(b.date)); break;
      default: break;
    }
    return arr;
  }, [data.variableExpenses, variableSort]);
  const investmentBaseAmount = data.investmentBase ?? Math.max(totalIncome - includedFixed.reduce((sum, item) => sum + item.amount, 0), 0);
  const totalFixed = includedFixed.reduce((sum, item) => sum + item.amount, 0);
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
  const disposableIncome = totalIncome - totalFixed;

  const categoryStats = useMemo(() => {
    const cats = data.expenseCategories;
    const keyOf = (date: string) => {
      const d = new Date(`${date}T00:00:00`);
      return data.analysisPeriod === "yearly" ? `${d.getFullYear()}` : date.slice(0, 7);
    };
    const emptyCats = (): Record<string, number> => {
      const obj: Record<string, number> = {};
      for (const c of cats) obj[c] = 0;
      return obj;
    };
    // 변동지출 전체에서 등장한 모든 월/연 을 키로 두고 등록된 카테고리 amount 를 누적
    const groups: Record<string, Record<string, number>> = {};
    for (const item of data.variableExpenses) {
      const key = keyOf(item.date);
      if (!groups[key]) groups[key] = emptyCats();
    }
    for (const item of data.variableExpenses) {
      if (!cats.includes(item.category)) continue;
      const key = keyOf(item.date);
      groups[key][item.category] += item.amount;
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({ period, ...values }));
  }, [data.variableExpenses, data.analysisPeriod, data.expenseCategories]);

  const categoryLegend = useMemo(
    () => data.expenseCategories.map((cat, i) => ({ key: cat, color: categoryPalette[i % categoryPalette.length] })),
    [data.expenseCategories],
  );

  const fixedCategoryStats = useMemo(() => {
    const filtered = data.fixedExpenses.filter((item) => {
      if (fixedCategoryFilter === "included") return item.included !== false;
      if (fixedCategoryFilter === "excluded") return item.included === false;
      return true;
    });
    // 등록된 카테고리 순서를 유지하고 미등록/기타 카테고리는 뒤에 붙여 팔레트 색이 안정적으로 배정되게
    const catOrder: string[] = [...data.fixedExpenseCategories];
    const totals = new Map<string, number>();
    for (const cat of catOrder) totals.set(cat, 0);
    for (const item of filtered) {
      const cat = item.category && item.category.length > 0 ? item.category : "기타";
      if (!totals.has(cat)) {
        totals.set(cat, 0);
        catOrder.push(cat);
      }
      totals.set(cat, (totals.get(cat) ?? 0) + item.amount);
    }
    return catOrder
      .map((name, index) => ({ name, value: totals.get(name) ?? 0, color: categoryPalette[index % categoryPalette.length] }))
      .filter((row) => row.value > 0);
  }, [data.fixedExpenses, data.fixedExpenseCategories, fixedCategoryFilter]);

  const fixedCategoryTotal = fixedCategoryStats.reduce((sum, item) => sum + item.value, 0);

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
      lines.push(getBrand(broker, "sec")?.name ?? broker);
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
      nodes.push({ id: key, title: accountLabel(salary), subtitle: salary.type, tone: "teal", brand: salary.bank, brandKind: "bank", ...position(key, { x: 28, y: 150 }) });
    }
    if (living) {
      const key = flowKey("account", living.id);
      nodes.push({ id: key, title: accountLabel(living), subtitle: living.type, tone: "indigo", brand: living.bank, brandKind: "bank", ...position(key, { x: 300, y: 150 }) });
    }
    investments.forEach((item, index) => {
      const key = flowKey("account", item.id);
      nodes.push({ id: key, title: accountLabel(item), subtitle: item.type, tone: "amber", brand: item.bank, brandKind: "sec", ...position(key, { x: 570, y: 40 + index * 110 }) });
    });
    others.forEach((item, index) => {
      const key = flowKey("account", item.id);
      nodes.push({ id: key, title: accountLabel(item), subtitle: item.type, tone: "indigo", brand: item.bank, brandKind: "bank", ...position(key, { x: 570, y: 380 + index * 110 }) });
    });

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
      nodes.push({ id: cardKey, title: card.name || "카드", subtitle: card.issuer || "카드사", tone: "zinc", brand: card.issuer, brandKind: "card", ...position(cardKey, { x: 28, y: 320 + index * 110 }) });
      const matched = card.settlementAccountId
        ? data.accounts.find((item) => item.id === card.settlementAccountId)
        : matchAccount(card.settlementAccount || "");
      if (matched) {
        edges.push({ from: cardKey, to: flowKey("account", matched.id) });
      } else if (card.settlementAccount) {
        const settleKey = flowKey("settlement", card.settlementAccount);
        if (!nodes.find((node) => node.id === settleKey)) {
          nodes.push({ id: settleKey, title: card.settlementAccount, subtitle: "결제계좌", tone: "zinc", brand: card.settlementAccount, brandKind: "bank", ...position(settleKey, { x: 300, y: 320 + index * 110 }) });
        }
        edges.push({ from: cardKey, to: settleKey });
      }
    });
    const customEdges = (data.customFlowEdges ?? []).filter(
      (edge) => nodes.some((node) => node.id === edge.from) && nodes.some((node) => node.id === edge.to),
    );
    return { nodes, edges, customEdges };
  }, [data.accounts, data.cards, data.flowPositions, data.customFlowEdges]);

  const copyExecution = async () => {
    await navigator.clipboard.writeText(executionText);
    setCopyLabel("복사됨");
    window.setTimeout(() => setCopyLabel("복사"), 1200);
  };

  const updateFlowPosition = (nodeId: string, position: FlowPosition) => {
    setSavedData((current) => ({ ...current, flowPositions: { ...current.flowPositions, [nodeId]: position } }));
  };
  const resetFlow = (nodeIds: string[]) => {
    setSavedData((current) => {
      const next = { ...current.flowPositions };
      nodeIds.forEach((nodeId) => delete next[nodeId]);
      return { ...current, flowPositions: next };
    });
  };
  const addCustomEdge = (from: string, to: string) => {
    if (from === to) return;
    setSavedData((current) => {
      const exists = (current.customFlowEdges ?? []).some((edge) => edge.from === from && edge.to === to);
      if (exists) return current;
      return { ...current, customFlowEdges: [...(current.customFlowEdges ?? []), { id: newId(), from, to }] };
    });
  };
  const removeCustomEdge = (edgeId: string) => {
    setSavedData((current) => ({ ...current, customFlowEdges: (current.customFlowEdges ?? []).filter((edge) => edge.id !== edgeId) }));
  };

  return (
    <main
      className="min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-100 text-zinc-950 antialiased transition-colors dark:bg-zinc-950 dark:text-zinc-50"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-5 px-5 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">개인 재무 대시보드</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onSignOut && (
                <IconToggle
                  label="로그아웃"
                  icon={<LogOut size={16} />}
                  onClick={onSignOut}
                />
              )}
              <IconToggle
                label="예시 데이터 비우기"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  if (!window.confirm("모든 항목(수입·지출·포트폴리오·계좌·카드 등)을 비웁니다. 다크모드/원칙 텍스트는 유지됩니다. 계속할까요?")) return;
                  const cleared: DashboardData = {
                    ...defaultData,
                    salary: 0,
                    sideIncomes: [],
                    fixedExpenses: [],
                    variableExpenses: [],
                    investmentProducts: [],
                    accounts: [],
                    cards: [],
                    investmentBase: null,
                    flowPositions: {},
                    customFlowEdges: [],
                    darkMode: data.darkMode,
                    principles: data.principles,
                    expenseCategories: data.expenseCategories,
                    analysisPeriod: data.analysisPeriod,
                  };
                  setSavedData(cleared);
                }}
              />
              <IconToggle
                label={data.darkMode ? "라이트모드로 전환" : "다크모드로 전환"}
                icon={data.darkMode ? <Sun size={16} /> : <Moon size={16} />}
                onClick={() => setSavedData((current) => ({ ...current, darkMode: !current.darkMode }))}
              />
            </div>
          </div>
        </header>

        <section className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <IncomeBox
              salary={savedData.salary}
              sideIncomes={savedData.sideIncomes}
              onSave={(next) => setSavedData((current) => ({ ...current, salary: next.salary, sideIncomes: next.sideIncomes }))}
            />
          </div>
          <Metric title="총 고정 지출" value={won(totalFixed)} detail={`${includedFixed.length}/${data.fixedExpenses.length}개 항목`} icon={<ArrowDownRight size={16} />} accent="rose" />
          <Metric title="가처분소득" value={won(disposableIncome)} detail={`총 수입 ${won(totalIncome)} - 총 고정지출 ${won(totalFixed)}`} icon={<Wallet size={16} />} accent="indigo" />
        </section>

        <Section title="포트폴리오">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <InvestmentBaseControl value={data.investmentBase} fallback={Math.max(disposableIncome, 0)} onChange={(value) => setSavedData((current) => ({ ...current, investmentBase: value }))} />
              <Readout label="투자 비율 합계" value={`${totalInvestmentRatio}%`} intent={totalInvestmentRatio === 100 ? "good" : "warn"} />
              {totalInvestmentRatio < 100 && <p className="text-sm font-medium text-amber-700 dark:text-amber-300">투자 비율 합계가 100% 미만입니다.</p>}
            </div>
            <Button
              label="추가"
              icon={<Plus size={16} />}
              onClick={() => setSavedData((current) => ({
                ...current,
                investmentProducts: [...current.investmentProducts, { id: newId(), destination: "", broker: "", ratio: 0, accountType: "위탁(일반)" }],
              }))}
            />
          </div>
          <PortfolioDonut products={data.investmentProducts} baseAmount={investmentBaseAmount} />
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-left ring-1 ring-zinc-200/60 transition hover:bg-zinc-100 dark:bg-zinc-950 dark:ring-zinc-800 dark:hover:bg-zinc-800/60"
            aria-expanded={portfolioListOpen}
            onClick={() => setPortfolioListOpen((open) => !open)}
          >
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">종목 목록</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{data.investmentProducts.length}건</span>
            </span>
            <ChevronDown size={16} className={`text-zinc-500 transition dark:text-zinc-400 ${portfolioListOpen ? "rotate-180" : ""}`} />
          </button>
          {portfolioListOpen && (
            <div className="mt-3">
              <EditableTable<InvestmentProduct>
                columns={["투자처", "증권사", "증권계좌 유형", "증권계좌번호", "투자비율", "투자금액"]}
                columnWidths={["7rem", "9rem", "9.5rem", "9rem", "5.5rem", "8.5rem"]}
                items={data.investmentProducts}
                emptyMessage="투자 항목을 추가하면 표시됩니다."
                displayCells={(item) => [
                  <span className="text-sm">{item.destination || "-"}</span>,
                  <BrandLabel brand={item.broker} hint="sec" size={24} />,
                  <span className="text-sm">{item.accountType}</span>,
                  <span className="text-sm tabular-nums">{item.accountNumber || "-"}</span>,
                  <span className="text-sm tabular-nums">{item.ratio}%</span>,
                  <span className="text-sm font-medium tabular-nums">{won(investmentBaseAmount * (item.ratio / 100))}</span>,
                ]}
                editCells={(draft, setDraft) => [
                  <Text value={draft.destination} onChange={(value) => setDraft({ ...draft, destination: value })} />,
                  <BrandField value={draft.broker} kind="sec" onChange={(value) => setDraft({ ...draft, broker: value })} />,
                  <InvestmentAccountTypeSelect value={draft.accountType} onChange={(value) => setDraft({ ...draft, accountType: value })} />,
                  <Text value={draft.accountNumber ?? ""} onChange={(value) => setDraft({ ...draft, accountNumber: value })} />,
                  <NumberBox value={draft.ratio} suffix="%" onChange={(value) => setDraft({ ...draft, ratio: Math.min(value, 100) })} />,
                  <span className="text-sm font-medium tabular-nums text-zinc-500">{won(investmentBaseAmount * (draft.ratio / 100))}</span>,
                ]}
                onSave={(original, draft) => {
                  const next = data.investmentProducts.map((row) => (row.id === original.id ? { ...draft, id: original.id } : row));
                  if (next.reduce((sum, row) => sum + row.ratio, 0) > 100) {
                    window.alert("투자 비율 합계가 100%를 초과할 수 없습니다.");
                    return;
                  }
                  setSavedData((current) => ({ ...current, investmentProducts: next }));
                }}
                onDelete={(item) => setSavedData((current) => ({ ...current, investmentProducts: current.investmentProducts.filter((row) => row.id !== item.id) }))}
              />
            </div>
          )}
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">투자 실행</h3>
              <Button label={copyLabel} icon={<Clipboard size={16} />} onClick={copyExecution} />
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-6">{executionText}</pre>
          </div>
        </Section>

        <Section title="지출 흐름도">
          <EditableFlow
            nodes={expenseFlow.nodes}
            edges={expenseFlow.edges}
            customEdges={expenseFlow.customEdges}
            onMove={updateFlowPosition}
            onAddCustomEdge={addCustomEdge}
            onRemoveCustomEdge={removeCustomEdge}
            onNodeOpen={setFlowNodeOpen}
            onNodeDelete={(nodeId) => {
              const [scope, rawId] = nodeId.split(":");
              setSavedData((current) => {
                const next = { ...current };
                if (scope === "account") {
                  next.accounts = current.accounts.filter((row) => row.id !== rawId);
                  next.cards = current.cards.map((row) => (row.settlementAccountId === rawId ? { ...row, settlementAccountId: undefined } : row));
                } else if (scope === "card") {
                  next.cards = current.cards.filter((row) => row.id !== rawId);
                }
                next.customFlowEdges = (current.customFlowEdges ?? []).filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
                const positions = { ...current.flowPositions };
                delete positions[nodeId];
                next.flowPositions = positions;
                return next;
              });
            }}
            onAddAccount={() => setSavedData((current) => ({
              ...current,
              accounts: [...current.accounts, { id: newId(), bank: "", name: "새 계좌", number: "", type: "생활비통장" }],
            }))}
            onAddCard={() => setSavedData((current) => ({
              ...current,
              cards: [...current.cards, { id: newId(), name: "새 카드", issuer: "", settlementAccount: "" }],
            }))}
            action={<Button label="배치 초기화" icon={<RefreshCw size={16} />} onClick={() => resetFlow(expenseFlow.nodes.map((node) => node.id))} />}
          />
          {flowNodeOpen && (
            <FlowNodeDialog
              nodeId={flowNodeOpen}
              accounts={data.accounts}
              cards={data.cards}
              onClose={() => setFlowNodeOpen(null)}
              onSaveAccount={(id, next) => setSavedData((current) => ({ ...current, accounts: current.accounts.map((row) => (row.id === id ? { ...next, id } : row)) }))}
              onSaveCard={(id, next) => setSavedData((current) => ({ ...current, cards: current.cards.map((row) => (row.id === id ? { ...next, id } : row)) }))}
            />
          )}
          <div className="mt-5 flex flex-col gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md py-1 pr-1 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  aria-expanded={accountsOpen}
                  onClick={() => setAccountsOpen((open) => !open)}
                >
                  <h3 className="text-sm font-bold tracking-tight">계좌</h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{data.accounts.length}건</span>
                  <ChevronDown size={14} className={`text-zinc-500 transition dark:text-zinc-400 ${accountsOpen ? "rotate-180" : ""}`} />
                </button>
                <Button
                  label="추가"
                  icon={<Plus size={16} />}
                  onClick={() => setSavedData((current) => ({
                    ...current,
                    accounts: [...current.accounts, { id: newId(), bank: "", name: "", number: "", type: "생활비통장" }],
                  }))}
                />
              </div>
              {accountsOpen && (
                <EditableTable<Account>
                  columns={["은행/증권사", "계좌명", "계좌번호", "유형"]}
                  columnWidths={["10rem", undefined, undefined, "7rem"]}
                  items={data.accounts}
                  emptyMessage="계좌를 추가하면 흐름도에 노드가 표시됩니다."
                  displayCells={(item) => [
                    <BrandLabel brand={item.bank} hint={item.type === "투자계좌" ? "sec" : "bank"} size={24} />,
                    <span className="text-sm">{item.name || "-"}</span>,
                    <span className="text-sm tabular-nums">{item.number || "-"}</span>,
                    <span className="text-sm">{item.type}</span>,
                  ]}
                  editCells={(draft, setDraft) => [
                    <BrandField value={draft.bank} kind={draft.type === "투자계좌" ? "sec" : "bank"} onChange={(value) => setDraft({ ...draft, bank: value })} />,
                    <Text value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />,
                    <Text value={draft.number} onChange={(value) => setDraft({ ...draft, number: value })} />,
                    <Select value={draft.type} options={accountTypes} onChange={(value) => setDraft({ ...draft, type: value as AccountType })} />,
                  ]}
                  onSave={(original, draft) => setSavedData((current) => ({ ...current, accounts: current.accounts.map((row) => (row.id === original.id ? { ...draft, id: original.id } : row)) }))}
                  onDelete={(item) => setSavedData((current) => ({ ...current, accounts: current.accounts.filter((row) => row.id !== item.id) }))}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md py-1 pr-1 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  aria-expanded={cardsOpen}
                  onClick={() => setCardsOpen((open) => !open)}
                >
                  <h3 className="text-sm font-bold tracking-tight">카드</h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{data.cards.length}건</span>
                  <ChevronDown size={14} className={`text-zinc-500 transition dark:text-zinc-400 ${cardsOpen ? "rotate-180" : ""}`} />
                </button>
                <Button
                  label="추가"
                  icon={<Plus size={16} />}
                  onClick={() => setSavedData((current) => ({
                    ...current,
                    cards: [...current.cards, { id: newId(), name: "", issuer: "", settlementAccount: "" }],
                  }))}
                />
              </div>
              {cardsOpen && (
                <EditableTable<Card>
                  columns={["카드명", "카드사", "결제계좌"]}
                  columnWidths={[undefined, "10rem", undefined]}
                  items={data.cards}
                  emptyMessage="카드를 추가하면 흐름도에 노드가 표시됩니다."
                  displayCells={(item) => {
                    const matched = data.accounts.find((account) => account.id === item.settlementAccountId);
                    const settle = matched
                      ? `${getBrand(matched.bank, matched.type === "투자계좌" ? "sec" : "bank")?.name ?? matched.bank} ${matched.name}`.trim()
                      : item.settlementAccount || "-";
                    return [
                      <span className="text-sm">{item.name || "-"}</span>,
                      <BrandLabel brand={item.issuer} hint="card" size={24} />,
                      <span className="text-sm">{settle}</span>,
                    ];
                  }}
                  editCells={(draft, setDraft) => [
                    <Text value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />,
                    <BrandField value={draft.issuer} kind="card" onChange={(value) => setDraft({ ...draft, issuer: value })} />,
                    <SettlementAccountSelect
                      value={draft.settlementAccountId ?? ""}
                      legacyText={draft.settlementAccount}
                      accounts={data.accounts}
                      onChange={(value) => setDraft({ ...draft, settlementAccountId: value, settlementAccount: "" })}
                    />,
                  ]}
                  onSave={(original, draft) => setSavedData((current) => ({ ...current, cards: current.cards.map((row) => (row.id === original.id ? { ...draft, id: original.id } : row)) }))}
                  onDelete={(item) => setSavedData((current) => ({ ...current, cards: current.cards.filter((row) => row.id !== item.id) }))}
                />
              )}
            </div>
          </div>
        </Section>

        <Section title="고정 지출">
          <div className="-mt-2 mb-3 flex items-center justify-between gap-2">
            <Button
              label="추가"
              icon={<Plus size={16} />}
              onClick={() => {
                setSavedData((current) => ({
                  ...current,
                  fixedExpenses: [...current.fixedExpenses, { id: newId(), name: "", amount: 0, paymentMethod: "카드", included: true, paymentDay: "", category: current.fixedExpenseCategories[0] ?? "기타" }],
                }));
                setFixedDetailOpen(true);
              }}
            />
            <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
              정렬
              <select
                className="field h-9 w-32 text-xs"
                aria-label="정렬"
                value={fixedSort}
                onChange={(event) => setFixedSort(event.target.value as typeof fixedSort)}
              >
                <option value="input">입력 순</option>
                <option value="name">이름 순</option>
                <option value="amount-desc">금액 ↓</option>
                <option value="amount-asc">금액 ↑</option>
                <option value="day-asc">이체일 ↑</option>
                <option value="day-desc">이체일 ↓</option>
                <option value="method">결제수단 순</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-left ring-1 ring-zinc-200/60 transition hover:bg-zinc-100 dark:bg-zinc-950 dark:ring-zinc-800 dark:hover:bg-zinc-800/60"
            aria-expanded={fixedDetailOpen}
            onClick={() => setFixedDetailOpen((open) => !open)}
          >
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">상세 내역</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{data.fixedExpenses.length}건</span>
            </span>
            <ChevronDown size={16} className={`text-zinc-500 transition dark:text-zinc-400 ${fixedDetailOpen ? "rotate-180" : ""}`} />
          </button>
          {fixedDetailOpen && (
            <div className="mt-3">
              <EditableTable<FixedExpense>
                columns={["포함", "카테고리", "이름", "금액", "이체일", "결제수단", "결제 은행/카드사", "결제 계좌/카드명"]}
                columnWidths={["4.5rem", "8rem", "8rem", "7rem", "7rem", "6.5rem", "10rem", "9rem"]}
                items={sortedFixedExpenses}
                displayCells={(item) => {
                  const kind = paymentKind(item.paymentMethod);
                  const brandValue = kind === "card" ? item.cardIssuer : kind === "transfer" ? item.bank : "";
                  const detailValue = kind === "card" ? item.cardName : kind === "transfer" ? item.account : "";
                  return [
                    <span className={`inline-flex h-6 items-center justify-center rounded-full px-2 text-[11px] font-medium ${item.included !== false ? "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>{item.included !== false ? "포함" : "제외"}</span>,
                    <span className="text-sm">{item.category || "-"}</span>,
                    <span className="block min-w-0 truncate text-sm" title={item.name || "-"}>{item.name || "-"}</span>,
                    <span className="text-sm tabular-nums">{format.format(item.amount)}</span>,
                    <span className="text-sm tabular-nums">{item.paymentDay ? `${item.paymentDay}일` : "-"}</span>,
                    <span className="text-sm">{item.paymentMethod || "-"}</span>,
                    kind === "other" ? <span className="text-sm text-zinc-400">-</span> : <BrandLabel brand={brandValue} hint={kind === "card" ? "card" : "bank"} size={24} />,
                    <span className="text-sm">{kind === "other" ? "-" : (detailValue || "-")}</span>,
                  ];
                }}
                editCells={(draft, setDraft) => {
                  const kind = paymentKind(draft.paymentMethod);
                  return [
                    <IncludedToggle value={draft.included !== false} onChange={(value) => setDraft({ ...draft, included: value })} />,
                    <CategorySelect
                      value={draft.category ?? ""}
                      options={data.fixedExpenseCategories}
                      onChange={(value) => setDraft({ ...draft, category: value })}
                      onAddCategory={(name) => setSavedData((current) => ({ ...current, fixedExpenseCategories: Array.from(new Set([...current.fixedExpenseCategories, name])) }))}
                    />,
                    <Text value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />,
                    <NumberBox value={draft.amount} onChange={(value) => setDraft({ ...draft, amount: value })} />,
                    <PaymentDayField value={draft.paymentDay ?? ""} onChange={(value) => setDraft({ ...draft, paymentDay: value })} />,
                    <PaymentMethodSelect value={draft.paymentMethod} onChange={(value) => setDraft({ ...draft, paymentMethod: value })} />,
                    <PaymentBrandField
                      kind={kind}
                      cardValue={draft.cardIssuer ?? ""}
                      transferValue={draft.bank ?? ""}
                      onCardChange={(value) => setDraft({ ...draft, cardIssuer: value })}
                      onTransferChange={(value) => setDraft({ ...draft, bank: value })}
                    />,
                    <PaymentDetailField
                      kind={kind}
                      cardValue={draft.cardName ?? ""}
                      transferValue={draft.account ?? ""}
                      onCardChange={(value) => setDraft({ ...draft, cardName: value })}
                      onTransferChange={(value) => setDraft({ ...draft, account: value })}
                    />,
                  ];
                }}
                onSave={(original, draft) => setSavedData((current) => ({ ...current, fixedExpenses: current.fixedExpenses.map((row) => (row.id === original.id ? { ...draft, id: original.id } : row)) }))}
                onDelete={(item) => setSavedData((current) => ({ ...current, fixedExpenses: current.fixedExpenses.filter((row) => row.id !== item.id) }))}
              />
            </div>
          )}
          <div className="mt-4"><Readout label="총 고정 지출" value={won(totalFixed)} /></div>

          <div className="mt-4 rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight">카테고리별 지출 통계</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {fixedCategoryFilter === "included" ? "포함 항목" : fixedCategoryFilter === "excluded" ? "제외 항목" : "전체 항목"} 카테고리 분포
                </p>
              </div>
              <IncludeFilterTabs value={fixedCategoryFilter} onChange={setFixedCategoryFilter} />
            </div>
            {fixedCategoryStats.length === 0 ? (
              <p className="mt-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">해당 조건의 고정지출이 없습니다.</p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
                <div className="relative mx-auto h-[200px] w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={fixedCategoryStats} dataKey="value" innerRadius={56} outerRadius={84} stroke="none" paddingAngle={1.5}>
                        {fixedCategoryStats.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CategoryDonutTooltip />} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: true, y: true }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">합계</span>
                    <span className="mt-0.5 text-base font-bold tabular-nums">{won(fixedCategoryTotal)}</span>
                  </div>
                </div>
                <ul className="grid gap-2 text-sm">
                  {fixedCategoryStats.map((item) => {
                    const percent = fixedCategoryTotal > 0 ? Math.round((item.value / fixedCategoryTotal) * 100) : 0;
                    return (
                      <li key={item.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                        <span className="min-w-0 truncate font-medium">{item.name}</span>
                        <span className="ml-auto whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">{percent}%</span>
                        <span className="w-24 text-right font-semibold tabular-nums">{won(item.value)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </Section>

        <Section title="변동 지출">
          <div className="-mt-2 mb-3 flex items-center justify-between gap-2">
            <Button
              label="추가"
              icon={<Plus size={16} />}
              onClick={() => {
                setSavedData((current) => ({
                  ...current,
                  variableExpenses: [
                    ...current.variableExpenses,
                    { id: newId(), date: new Date().toISOString().slice(0, 10), category: current.expenseCategories[0] ?? "기타", amount: 0, memo: "" },
                  ],
                }));
                setVariableDetailOpen(true);
              }}
            />
            <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
              정렬
              <select
                className="field h-9 w-32 text-xs"
                aria-label="정렬"
                value={variableSort}
                onChange={(event) => setVariableSort(event.target.value as typeof variableSort)}
              >
                <option value="date-desc">최신순</option>
                <option value="date-asc">오래된순</option>
                <option value="input">입력 순</option>
              </select>
            </label>
          </div>
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
              <EditableTable<VariableExpense>
                columns={["날짜", "카테고리", "금액", "메모"]}
                columnWidths={["8rem", "8rem", "7rem", undefined]}
                items={sortedVariableExpenses}
                displayCells={(item) => [
                  <span className="text-sm tabular-nums">{item.date}</span>,
                  <span className="text-sm">{item.category}</span>,
                  <span className="text-sm tabular-nums">{format.format(item.amount)}</span>,
                  <span className="text-sm">{item.memo || "-"}</span>,
                ]}
                editCells={(draft, setDraft) => [
                  <div className="flex w-full">
                    <input
                      className="field h-10 min-w-0 flex-1 text-left [&::-webkit-date-and-time-value]:text-left"
                      type="date"
                      value={draft.date}
                      onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                    />
                  </div>,
                  <CategorySelect
                    value={draft.category}
                    options={data.expenseCategories}
                    onChange={(value) => setDraft({ ...draft, category: value })}
                    onAddCategory={(name) => setSavedData((current) => ({ ...current, expenseCategories: Array.from(new Set([...current.expenseCategories, name])) }))}
                  />,
                  <NumberBox value={draft.amount} onChange={(value) => setDraft({ ...draft, amount: value })} />,
                  <Text value={draft.memo} onChange={(value) => setDraft({ ...draft, memo: value })} />,
                ]}
                onSave={(original, draft) => setSavedData((current) => ({ ...current, variableExpenses: current.variableExpenses.map((row) => (row.id === original.id ? { ...draft, id: original.id } : row)) }))}
                onDelete={(item) => setSavedData((current) => ({ ...current, variableExpenses: current.variableExpenses.filter((row) => row.id !== item.id) }))}
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
            {variableByMonth.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">변동 지출을 추가하면 월별 추세가 표시됩니다.</p>
            ) : (
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
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight">카테고리별 지출 통계</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">등록된 모든 변동지출 카테고리 월간 누적</p>
              </div>
              <PeriodTabs value={data.analysisPeriod} onChange={(value) => setSavedData((current) => ({ ...current, analysisPeriod: value }))} />
            </div>
            <CategoryLegend categories={categoryLegend} />
            {categoryStats.length === 0 ? (
              <p className="mt-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">아직 변동지출 기록이 없습니다.</p>
            ) : (
              <ChartBox tall>
                <BarChart data={categoryStats} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={28}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                  <XAxis dataKey="period" tickFormatter={(value) => formatPeriodLabel(value, data.analysisPeriod)} tickLine={false} axisLine={false} tick={chartTick} />
                  <YAxis tickFormatter={formatWonAxis} tickLine={false} axisLine={false} width={48} tick={chartTick} />
                  <Tooltip content={<MoneyTooltip labelFormatter={(value) => formatPeriodLabel(String(value), data.analysisPeriod)} />} cursor={{ fill: "currentColor", fillOpacity: 0.04 }} />
                  {categoryLegend.map((item) => (
                    <Bar
                      key={item.key}
                      dataKey={item.key}
                      stackId="a"
                      fill={item.color}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ChartBox>
            )}
          </div>
        </Section>

        <Section title="자산 운영 원칙">
          <EditableBox<string>
            value={savedData.principles}
            onSave={(next) => setSavedData((current) => ({ ...current, principles: next }))}
            display={(value) => (
              <div className="markdown-preview min-h-32 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <ReactMarkdown>{value}</ReactMarkdown>
              </div>
            )}
            edit={(draft, setDraft) => (
              <div className="grid gap-4 lg:grid-cols-2">
                <textarea
                  className="field min-h-56 resize-y py-3"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  autoFocus
                />
                <div className="markdown-preview min-h-56 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <ReactMarkdown>{draft}</ReactMarkdown>
                </div>
              </div>
            )}
          />
        </Section>

      </div>
    </main>
  );
}

function FlowNodeDialog({
  nodeId,
  accounts,
  cards,
  onClose,
  onSaveAccount,
  onSaveCard,
}: {
  nodeId: string;
  accounts: Account[];
  cards: Card[];
  onClose: () => void;
  onSaveAccount: (id: string, next: Account) => void;
  onSaveCard: (id: string, next: Card) => void;
}) {
  const [scope, rawId] = nodeId.split(":");
  const isAccount = scope === "account";
  const isCard = scope === "card";
  const original = isAccount
    ? accounts.find((account) => account.id === rawId)
    : isCard
      ? cards.find((card) => card.id === rawId)
      : null;
  const [draft, setDraft] = useState<Account | Card | null>(original ? { ...original } : null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!original || !draft) {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 px-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">이 노드의 데이터를 찾을 수 없습니다. (settlement 노드일 수 있습니다)</p>
          <div className="mt-4 flex justify-end">
            <button type="button" className="inline-flex h-9 items-center rounded-full bg-teal-700 px-4 text-sm font-semibold text-white dark:bg-teal-500 dark:text-zinc-950" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    );
  }

  const save = () => {
    if (isAccount) onSaveAccount(rawId, draft as Account);
    if (isCard) onSaveCard(rawId, draft as Card);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-base font-bold tracking-tight">{isAccount ? "계좌 편집" : "카드 편집"}</h2>
        <ViewModeContext.Provider value={false}>
          <div className="mt-4 flex flex-col gap-3">
            {isAccount && (() => {
              const account = draft as Account;
              return (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">은행/증권사</span>
                    <BrandField value={account.bank} kind={account.type === "투자계좌" ? "sec" : "bank"} onChange={(value) => setDraft({ ...account, bank: value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">계좌명</span>
                    <input className="field h-10" value={account.name} onChange={(event) => setDraft({ ...account, name: event.target.value })} autoFocus />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">계좌번호</span>
                    <input className="field h-10" value={account.number} onChange={(event) => setDraft({ ...account, number: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">유형</span>
                    <select className="field h-10" value={account.type} onChange={(event) => setDraft({ ...account, type: event.target.value as AccountType })}>
                      {accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                </>
              );
            })()}
            {isCard && (() => {
              const card = draft as Card;
              return (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">카드명</span>
                    <input className="field h-10" value={card.name} onChange={(event) => setDraft({ ...card, name: event.target.value })} autoFocus />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">카드사</span>
                    <BrandField value={card.issuer} kind="card" onChange={(value) => setDraft({ ...card, issuer: value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">결제계좌</span>
                    <SettlementAccountSelect
                      value={card.settlementAccountId ?? ""}
                      legacyText={card.settlementAccount}
                      accounts={accounts}
                      onChange={(value) => setDraft({ ...card, settlementAccountId: value, settlementAccount: "" })}
                    />
                  </label>
                </>
              );
            })()}
          </div>
        </ViewModeContext.Provider>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" className="inline-flex h-9 items-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" onClick={onClose}>취소</button>
          <button type="button" className="inline-flex h-9 items-center rounded-full bg-teal-700 px-4 text-xs font-semibold text-white dark:bg-teal-500 dark:text-zinc-950" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  );
}

function IncludeFilterTabs({ value, onChange }: { value: "included" | "excluded" | "all"; onChange: (value: "included" | "excluded" | "all") => void }) {
  const items: { value: "included" | "excluded" | "all"; label: string }[] = [
    { value: "included", label: "포함" },
    { value: "excluded", label: "제외" },
    { value: "all", label: "전체" },
  ];
  return (
    <div role="tablist" aria-label="포함/제외 필터" className="inline-flex h-9 rounded-md border border-zinc-200 bg-white p-0.5 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            className={`min-w-12 rounded px-3 transition ${active ? "bg-teal-700 text-white shadow-sm dark:bg-teal-500 dark:text-zinc-950" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
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

function flowKey(scope: string, id: string) {
  return `${scope}:${id}`;
}

type Viewport = { scale: number; x: number; y: number };
const minScale = 0.4;
const maxScale = 2.5;
const initialViewport: Viewport = { scale: 1, x: 0, y: 0 };

function EditableFlow({
  nodes,
  edges,
  customEdges,
  onMove,
  onAddCustomEdge,
  onRemoveCustomEdge,
  onNodeOpen,
  onNodeDelete,
  onAddAccount,
  onAddCard,
  action,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  customEdges: CustomFlowEdge[];
  onMove: (nodeId: string, position: FlowPosition) => void;
  onAddCustomEdge: (from: string, to: string) => void;
  onRemoveCustomEdge: (edgeId: string) => void;
  onNodeOpen?: (nodeId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onAddAccount?: () => void;
  onAddCard?: () => void;
  action?: ReactNode;
}) {
  const readOnly = false;
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<Viewport>(initialViewport);
  viewportRef.current = viewport;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  useEffect(() => {
    if (!connectMode) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConnectMode(false);
        setConnectFrom(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [connectMode]);

  useEffect(() => {
    if (readOnly && connectMode) {
      setConnectMode(false);
      setConnectFrom(null);
    }
  }, [readOnly, connectMode]);

  const handleNodeClick = (node: FlowNode) => {
    if (!connectMode) {
      onNodeOpen?.(node.id);
      return;
    }
    if (!connectFrom) {
      setConnectFrom(node.id);
      setHoverPoint({ x: node.x + 90, y: node.y + 42 });
      return;
    }
    if (connectFrom === node.id) {
      setConnectFrom(null);
      setHoverPoint(null);
      return;
    }
    onAddCustomEdge(connectFrom, node.id);
    setConnectFrom(null);
    setHoverPoint(null);
  };

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
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const coords = toContentCoords(event.clientX, event.clientY);
    if (!coords) return;
    if (!drag.moved) {
      const dist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (dist < 4) return;
      drag.moved = true;
    }
    onMove(drag.id, { x: coords.x - drag.offsetX, y: coords.y - drag.offsetY });
  };

  const stopDrag = (event: PointerEvent<HTMLButtonElement>, node: FlowNode) => {
    const drag = dragRef.current;
    const wasMoved = drag?.moved ?? false;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!wasMoved) handleNodeClick(node);
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
    if (connectMode && connectFrom) {
      const coords = toContentCoords(event.clientX, event.clientY);
      if (coords) setHoverPoint(coords);
    }
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
        <div className="inline-flex h-9 items-center gap-0.5 rounded-full border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
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
        <div className="flex flex-wrap items-center gap-2">
          {onAddAccount && (
            <button
              type="button"
              onClick={onAddAccount}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus size={14} /> 계좌
            </button>
          )}
          {onAddCard && (
            <button
              type="button"
              onClick={onAddCard}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus size={14} /> 카드
            </button>
          )}
          <button
            type="button"
            aria-pressed={connectMode}
            onClick={() => { setConnectFrom(null); setConnectMode((value) => !value); }}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${connectMode ? "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
          >
            {connectMode ? (connectFrom ? "두 번째 노드 선택…" : "연결 모드 ON · ESC로 종료") : "연결 추가"}
          </button>
          {action}
        </div>
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
                  key={`auto-${edge.from}-${edge.to}`}
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
            {customEdges.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={`custom-${edge.id}`}
                  x1={from.x + 180}
                  y1={from.y + 42}
                  x2={to.x}
                  y2={to.y + 42}
                  className="text-teal-500 dark:text-teal-400"
                  stroke="currentColor"
                  strokeWidth="2"
                  markerEnd="url(#arrow)"
                />
              );
            })}
            {connectMode && connectFrom && hoverPoint && nodeMap.get(connectFrom) && (() => {
              const from = nodeMap.get(connectFrom)!;
              return (
                <line
                  x1={from.x + 90}
                  y1={from.y + 42}
                  x2={hoverPoint.x}
                  y2={hoverPoint.y}
                  className="text-teal-400 dark:text-teal-300"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              );
            })()}
          </svg>
          {!readOnly && customEdges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const cx = (from.x + 180 + to.x) / 2;
            const cy = (from.y + 42 + to.y + 42) / 2;
            return (
              <button
                key={`delete-${edge.id}`}
                type="button"
                title="연결 삭제"
                aria-label="연결 삭제"
                className="group absolute flex h-3 w-3 items-center justify-center rounded-full bg-rose-300/70 text-[0px] text-white transition-all hover:h-6 hover:w-6 hover:bg-rose-500 hover:text-xs hover:font-bold hover:shadow dark:bg-rose-700/70"
                style={{ transform: `translate(${cx - 6}px, ${cy - 6}px)` }}
                onClick={(event) => { event.stopPropagation(); onRemoveCustomEdge(edge.id); }}
              >
                <span className="leading-none">×</span>
              </button>
            );
          })}
          {nodes.map((node) => (
            <div
              key={node.id}
              className="group absolute"
              style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            >
              <button
                type="button"
                className={`flex h-[84px] w-[180px] touch-none items-center gap-3 rounded-lg border px-3 text-left shadow-sm transition hover:shadow-md ${flowTone(node.tone)} ${connectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${connectFrom === node.id ? "ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-zinc-900" : ""}`}
                onPointerDown={(event) => startDrag(event, node)}
                onPointerMove={moveDrag}
                onPointerUp={(event) => stopDrag(event, node)}
                onPointerCancel={(event) => stopDrag(event, node)}
              >
                <BrandIcon brand={node.brand} hint={node.brandKind} size={40} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{node.title}</span>
                  <span className="mt-0.5 truncate text-xs opacity-70">{node.subtitle}</span>
                </span>
              </button>
              {onNodeDelete && !connectMode && (node.id.startsWith("account:") || node.id.startsWith("card:")) && (
                <button
                  type="button"
                  title="노드 삭제"
                  aria-label="노드 삭제"
                  className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white opacity-0 shadow transition hover:bg-rose-600 group-hover:opacity-100 focus:opacity-100"
                  onClick={(event) => { event.stopPropagation(); if (window.confirm("이 노드를 삭제할까요? 해당 계좌/카드와 연결된 자동·사용자 정의 연결선도 함께 정리됩니다.")) onNodeDelete(node.id); }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
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

function EditableTable<T extends { id: string }>({
  columns,
  columnWidths,
  items,
  displayCells,
  editCells,
  onSave,
  onDelete,
  emptyMessage,
}: {
  columns: string[];
  columnWidths?: (string | undefined)[];
  items: T[];
  displayCells: (item: T) => ReactNode[];
  editCells: (draft: T, setDraft: (next: T) => void) => ReactNode[];
  onSave: (original: T, draft: T) => void;
  onDelete?: (item: T) => void;
  emptyMessage?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<T | null>(null);

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };
  const saveEdit = () => {
    if (editingId && draft) {
      const original = items.find((item) => item.id === editingId);
      if (original) onSave(original, draft);
    }
    cancelEdit();
  };

  useEffect(() => {
    if (!editingId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelEdit();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        saveEdit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, draft, items]);

  if (items.length === 0 && emptyMessage) {
    return <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>;
  }

  const allColumns = [...columns, ""];
  const rows: ReactNode[][] = items.map((item) => {
    const isEditing = editingId === item.id && draft !== null;
    if (isEditing) {
      return [
        ...editCells(draft!, setDraft as (next: T) => void),
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            title="취소"
            aria-label="취소"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={cancelEdit}
          >
            <X size={14} />
          </button>
          <button
            type="button"
            title="저장"
            aria-label="저장"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-teal-700 text-white transition hover:bg-teal-800 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400"
            onClick={saveEdit}
          >
            <Check size={14} />
          </button>
        </div>,
      ];
    }
    return [
      ...displayCells(item),
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          title="편집"
          aria-label="편집"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={() => { setEditingId(item.id); setDraft({ ...item }); }}
        >
          <Pencil size={14} />
        </button>
        {onDelete && (
          <button
            type="button"
            title="삭제"
            aria-label="삭제"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950"
            onClick={() => onDelete(item)}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>,
    ];
  });

  const allWidths = columnWidths ? [...columnWidths, "5rem"] : undefined;
  return (
    <ViewModeContext.Provider value={false}>
      <Table columns={allColumns} rows={rows} columnWidths={allWidths} />
    </ViewModeContext.Provider>
  );
}

function EditableBox<T>({
  value,
  onSave,
  display,
  edit,
}: {
  value: T;
  onSave: (next: T) => void;
  display: (value: T) => ReactNode;
  edit: (draft: T, setDraft: (next: T) => void) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDraft(value);
        setEditing(false);
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        onSave(draft);
        setEditing(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, draft, value, onSave]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className="group relative block w-full rounded-lg text-left transition hover:ring-2 hover:ring-teal-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-label="편집"
      >
        {display(value)}
        <span className="pointer-events-none absolute right-2 top-2 inline-flex h-5 items-center rounded-full bg-teal-100 px-2 text-[10px] font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100 dark:bg-teal-900/60 dark:text-teal-200">
          편집
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-lg ring-2 ring-teal-500/40">
      {edit(draft, setDraft)}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() => { setDraft(value); setEditing(false); }}
        >
          취소
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-full bg-teal-700 px-4 text-xs font-semibold text-white transition hover:bg-teal-800 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400"
          onClick={() => { onSave(draft); setEditing(false); }}
        >
          저장
        </button>
      </div>
    </div>
  );
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

type IncomeDraft = { salary: number; sideIncomes: SideIncome[] };

function IncomeBox({
  salary,
  sideIncomes,
  onSave,
}: {
  salary: number;
  sideIncomes: SideIncome[];
  onSave: (next: IncomeDraft) => void;
}) {
  const totalSideIncome = sideIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = salary + totalSideIncome;
  return (
    <EditableBox<IncomeDraft>
      value={{ salary, sideIncomes }}
      onSave={onSave}
      display={() => (
        <Metric
          title="총 월 수입"
          value={won(totalIncome)}
          detail={`월급 ${won(salary)} + 부수입 ${won(totalSideIncome)}`}
          icon={<ArrowUpRight size={16} />}
          accent="teal"
        />
      )}
      edit={(draft, setDraft) => {
        const draftTotal = draft.salary + draft.sideIncomes.reduce((sum, item) => sum + item.amount, 0);
        return (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 월 수입</p>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${metricAccentClasses("teal")}`}><ArrowUpRight size={16} /></span>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-[26px]">{won(draftTotal)}</p>
            <div className="mt-3 flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 text-zinc-500 dark:text-zinc-400">월급</span>
                <FormattedNumberInput
                  className="field h-9 flex-1 min-w-0"
                  value={draft.salary}
                  onChange={(next) => setDraft({ ...draft, salary: next })}
                  autoFocus
                />
              </label>
              {draft.sideIncomes.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  <input
                    className="field h-9 flex-1 min-w-0 truncate text-zinc-700 dark:text-zinc-200"
                    placeholder="부수입 유형"
                    value={item.name}
                    onChange={(event) => setDraft({ ...draft, sideIncomes: draft.sideIncomes.map((row) => (row.id === item.id ? { ...row, name: event.target.value } : row)) })}
                  />
                  <FormattedNumberInput
                    className="field h-9 w-28 shrink-0 text-right"
                    value={item.amount}
                    onChange={(next) => setDraft({ ...draft, sideIncomes: draft.sideIncomes.map((row) => (row.id === item.id ? { ...row, amount: next } : row)) })}
                  />
                  <button
                    type="button"
                    title="삭제"
                    aria-label="부수입 삭제"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    onClick={() => setDraft({ ...draft, sideIncomes: draft.sideIncomes.filter((row) => row.id !== item.id) })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="self-start text-xs font-medium text-teal-700 transition hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
                onClick={() => setDraft({ ...draft, sideIncomes: [...draft.sideIncomes, { id: newId(), name: "", amount: 0 }] })}
              >
                + 부수입 추가
              </button>
            </div>
          </div>
        );
      }}
    />
  );
}

function InvestmentBaseControl({ value, fallback, onChange }: { value: number | null; fallback: number; onChange: (value: number | null) => void }) {
  const isAuto = value === null;
  const effective = isAuto ? fallback : value;
  const modeButtonBase = "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition";
  return (
    <div className="rounded-xl bg-zinc-50 px-4 py-2.5 ring-1 ring-zinc-200/60 dark:bg-zinc-950 dark:ring-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">투자 기준액</p>
        <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            aria-pressed={isAuto}
            className={`${modeButtonBase} ${isAuto ? "bg-teal-600 text-white" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"}`}
            onClick={() => onChange(null)}
          >
            자동
          </button>
          <button
            type="button"
            aria-pressed={!isAuto}
            className={`${modeButtonBase} ${!isAuto ? "bg-teal-600 text-white" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"}`}
            onClick={() => onChange(value ?? fallback)}
          >
            수동
          </button>
        </div>
      </div>
      {isAuto ? (
        <p className="mt-1 text-base font-bold tabular-nums">{won(effective)} <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">(가처분소득)</span></p>
      ) : (
        <FormattedNumberInput
          className="field mt-1 h-9"
          value={value ?? 0}
          onChange={onChange}
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
        <FormattedNumberInput className="field h-11" value={value} onChange={onChange} />
      )}
    </label>
  );
}

function BrandField({ value, kind, onChange }: { value: string; kind: BrandKind; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <BrandLabel brand={value} hint={kind} size={24} />;
  return <BrandSelect value={value} kind={kind} onChange={onChange} className="w-full" />;
}

function Text({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-36">{value || "-"}</span>;
  return <input className="field h-10 w-full" value={value} onChange={(event) => onChange(event.target.value)} />;
}

// 천단위 콤마 유지하면서도 사용자가 커서를 둔 위치 그대로 편집 가능한 숫자 입력.
// controlled input 이라 setState 후 re-render 시 caret 이 끝으로 튀던 문제를 onChange 직전
// 콤마 제외 digit index 를 기준으로 caret 위치 재계산해 setSelectionRange 로 복원.
function FormattedNumberInput({
  value,
  onChange,
  className,
  autoFocus,
}: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretAfterRender = useRef<number | null>(null);

  // setSelectionRange 는 paint 전에 적용돼야 깜빡임/초기화 인상이 없음 → useLayoutEffect
  useLayoutEffect(() => {
    if (caretAfterRender.current === null || !inputRef.current) return;
    const pos = caretAfterRender.current;
    inputRef.current.setSelectionRange(pos, pos);
    caretAfterRender.current = null;
  });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const raw = input.value;
    const caretBefore = input.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caretBefore).replace(/[^0-9]/g, "").length;
    const next = toNumber(raw);
    const formatted = format.format(next);
    let caretAfter = formatted.length;
    if (digitsBefore === 0) {
      caretAfter = 0;
    } else {
      let count = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9]/.test(formatted[i])) {
          count++;
          if (count === digitsBefore) {
            caretAfter = i + 1;
            break;
          }
        }
      }
    }
    caretAfterRender.current = caretAfter;
    onChange(next);
  }

  return (
    <input
      ref={inputRef}
      className={className}
      inputMode="numeric"
      value={format.format(value)}
      onChange={handleChange}
      autoFocus={autoFocus}
    />
  );
}

function NumberBox({ value, onChange, suffix }: { value: number; onChange: (value: number) => void; suffix?: string }) {
  const readOnly = useReadOnly();
  if (readOnly) {
    return <span className="block text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-100 sm:min-w-28">{format.format(value)}{suffix ? ` ${suffix}` : ""}</span>;
  }
  return (
    <div className="flex w-full items-center gap-1">
      <FormattedNumberInput value={value} onChange={onChange} className="field h-10 min-w-0 flex-1" />
      {suffix && <span className="text-sm text-zinc-500">{suffix}</span>}
    </div>
  );
}

function PaymentMethodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-24">{value || "-"}</span>;
  const hasCustom = value && !paymentMethodOptions.includes(value);
  return (
    <select className="field h-10 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      {!value && <option value="">선택</option>}
      {hasCustom && <option value={value}>{value}</option>}
      {paymentMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function SettlementAccountSelect({
  value,
  legacyText,
  accounts,
  onChange,
}: {
  value: string;
  legacyText: string;
  accounts: Account[];
  onChange: (value: string) => void;
}) {
  const readOnly = useReadOnly();
  const matched = accounts.find((account) => account.id === value);
  const display = matched
    ? `${getBrand(matched.bank, matched.type === "투자계좌" ? "sec" : "bank")?.name ?? matched.bank} ${matched.name}`.trim()
    : legacyText || "";
  if (readOnly) {
    return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-32">{display || "-"}</span>;
  }
  return (
    <select className="field h-10 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{legacyText ? `(${legacyText}) — 선택 안 됨` : "선택 안 함"}</option>
      {accounts.map((account) => {
        const brandName = getBrand(account.bank, account.type === "투자계좌" ? "sec" : "bank")?.name ?? account.bank;
        const label = `${brandName} ${account.name}`.trim() || account.type;
        return (
          <option key={account.id} value={account.id}>{label}</option>
        );
      })}
    </select>
  );
}

function InvestmentAccountTypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-28">{value || "-"}</span>;
  const hasCustom = value && !investmentAccountTypeOptions.includes(value);
  return (
    <select className="field h-10 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      {hasCustom && <option value={value}>{value}</option>}
      {investmentAccountTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function IncludedToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const readOnly = useReadOnly();
  const cls = `inline-flex h-6 items-center justify-center rounded-full px-2 text-[11px] font-medium ${value ? "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`;
  if (readOnly) {
    return <span className={cls}>{value ? "포함" : "제외"}</span>;
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`${cls} transition hover:brightness-95`}
    >
      {value ? "포함" : "제외"}
    </button>
  );
}

function PaymentDayField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  const label = value ? `${value}일` : "";
  if (readOnly) return <span className="block text-sm tabular-nums text-zinc-800 dark:text-zinc-100 sm:min-w-12">{label || "-"}</span>;
  return (
    <select
      className="field h-10 w-full"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">선택</option>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
        <option key={day} value={String(day)}>{day}일</option>
      ))}
    </select>
  );
}

function PaymentBrandField({
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
  const brandKind: BrandKind = kind === "card" ? "card" : "bank";
  const value = kind === "card" ? cardValue : transferValue;
  const onChange = kind === "card" ? onCardChange : onTransferChange;
  if (readOnly) return <BrandLabel brand={value} hint={brandKind} size={24} />;
  return <BrandSelect value={value} kind={brandKind} onChange={onChange} className="w-full" />;
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
  return <input className="field h-10 w-full" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const readOnly = useReadOnly();
  if (readOnly) return <span className="block text-sm text-zinc-800 dark:text-zinc-100 sm:min-w-32">{value}</span>;
  return (
    <select className="field h-10 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
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
      className="field h-10 w-full"
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

function Table({ columns, rows, columnWidths }: { columns: string[]; rows: ReactNode[][]; columnWidths?: (string | undefined)[] }) {
  const readOnly = useReadOnly();
  const fixed = !!columnWidths;
  return (
    <>
      <div className="hidden w-full max-w-full overflow-x-auto sm:block">
        <table className={`w-full border-collapse text-left text-sm sm:min-w-[640px] ${fixed ? "table-fixed" : ""}`}>
          {fixed && (
            <colgroup>
              {columns.map((column, i) => (
                <col key={column || `c${i}`} style={columnWidths?.[i] ? { width: columnWidths[i] } : undefined} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {columns.map((column, i) => <th key={column || `h${i}`} className="px-3 py-2 font-medium sm:px-4">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-zinc-100 transition hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2.5 align-middle sm:px-4">{cell}</td>)}
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
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
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

const secMaxNameLen = brandsByKind("sec").reduce((max, brand) => Math.max(max, brand.name.length), 0);

function PortfolioDonut({ products, baseAmount }: { products: InvestmentProduct[]; baseAmount: number }) {
  const data = products
    .filter((item) => item.ratio > 0)
    .map((item, index) => ({
      name: item.destination || "미지정",
      broker: getBrand(item.broker, "sec")?.name ?? item.broker,
      brokerId: item.broker,
      accountType: item.accountType,
      value: item.ratio,
      amount: baseAmount * (item.ratio / 100),
      color: portfolioPalette[index % portfolioPalette.length],
    }));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const brokerMinWidth = `${(secMaxNameLen * 1.2).toFixed(2)}em`;
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
      <ul className="grid items-center gap-x-2 gap-y-1.5 text-sm grid-cols-[10px_minmax(0,1fr)_44px_96px] sm:grid-cols-[10px_minmax(0,1fr)_18px_auto_auto_44px_96px]">
        {data.map((item) => (
          <li key={item.name} className="contents">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="min-w-0 truncate font-medium">{item.name}</span>
            <span className="hidden sm:block">
              {item.broker && <BrandIcon brand={item.brokerId} hint="sec" size={18} rounded="md" />}
            </span>
            <span
              className="hidden whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400 sm:block"
              style={{ minWidth: brokerMinWidth }}
            >
              {item.broker}
            </span>
            <span className="hidden sm:block">
              {item.accountType && (
                <span className="inline-block whitespace-nowrap rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {item.accountType}
                </span>
              )}
            </span>
            <span className="text-right tabular-nums text-xs text-zinc-500 dark:text-zinc-400">{item.value}%</span>
            <span className="text-right font-semibold tabular-nums">{won(item.amount)}</span>
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

function CategoryDonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name: string; value: number; color: string } }> }) {
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
      <p className="mt-1 tabular-nums">{won(entry.value)}</p>
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

function FullscreenLoading({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-teal-600" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  );
}

function FullscreenError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950 p-6 text-sm text-rose-700 dark:text-rose-300">
        {message}
      </div>
    </div>
  );
}

function VaultedApp({ userId }: { userId: string }) {
  const [dek, setDek] = useState<Uint8Array | null>(() => readCachedDek(userId));
  const [vaultExists, setVaultExists] = useState<boolean | null>(null);
  const [vaultCheckError, setVaultCheckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vaults")
        .select("user_id")
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setVaultCheckError(error.message);
        return;
      }
      setVaultExists(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (vaultCheckError) {
    return <FullscreenError message={`가계부 잠금 상태를 불러오지 못했어요. ${vaultCheckError}`} />;
  }
  // DEK 가 메모리에 있으면 vault 확인 결과와 무관하게 즉시 진입.
  // VaultSetup 직후 onComplete(dek) 가 set 되면 vaultExists 가 아직 false 여도 UnlockedApp 으로 라우팅.
  if (dek) {
    return <UnlockedApp userId={userId} dek={dek} />;
  }
  if (vaultExists === null) {
    return <FullscreenLoading message="잠깐만요" />;
  }
  if (!vaultExists) {
    return <VaultSetup userId={userId} onComplete={setDek} />;
  }
  return <VaultUnlock userId={userId} onUnlock={setDek} />;
}

function UnlockedApp({ userId, dek }: { userId: string; dek: Uint8Array }) {
  const { data, setData, hydrating, hasRemoteEntry, error } = useEncryptedEntries<DashboardData>(userId, dek);
  const [migrationDone, setMigrationDone] = useState(false);
  const [migratedData, setMigratedData] = useState<DashboardData | null>(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (hydrating || hasRemoteEntry || migrationDone) return;
    setMigrating(true);
    (async () => {
      const result = await migrateLegacyEntriesIfAny<unknown>(userId, dek);
      if (result.migrated && result.data) {
        setMigratedData(normalizeDashboardData(result.data));
      }
      setMigrating(false);
      setMigrationDone(true);
    })();
  }, [hydrating, hasRemoteEntry, migrationDone, userId, dek]);

  async function signOut() {
    clearCachedDek(userId);
    await supabase.auth.signOut();
  }

  if (hydrating || migrating || (!hasRemoteEntry && !migrationDone)) {
    return <FullscreenLoading message="가계부를 불러오는 중이에요" />;
  }
  if (error) {
    return <FullscreenError message={`가계부 동기화에 문제가 있어요. ${error}`} />;
  }

  const initial = data
    ? normalizeDashboardData(data)
    : migratedData ?? { ...defaultData, darkMode: prefersDark() };

  return <Dashboard initialData={initial} onChange={setData} onSignOut={signOut} />;
}

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // iOS Safari 가 OAuth redirect 직후 첫 로드에서 viewport meta 를 무시하고
  // desktop default 폭으로 layout viewport 를 잡는 버그가 있어, content 가
  // 화면을 벗어나 보이는 증상이 있음. 다른 브라우저(카카오톡 인앱 등) 도
  // 유사 케이스가 있어 OAuth 첫 진입은 일괄로 1회 hard reload 해 viewport
  // 와 scroll 위치를 모두 깨끗하게 재계산.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isOAuthCallback =
      window.location.hash.includes("access_token") ||
      window.location.search.includes("code=");
    if (!isOAuthCallback) return;
    const KEY = "personal-finance-dashboard:oauth-reload-done";
    if (sessionStorage.getItem(KEY)) return;
    // reload 이후 페이지에서 브라우저가 이전 scroll 위치를 복원하지 않도록
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      sessionStorage.setItem(KEY, "1");
      sub.subscription.unsubscribe();
      setTimeout(() => {
        window.scrollTo(0, 0);
        window.location.reload();
      }, 100);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthGate>
      {userId ? <VaultedApp userId={userId} /> : <FullscreenLoading message="로그인 확인 중이에요" />}
    </AuthGate>
  );
}
