import { useState } from "react";

/** Encar damage codes (X/W/C/A/U/T) — colors match Encar inspect report */
export const ENCAR_DAMAGE: Record<
  string,
  { code: string; color: string; labelRu: string; labelKo: string }
> = {
  Замена: { code: "X", color: "#E11D48", labelRu: "Замена", labelKo: "교환" },
  Ремонт: { code: "W", color: "#3B82F6", labelRu: "Правка / сварка", labelKo: "판금/용접" },
  Коррозия: { code: "C", color: "#F97316", labelRu: "Коррозия", labelKo: "부식" },
  Царапины: { code: "A", color: "#64748B", labelRu: "Царапины", labelKo: "흠집" },
  Вмятина: { code: "U", color: "#65A30D", labelRu: "Вмятина", labelKo: "요철" },
  Повреждение: { code: "T", color: "#A16207", labelRu: "Повреждение", labelKo: "손상" },
};

const CODE_FROM_STATUS: Record<string, string> = {
  Замена: "X",
  Ремонт: "W",
  Коррозия: "C",
  Царапины: "A",
  Вмятина: "U",
  Повреждение: "T",
  X: "X",
  W: "W",
  C: "C",
  A: "A",
  U: "U",
  T: "T",
};

export const META_BY_CODE: Record<string, { color: string; labelRu: string }> = {
  X: { color: "#E11D48", labelRu: "Замена" },
  W: { color: "#3B82F6", labelRu: "Правка / сварка" },
  C: { color: "#F97316", labelRu: "Коррозия" },
  A: { color: "#64748B", labelRu: "Царапины" },
  U: { color: "#65A30D", labelRu: "Вмятина" },
  T: { color: "#A16207", labelRu: "Повреждение" },
};

type Damage = { part: string; status: string; code?: string };

function resolveCode(d: Damage): string | null {
  if (d.code && META_BY_CODE[d.code.toUpperCase()]) return d.code.toUpperCase();
  const fromStatus = CODE_FROM_STATUS[d.status];
  return fromStatus || null;
}

/**
 * Marker positions on Encar-like 3-view diagram (viewBox 400×460).
 * Layout matches Encar: left profile | top view | right profile, fronts up.
 */
const MARKER_POS: Record<string, { x: number; y: number }> = {
  "Передний бампер": { x: 200, y: 52 },
  Капот: { x: 200, y: 110 },
  "Левое крыло": { x: 78, y: 118 },
  "Правое крыло": { x: 322, y: 118 },
  "Левая передняя дверь": { x: 62, y: 200 },
  "Правая передняя дверь": { x: 338, y: 200 },
  Крыша: { x: 200, y: 210 },
  "Левая задняя дверь": { x: 62, y: 275 },
  "Правая задняя дверь": { x: 338, y: 275 },
  "Левое заднее крыло": { x: 78, y: 340 },
  "Правое заднее крыло": { x: 322, y: 340 },
  "Крышка багажника": { x: 200, y: 355 },
  "Задний бампер": { x: 200, y: 410 },
};

function DamageBadge({
  code,
  x,
  y,
  active,
  onSelect,
}: {
  code: string;
  x: number;
  y: number;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = META_BY_CODE[code] || META_BY_CODE.W;
  const r = active ? 14 : 12;
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      {/* Larger invisible hit area for touch */}
      <circle cx={x} cy={y} r={22} fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={meta.color}
        stroke="#fff"
        strokeWidth={2}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize="11"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {code}
      </text>
    </g>
  );
}

/** Encar-style body diagram: top + left + right silhouettes with X/W/C badges */
export function EncarBodyScheme({ bodyDamage }: { bodyDamage: Damage[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const damaged = (bodyDamage || [])
    .map((d) => ({ ...d, code: resolveCode(d) }))
    .filter((d) => d.code && d.status !== "Отлично" && d.status !== "Хорошо");

  const selectedItem = damaged.find((d) => d.part === selected) || null;
  const selectedMeta = selectedItem?.code ? META_BY_CODE[selectedItem.code] : null;

  const stroke = "#9CA3AF";
  const fill = "#F9FAFB";
  const glass = "#E5E7EB";
  const wheel = "#6B7280";

  return (
    <div className="mb-0 rounded-xl border border-[#E5E7EB] bg-white p-2 sm:mb-4 sm:rounded-2xl sm:p-3">
      <div className="mb-1 flex min-h-8 items-center justify-center px-1">
        {selectedItem && selectedMeta ? (
          <div
            className="flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold sm:gap-2 sm:px-3 sm:text-xs"
            style={{ background: "#F8FAFC", color: selectedMeta.color, border: `1px solid ${selectedMeta.color}` }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
              style={{ background: selectedMeta.color }}
            >
              {selectedItem.code}
            </span>
            <span className="truncate">
              {selectedItem.part} — {selectedMeta.labelRu}
            </span>
          </div>
        ) : (
          <p className="text-center text-[11px] text-[#9CA3AF] sm:text-xs">Нажмите на метку повреждения</p>
        )}
      </div>

      <svg
        viewBox="0 0 400 460"
        className="mx-auto block h-auto w-full max-w-[320px] touch-manipulation sm:max-w-[380px]"
        fill="none"
      >
        {/* ===== LEFT SIDE PROFILE (front up) ===== */}
        <g>
          {/* body */}
          <path
            d="M55 55
               C48 70 45 95 46 120
               L48 200
               C50 250 52 300 58 345
               L72 360 L78 340
               L76 250 L74 160 L70 90 L62 60 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.4"
          />
          {/* windshield */}
          <path d="M58 95 L72 105 L70 145 L56 135 Z" fill={glass} stroke={stroke} strokeWidth="0.8" />
          {/* side glass */}
          <path d="M56 150 L70 160 L68 240 L54 230 Z" fill={glass} stroke={stroke} strokeWidth="0.8" />
          {/* rear glass */}
          <path d="M55 250 L68 260 L66 300 L54 290 Z" fill={glass} stroke={stroke} strokeWidth="0.8" />
          {/* wheels */}
          <ellipse cx="48" cy="130" rx="11" ry="20" fill={wheel} />
          <ellipse cx="52" cy="300" rx="11" ry="20" fill={wheel} />
          <ellipse cx="48" cy="130" rx="5" ry="9" fill="#D1D5DB" />
          <ellipse cx="52" cy="300" rx="5" ry="9" fill="#D1D5DB" />
        </g>

        {/* ===== RIGHT SIDE PROFILE (front up) ===== */}
        <g>
          <path
            d="M345 55
               C352 70 355 95 354 120
               L352 200
               C350 250 348 300 342 345
               L328 360 L322 340
               L324 250 L326 160 L330 90 L338 60 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.4"
          />
          <path d="M342 95 L328 105 L330 145 L344 135 Z" fill={glass} stroke={stroke} strokeWidth="0.8" />
          <path d="M344 150 L330 160 L332 240 L346 230 Z" fill={glass} stroke={stroke} strokeWidth="0.8" />
          <path d="M345 250 L332 260 L334 300 L346 290 Z" fill={glass} stroke={stroke} strokeWidth="0.8" />
          <ellipse cx="352" cy="130" rx="11" ry="20" fill={wheel} />
          <ellipse cx="348" cy="300" rx="11" ry="20" fill={wheel} />
          <ellipse cx="352" cy="130" rx="5" ry="9" fill="#D1D5DB" />
          <ellipse cx="348" cy="300" rx="5" ry="9" fill="#D1D5DB" />
        </g>

        {/* ===== TOP VIEW (center) ===== */}
        <g>
          {/* front bumper */}
          <path d="M155 40 H245 C252 40 258 48 258 55 H142 C142 48 148 40 155 40 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* hood */}
          <path d="M145 55 H255 L262 145 H138 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* hood center line */}
          <line x1="200" y1="62" x2="200" y2="140" stroke="#D1D5DB" strokeWidth="1" />
          {/* windshield */}
          <path d="M140 145 H260 L252 175 H148 Z" fill={glass} stroke={stroke} strokeWidth="1.2" />
          {/* roof / cabin */}
          <path d="M148 175 H252 L250 300 H150 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* sunroof hint */}
          <rect x="175" y="200" width="50" height="55" rx="4" fill="none" stroke="#D1D5DB" strokeWidth="1" />
          {/* rear glass */}
          <path d="M150 300 H250 L258 330 H142 Z" fill={glass} stroke={stroke} strokeWidth="1.2" />
          {/* trunk */}
          <path d="M142 330 H258 L250 390 H150 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* rear bumper */}
          <path d="M155 390 H245 C252 390 258 400 255 408 H145 C142 400 148 390 155 390 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* left side strip (fenders/doors) */}
          <path d="M138 70 L145 55 L150 390 L132 380 L128 220 L132 100 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
          {/* right side strip */}
          <path d="M262 70 L255 55 L250 390 L268 380 L272 220 L268 100 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
          {/* door cut lines left */}
          <line x1="138" y1="175" x2="150" y2="175" stroke={stroke} strokeWidth="0.8" />
          <line x1="138" y1="250" x2="150" y2="250" stroke={stroke} strokeWidth="0.8" />
          {/* door cut lines right */}
          <line x1="250" y1="175" x2="262" y2="175" stroke={stroke} strokeWidth="0.8" />
          <line x1="250" y1="250" x2="262" y2="250" stroke={stroke} strokeWidth="0.8" />
          {/* wheels top-view */}
          <rect x="118" y="105" width="16" height="42" rx="5" fill={wheel} />
          <rect x="266" y="105" width="16" height="42" rx="5" fill={wheel} />
          <rect x="118" y="290" width="16" height="42" rx="5" fill={wheel} />
          <rect x="266" y="290" width="16" height="42" rx="5" fill={wheel} />
        </g>

        <text x="200" y="28" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontFamily="system-ui, sans-serif">
          ПЕРЕД
        </text>

        {damaged.map((d) => {
          const pos = MARKER_POS[d.part];
          if (!pos || !d.code) return null;
          return (
            <DamageBadge
              key={d.part}
              code={d.code}
              x={pos.x}
              y={pos.y}
              active={selected === d.part}
              onSelect={() => setSelected((p) => (p === d.part ? null : d.part))}
            />
          );
        })}
      </svg>

      {/* Encar legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-[#F0F0F0] pt-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-3 sm:gap-y-2 sm:pt-3">
        {Object.values(ENCAR_DAMAGE).map((item) => (
          <div key={item.code} className="flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
              style={{ background: item.color }}
            >
              {item.code}
            </span>
            <span className="text-[10px] font-medium leading-tight text-[#4B5563] sm:text-[11px]">{item.labelRu}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 hidden text-center text-[10px] text-[#A1A1AA] sm:mt-2 sm:block">
        * Схема как в отчёте Encar (обмен / правка / коррозия / царапины / вмятина / повреждение)
      </p>
    </div>
  );
}

function formatWon(n: number) {
  return `₩${new Intl.NumberFormat("ko-KR").format(n)}`;
}

/** Encar-like insurance history (보험이력): plate + summary grid + accident cards */
export function EncarInsurancePanel({
  records,
  summary,
  pdfUrl,
}: {
  records: Array<{ date?: string; type?: string; amount?: number; description?: string }>;
  summary?: {
    myAccidentCnt?: number;
    otherAccidentCnt?: number;
    ownerChangeCnt?: number;
    myAccidentCost?: number;
    otherAccidentCost?: number;
    robberCnt?: number;
    totalLossCnt?: number;
    floodTotalLossCnt?: number;
    vehicleNo?: string;
  } | null;
  pdfUrl?: string | null;
}) {
  const list = records || [];
  const my = list.filter((r) => r.type?.includes("своё"));
  const other = list.filter((r) => r.type?.includes("другая"));
  const myCnt = summary?.myAccidentCnt ?? my.length;
  const otherCnt = summary?.otherAccidentCnt ?? other.length;
  const myCost =
    summary?.myAccidentCost ?? my.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const otherCost =
    summary?.otherAccidentCost ?? other.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const owners = summary?.ownerChangeCnt;
  const totalBenefit = list.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  if (!list.length && !summary && !pdfUrl) {
    return <p className="text-sm text-[#888] text-center py-8">Нет данных страховой истории</p>;
  }

  return (
    <div className="space-y-5">
      {summary?.vehicleNo && (
        <div className="text-center">
          <p className="text-lg font-extrabold text-[#111] tracking-wide">{summary.vehicleNo}</p>
          <p className="text-[11px] text-[#888] mt-0.5">Страховая история (как на Encar)</p>
        </div>
      )}

      {/* Main Encar-style accident totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-4 text-center">
          <p className="text-[11px] text-[#3B82F6] font-semibold mb-1">ДТП (своё авто)</p>
          <p className="text-2xl font-extrabold text-[#111]">{myCnt}</p>
          {myCost > 0 && <p className="text-sm font-bold text-[#C90C07] mt-1">{formatWon(myCost)}</p>}
        </div>
        <div className="rounded-2xl border border-[#F3F4F6] bg-[#F9FAFB] px-4 py-4 text-center">
          <p className="text-[11px] text-[#6B7280] font-semibold mb-1">ДТП (другая сторона)</p>
          <p className="text-2xl font-extrabold text-[#111]">{otherCnt}</p>
          {otherCost > 0 && <p className="text-sm font-bold text-[#C90C07] mt-1">{formatWon(otherCost)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Смена владельца", value: owners != null ? String(owners) : "—" },
          { label: "Угон", value: String(summary?.robberCnt ?? 0) },
          { label: "Полная гибель", value: String(summary?.totalLossCnt ?? 0) },
          { label: "Потоп", value: String(summary?.floodTotalLossCnt ?? 0) },
        ].map((s) => (
          <div key={s.label} className="bg-[#F7F7F7] rounded-xl px-2.5 py-3 text-center border border-[#F0F0F0]">
            <p className="text-lg font-extrabold text-[#111]">{s.value}</p>
            <p className="text-[10px] text-[#888] mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {list.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-[#111] text-sm">Детализация страховых случаев</h4>
            {totalBenefit > 0 && (
              <span className="text-xs font-bold text-[#C90C07]">Итого: {formatWon(totalBenefit)}</span>
            )}
          </div>
          <div className="space-y-2.5">
            {list.map((rec, i) => {
              const isMine = rec.type?.includes("своё");
              return (
                <div key={i} className="rounded-2xl border border-[#F0F0F0] overflow-hidden">
                  <div className={`px-4 py-2.5 flex items-center justify-between ${isMine ? "bg-[#EFF6FF]" : "bg-[#F7F7F7]"}`}>
                    <span className="text-sm font-bold text-[#111]">{rec.type || "Страховой случай"}</span>
                    <span className="text-xs text-[#666] font-semibold">{rec.date || "—"}</span>
                  </div>
                  <div className="px-4 py-3 bg-white space-y-1.5">
                    {Number(rec.amount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#888]">Страховая выплата</span>
                        <span className="font-extrabold text-[#C90C07]">{formatWon(Number(rec.amount))}</span>
                      </div>
                    )}
                    {rec.description &&
                      rec.description.split(" · ").map((line, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-[#666]">
                          <span>{line.split(":")[0]}</span>
                          <span className="font-semibold text-[#333]">{line.split(":").slice(1).join(":").trim()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#16A34A] text-[#16A34A] font-bold text-sm hover:bg-[#F0FDF4]"
        >
          Открыть PDF-отчёт
        </a>
      )}
    </div>
  );
}
