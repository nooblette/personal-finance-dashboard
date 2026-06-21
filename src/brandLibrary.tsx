export type BrandKind = "bank" | "card" | "sec";
export type BrandVariant = "original" | "fill";

export type Brand = {
  id: string;
  name: string;
  kind: BrandKind;
  initials: string;
  bg: string;
  fg: string;
  hasOriginal?: boolean;
  hasFill?: boolean;
  logoAlias?: string;
};

const brands: Brand[] = [
  { id: "kb", name: "KB국민은행", kind: "bank", initials: "KB", bg: "bg-yellow-400", fg: "text-zinc-900", hasOriginal: true, hasFill: true },
  { id: "shinhan", name: "신한은행", kind: "bank", initials: "신한", bg: "bg-blue-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "woori", name: "우리은행", kind: "bank", initials: "우리", bg: "bg-sky-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "hana", name: "하나은행", kind: "bank", initials: "하나", bg: "bg-teal-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "nh", name: "NH농협은행", kind: "bank", initials: "NH", bg: "bg-green-600", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "ibk", name: "IBK기업은행", kind: "bank", initials: "IBK", bg: "bg-blue-600", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "sc", name: "SC제일은행", kind: "bank", initials: "SC", bg: "bg-emerald-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "citi", name: "한국씨티은행", kind: "bank", initials: "Citi", bg: "bg-blue-800", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "kakaobank", name: "카카오뱅크", kind: "bank", initials: "kakao", bg: "bg-yellow-300", fg: "text-zinc-900", hasOriginal: true },
  { id: "tossbank", name: "토스뱅크", kind: "bank", initials: "toss", bg: "bg-blue-500", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "kbank", name: "케이뱅크", kind: "bank", initials: "K", bg: "bg-rose-500", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "suhyup", name: "Sh수협은행", kind: "bank", initials: "Sh", bg: "bg-sky-500", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "kdb", name: "KDB산업은행", kind: "bank", initials: "KDB", bg: "bg-blue-900", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "dgb", name: "iM뱅크(대구은행)", kind: "bank", initials: "iM", bg: "bg-indigo-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "bnk-busan", name: "부산은행", kind: "bank", initials: "BNK", bg: "bg-cyan-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "bnk-gyeongnam", name: "경남은행", kind: "bank", initials: "경남", bg: "bg-cyan-800", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "gwangju", name: "광주은행", kind: "bank", initials: "광주", bg: "bg-amber-600", fg: "text-white" },
  { id: "jeonbuk", name: "전북은행", kind: "bank", initials: "전북", bg: "bg-emerald-800", fg: "text-white" },
  { id: "jeju", name: "제주은행", kind: "bank", initials: "제주", bg: "bg-orange-600", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "mg", name: "MG새마을금고", kind: "bank", initials: "MG", bg: "bg-rose-700", fg: "text-white" },
  { id: "sinhyup", name: "신협", kind: "bank", initials: "신협", bg: "bg-emerald-600", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "post", name: "우체국예금", kind: "bank", initials: "우체국", bg: "bg-red-600", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "sbi", name: "SBI저축은행", kind: "bank", initials: "SBI", bg: "bg-indigo-600", fg: "text-white", hasOriginal: true, hasFill: true },

  { id: "shinhan-card", name: "신한카드", kind: "card", initials: "신한", bg: "bg-blue-700", fg: "text-white" },
  { id: "samsung-card", name: "삼성카드", kind: "card", initials: "삼성", bg: "bg-blue-800", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "hyundai-card", name: "현대카드", kind: "card", initials: "현대", bg: "bg-zinc-900", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "kb-card", name: "KB국민카드", kind: "card", initials: "KB", bg: "bg-yellow-400", fg: "text-zinc-900" },
  { id: "lotte-card", name: "롯데카드", kind: "card", initials: "롯데", bg: "bg-red-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "hana-card", name: "하나카드", kind: "card", initials: "하나", bg: "bg-teal-700", fg: "text-white" },
  { id: "woori-card", name: "우리카드", kind: "card", initials: "우리", bg: "bg-sky-700", fg: "text-white" },
  { id: "bc-card", name: "BC카드", kind: "card", initials: "BC", bg: "bg-rose-600", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "nh-card", name: "NH농협카드", kind: "card", initials: "NH", bg: "bg-green-600", fg: "text-white" },
  { id: "ibk-card", name: "IBK기업은행카드", kind: "card", initials: "IBK", bg: "bg-blue-600", fg: "text-white" },
  { id: "suhyup-card", name: "Sh수협카드", kind: "card", initials: "Sh", bg: "bg-sky-500", fg: "text-white" },
  { id: "citi-card", name: "씨티카드", kind: "card", initials: "Citi", bg: "bg-blue-800", fg: "text-white" },
  { id: "kakaopay", name: "카카오페이", kind: "card", initials: "pay", bg: "bg-yellow-300", fg: "text-zinc-900" },
  { id: "tosspay", name: "토스페이", kind: "card", initials: "toss", bg: "bg-blue-500", fg: "text-white" },

  { id: "mirae-asset", name: "미래에셋증권", kind: "sec", initials: "미래", bg: "bg-orange-500", fg: "text-white", hasOriginal: true },
  { id: "kis", name: "한국투자증권", kind: "sec", initials: "한투", bg: "bg-red-600", fg: "text-white", hasOriginal: true },
  { id: "samsung-sec", name: "삼성증권", kind: "sec", initials: "삼성", bg: "bg-blue-800", fg: "text-white", hasOriginal: true },
  { id: "nh-sec", name: "NH투자증권", kind: "sec", initials: "NH", bg: "bg-green-600", fg: "text-white", hasOriginal: true },
  { id: "kb-sec", name: "KB증권", kind: "sec", initials: "KB", bg: "bg-yellow-400", fg: "text-zinc-900", hasOriginal: true },
  { id: "shinhan-sec", name: "신한투자증권", kind: "sec", initials: "신한", bg: "bg-blue-700", fg: "text-white" },
  { id: "hana-sec", name: "하나증권", kind: "sec", initials: "하나", bg: "bg-teal-700", fg: "text-white" },
  { id: "kiwoom", name: "키움증권", kind: "sec", initials: "키움", bg: "bg-red-700", fg: "text-white", hasOriginal: true },
  { id: "meritz-sec", name: "메리츠증권", kind: "sec", initials: "메리츠", bg: "bg-amber-700", fg: "text-white", hasOriginal: true, hasFill: true },
  { id: "daishin", name: "대신증권", kind: "sec", initials: "대신", bg: "bg-blue-900", fg: "text-white", hasOriginal: true },
  { id: "kakaopay-sec", name: "카카오페이증권", kind: "sec", initials: "kakao", bg: "bg-yellow-300", fg: "text-zinc-900", hasOriginal: true, hasFill: false, logoAlias: "kakaobank" },
  { id: "toss-sec", name: "토스증권", kind: "sec", initials: "toss", bg: "bg-blue-500", fg: "text-white", hasOriginal: true, hasFill: true, logoAlias: "tossbank" },
  { id: "eugene", name: "유진투자증권", kind: "sec", initials: "유진", bg: "bg-indigo-700", fg: "text-white", hasOriginal: true },
  { id: "kyobo-sec", name: "교보증권", kind: "sec", initials: "교보", bg: "bg-amber-600", fg: "text-white", hasOriginal: true },
  { id: "hyundai-motor-sec", name: "현대차증권", kind: "sec", initials: "현대", bg: "bg-zinc-900", fg: "text-white", hasOriginal: true },
  { id: "db-sec", name: "DB금융투자", kind: "sec", initials: "DB", bg: "bg-emerald-800", fg: "text-white", hasOriginal: true },
  { id: "yuanta", name: "유안타증권", kind: "sec", initials: "유안타", bg: "bg-rose-700", fg: "text-white" },
  { id: "ibk-sec", name: "IBK투자증권", kind: "sec", initials: "IBK", bg: "bg-blue-600", fg: "text-white" },
  { id: "shinyoung", name: "신영증권", kind: "sec", initials: "신영", bg: "bg-teal-800", fg: "text-white" },
  { id: "sk-sec", name: "SK증권", kind: "sec", initials: "SK", bg: "bg-orange-600", fg: "text-white", hasOriginal: true },
  { id: "hanwha-sec", name: "한화투자증권", kind: "sec", initials: "한화", bg: "bg-amber-700", fg: "text-white", hasOriginal: true },
  { id: "daol-sec", name: "다올투자증권", kind: "sec", initials: "다올", bg: "bg-indigo-800", fg: "text-white" },
  { id: "bnk-sec", name: "BNK투자증권", kind: "sec", initials: "BNK", bg: "bg-cyan-700", fg: "text-white", hasOriginal: true },
  { id: "korea-asset-sec", name: "코리아에셋증권", kind: "sec", initials: "코리아", bg: "bg-emerald-700", fg: "text-white", hasOriginal: true },
  { id: "heungkuk-sec", name: "흥국증권", kind: "sec", initials: "흥국", bg: "bg-rose-800", fg: "text-white", hasOriginal: true },
  { id: "korea-foss-sec", name: "한국포스증권", kind: "sec", initials: "포스", bg: "bg-blue-600", fg: "text-white", hasOriginal: true },
];

export const brandById: Record<string, Brand> = Object.fromEntries(brands.map((brand) => [brand.id, brand]));

const aliasEntries: Array<[string, string]> = [
  ["KB국민", "kb"], ["국민은행", "kb"], ["KB", "kb"], ["KB국민은행", "kb"],
  ["신한", "shinhan"], ["신한은행", "shinhan"],
  ["우리", "woori"], ["우리은행", "woori"],
  ["하나", "hana"], ["하나은행", "hana"], ["KEB하나", "hana"], ["KEB하나은행", "hana"],
  ["NH", "nh"], ["NH농협", "nh"], ["농협", "nh"], ["NH농협은행", "nh"], ["농협은행", "nh"],
  ["IBK", "ibk"], ["IBK기업", "ibk"], ["IBK기업은행", "ibk"], ["기업은행", "ibk"],
  ["SC", "sc"], ["SC제일", "sc"], ["SC제일은행", "sc"], ["제일은행", "sc"],
  ["씨티", "citi"], ["시티", "citi"], ["시티은행", "citi"], ["씨티은행", "citi"], ["한국씨티", "citi"], ["한국씨티은행", "citi"],
  ["카카오뱅크", "kakaobank"], ["kakao bank", "kakaobank"],
  ["토스뱅크", "tossbank"], ["toss bank", "tossbank"], ["토스", "tossbank"],
  ["케이뱅크", "kbank"], ["k bank", "kbank"], ["kbank", "kbank"],
  ["수협", "suhyup"], ["Sh수협", "suhyup"], ["수협은행", "suhyup"], ["Sh수협은행", "suhyup"],
  ["KDB", "kdb"], ["산업은행", "kdb"], ["KDB산업은행", "kdb"],
  ["대구", "dgb"], ["대구은행", "dgb"], ["iM뱅크", "dgb"], ["IM뱅크", "dgb"], ["DGB", "dgb"],
  ["부산", "bnk-busan"], ["부산은행", "bnk-busan"],
  ["경남은행", "bnk-gyeongnam"], ["광주은행", "gwangju"], ["전북은행", "jeonbuk"], ["제주은행", "jeju"],
  ["MG", "mg"], ["MG새마을금고", "mg"], ["새마을금고", "mg"],
  ["신협", "sinhyup"],
  ["우체국", "post"], ["우체국예금", "post"], ["우체국은행", "post"],
  ["SBI", "sbi"], ["SBI저축은행", "sbi"],

  ["신한카드", "shinhan-card"],
  ["삼성카드", "samsung-card"], ["삼성", "samsung-card"],
  ["현대카드", "hyundai-card"], ["현대", "hyundai-card"],
  ["KB카드", "kb-card"], ["국민카드", "kb-card"], ["KB국민카드", "kb-card"],
  ["롯데카드", "lotte-card"],
  ["하나카드", "hana-card"],
  ["우리카드", "woori-card"],
  ["BC", "bc-card"], ["BC카드", "bc-card"], ["비씨카드", "bc-card"],
  ["NH카드", "nh-card"], ["농협카드", "nh-card"], ["NH농협카드", "nh-card"],
  ["IBK카드", "ibk-card"], ["기업카드", "ibk-card"], ["IBK기업은행카드", "ibk-card"],
  ["수협카드", "suhyup-card"], ["Sh수협카드", "suhyup-card"],
  ["씨티카드", "citi-card"], ["시티카드", "citi-card"],
  ["카카오페이", "kakaopay"],
  ["토스페이", "tosspay"],

  ["미래에셋", "mirae-asset"], ["미래에셋증권", "mirae-asset"],
  ["한국투자", "kis"], ["한국투자증권", "kis"], ["한투", "kis"],
  ["삼성증권", "samsung-sec"],
  ["NH투자", "nh-sec"], ["NH투자증권", "nh-sec"],
  ["KB증권", "kb-sec"],
  ["신한투자", "shinhan-sec"], ["신한투자증권", "shinhan-sec"], ["신한금융투자", "shinhan-sec"],
  ["하나증권", "hana-sec"], ["하나금융투자", "hana-sec"],
  ["키움", "kiwoom"], ["키움증권", "kiwoom"],
  ["메리츠", "meritz-sec"], ["메리츠증권", "meritz-sec"],
  ["대신", "daishin"], ["대신증권", "daishin"],
  ["카카오페이증권", "kakaopay-sec"],
  ["토스증권", "toss-sec"],
  ["유진투자", "eugene"], ["유진투자증권", "eugene"],
  ["교보증권", "kyobo-sec"],
  ["현대차증권", "hyundai-motor-sec"],
  ["DB금융투자", "db-sec"], ["DB증권", "db-sec"],
  ["유안타", "yuanta"], ["유안타증권", "yuanta"],
  ["IBK투자", "ibk-sec"], ["IBK투자증권", "ibk-sec"],
  ["신영증권", "shinyoung"],
  ["SK증권", "sk-sec"],
  ["한화투자", "hanwha-sec"], ["한화투자증권", "hanwha-sec"],
  ["다올투자", "daol-sec"], ["다올투자증권", "daol-sec"],
  ["BNK투자증권", "bnk-sec"], ["BNK증권", "bnk-sec"],
  ["코리아에셋", "korea-asset-sec"], ["코리아에셋증권", "korea-asset-sec"],
  ["흥국증권", "heungkuk-sec"], ["흥국", "heungkuk-sec"],
  ["한국포스증권", "korea-foss-sec"], ["포스증권", "korea-foss-sec"],
];

const aliasMap: Record<string, string> = Object.fromEntries(aliasEntries.map(([k, v]) => [k.toLowerCase(), v]));

export function resolveBrandId(input?: string | null, hint?: BrandKind): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (brandById[trimmed]) return trimmed;
  if (hint) {
    const sameKind = brands.find(
      (brand) =>
        brand.kind === hint &&
        (brand.name === trimmed || brand.name.includes(trimmed) || trimmed.includes(brand.name)),
    );
    if (sameKind) return sameKind.id;
  }
  if (aliasMap[lower]) return aliasMap[lower];
  const found = brands.find((brand) => brand.name === trimmed || brand.name.includes(trimmed) || trimmed.includes(brand.name));
  return found ? found.id : null;
}

export function getBrand(input?: string | null, hint?: BrandKind): Brand | null {
  const id = resolveBrandId(input, hint);
  return id ? brandById[id] : null;
}

export function brandsByKind(kind: BrandKind): Brand[] {
  return brands.filter((brand) => brand.kind === kind);
}

function brandAssetUrl(brand: Brand, variant: BrandVariant): string {
  const assetId = brand.logoAlias ?? brand.id;
  return `${import.meta.env.BASE_URL}brands/${assetId}-${variant}.svg`;
}

export function BrandIcon({
  brand,
  size = 32,
  rounded = "full",
  hint,
  variant = "original",
}: {
  brand: string | null | undefined;
  size?: number;
  rounded?: "full" | "md";
  hint?: BrandKind;
  variant?: BrandVariant;
}) {
  const found = getBrand(brand, hint);
  const radiusClass = rounded === "full" ? "rounded-full" : "rounded-md";
  if (!found) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-zinc-300 text-[10px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 ${radiusClass}`}
        style={{ width: size, height: size }}
        aria-label={brand ?? undefined}
      >
        ?
      </span>
    );
  }
  const preferred: BrandVariant = variant === "fill" && found.hasFill ? "fill" : found.hasOriginal ? "original" : found.hasFill ? "fill" : "original";
  const hasAsset = preferred === "original" ? found.hasOriginal : found.hasFill;
  if (hasAsset) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-zinc-200 dark:bg-zinc-50 ${radiusClass}`}
        style={{ width: size, height: size }}
        aria-label={found.name}
      >
        <img src={brandAssetUrl(found, preferred)} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }
  const fallbackText = found.kind === "sec" ? (found.name.match(/[가-힣]/)?.[0] ?? found.name[0] ?? "?") : found.initials;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center px-1 text-[11px] font-bold tracking-tight ${found.bg} ${found.fg} ${radiusClass}`}
      style={{ width: size, height: size }}
      aria-label={found.name}
    >
      {fallbackText}
    </span>
  );
}

export function BrandSelect({
  value,
  kind,
  onChange,
  placeholder = "선택",
  className,
}: {
  value: string;
  kind: BrandKind;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const id = resolveBrandId(value, kind);
  const options = brandsByKind(kind);
  return (
    <span className={`relative inline-flex h-10 min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-white pl-1 pr-2 shadow-sm focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 ${className ?? ""}`}>
      <BrandIcon brand={id} hint={kind} size={28} rounded="full" />
      <select
        className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-4 text-sm text-zinc-900 outline-none dark:text-zinc-50"
        value={id ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </span>
  );
}

export function BrandLabel({ brand, hint, size = 24, variant = "original" }: { brand: string | null | undefined; hint?: BrandKind; size?: number; variant?: BrandVariant }) {
  const found = getBrand(brand, hint);
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <BrandIcon brand={found?.id ?? brand} hint={hint} size={size} variant={variant} />
      <span className="truncate">{found?.name ?? brand ?? "-"}</span>
    </span>
  );
}
