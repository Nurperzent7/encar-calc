export type BodyDamageItem = { part: string; status: string; code?: string }

const STATUS_MAP: Record<string, string> = {
  X: "Замена",
  W: "Ремонт",
  C: "Коррозия",
  A: "Царапины",
  U: "Вмятина",
  T: "Повреждение",
}

/** Encar outer panel codes → Russian parts used by Lux Motors body scheme */
const CODE_TO_PART: Record<string, string> = {
  P011: "Капот",
  P012: "Передний бампер",
  P021: "Левое крыло",
  P022: "Правое крыло",
  P023: "Левая передняя дверь",
  P024: "Правая передняя дверь",
  P031: "Левая задняя дверь",
  P032: "Правая задняя дверь",
  P033: "Левое заднее крыло",
  P034: "Правое заднее крыло",
  P041: "Крышка багажника",
  P042: "Крыша",
  P051: "Передний бампер",
  P061: "Передний бампер",
  P062: "Задний бампер",
}

function partFromTitle(title: string): string | null {
  const t = title || ""
  const left = /좌|左|left/i.test(t)
  const right = /우|右|right/i.test(t)

  if (/후드|bonnet|hood/i.test(t)) return "Капот"
  if (/루프|roof/i.test(t)) return "Крыша"
  if (/트렁크|trunk|테일게이트|테일 게이트/i.test(t)) return "Крышка багажника"
  if (/리어\s*범퍼|rear\s*bumper|후방\s*범퍼/i.test(t)) return "Задний бампер"
  if (/프론트\s*범퍼|front\s*bumper|전방\s*범퍼|라디에이터/i.test(t)) return "Передний бампер"

  if (/쿼터|리어\s*휀더|rear\s*fender|rear\s*quarter/i.test(t)) {
    if (left) return "Левое заднее крыло"
    if (right) return "Правое заднее крыло"
    return null
  }
  if (/프론트\s*휀더|front\s*fender|펜더|휀더/i.test(t)) {
    if (left) return "Левое крыло"
    if (right) return "Правое крыло"
    return null
  }
  if (/리어\s*도어|rear\s*door|뒷문/i.test(t)) {
    if (left) return "Левая задняя дверь"
    if (right) return "Правая задняя дверь"
    return null
  }
  if (/프론트\s*도어|front\s*door|앞문|도어/i.test(t)) {
    if (left) return "Левая передняя дверь"
    if (right) return "Правая передняя дверь"
    return null
  }
  return null
}

function statusFromCodes(statusTypes: Array<{ code?: string; title?: string }> | undefined): { status: string; code: string } | null {
  if (!statusTypes?.length) return null
  const priority = ["X", "W", "T", "C", "U", "A"]
  const codes = statusTypes.map((s) => String(s.code || "").toUpperCase())
  for (const p of priority) {
    if (codes.includes(p) && STATUS_MAP[p]) return { status: STATUS_MAP[p], code: p }
  }
  return null
}

export function extractEncarVehicleId(url: string): string | null {
  const m =
    url.match(/encar\.com\/cars\/detail\/(\d+)/i) ||
    url.match(/encar\.com\/cars\/report\/inspect\/(\d+)/i) ||
    url.match(/[?&]carid=(\d+)/i) ||
    url.match(/\/(\d{6,})(?:\?|$)/)
  return m?.[1] || null
}

export async function fetchEncarBodyDamage(vehicleId: string): Promise<{
  bodyDamage: BodyDamageItem[]
  inspectionMeta: {
    supplyNum?: string
    accident?: boolean
    simpleRepair?: boolean
    mileage?: number
    vin?: string
  }
}> {
  const empty = { bodyDamage: [] as BodyDamageItem[], inspectionMeta: {} }
  try {
    const res = await fetch(
      `https://api.encar.com/v1/readside/inspection/vehicle/${vehicleId}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
          Referer: `https://fem.encar.com/cars/report/inspect/${vehicleId}`,
        },
        cache: "no-store",
      }
    )
    if (!res.ok) return empty
    const data = await res.json()
    const outers: any[] = Array.isArray(data?.outers) ? data.outers : data?.outers ? [data.outers] : []
    const byPart = new Map<string, { status: string; code: string }>()

    for (const outer of outers) {
      const code = String(outer?.type?.code || "")
      const title = String(outer?.type?.title || "")
      const part = CODE_TO_PART[code] || partFromTitle(title)
      const mapped = statusFromCodes(outer?.statusTypes)
      if (!part || !mapped) continue
      const prev = byPart.get(part)
      const rank = (s: string) =>
        ["Замена", "Ремонт", "Коррозия", "Царапины", "Хорошо", "Отлично"].indexOf(s)
      if (!prev || rank(mapped.status) < rank(prev.status)) byPart.set(part, mapped)
    }

    const detail = data?.master?.detail || {}
    return {
      bodyDamage: [...byPart.entries()].map(([part, v]) => ({
        part,
        status: v.status,
        code: v.code,
      })),
      inspectionMeta: {
        supplyNum: data?.master?.supplyNum || detail?.recordNo,
        accident: Boolean(data?.master?.accdient),
        simpleRepair: Boolean(data?.master?.simpleRepair),
        mileage: typeof detail?.mileage === "number" ? detail.mileage : undefined,
        vin: detail?.vin || undefined,
      },
    }
  } catch {
    return empty
  }
}

export type InsuranceRecordItem = {
  date: string
  type: string
  amount: number
  description: string
}

export type InsuranceSummary = {
  myAccidentCnt?: number
  otherAccidentCnt?: number
  ownerChangeCnt?: number
  myAccidentCost?: number
  otherAccidentCost?: number
  robberCnt?: number
  totalLossCnt?: number
  floodTotalLossCnt?: number
  vehicleNo?: string
}

const ACCIDENT_TYPE_RU: Record<string, string> = {
  "1": "Страховой случай",
  "2": "ДТП (своё авто)",
  "3": "ДТП (другая сторона)",
  "4": "Угон",
  "5": "Полная гибель",
  "6": "Потоп / стихия",
}

function formatKrw(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₩"
}

/** Insurance / CarHistory-style record from Encar (보험이력). */
export async function fetchEncarInsuranceHistory(vehicleId: string): Promise<{
  insuranceRecords: InsuranceRecordItem[]
  insuranceSummary: InsuranceSummary
}> {
  const empty = { insuranceRecords: [] as InsuranceRecordItem[], insuranceSummary: {} as InsuranceSummary }
  try {
    const vehRes = await fetch(`https://api.encar.com/v1/readside/vehicle/${vehicleId}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        Referer: `https://fem.encar.com/cars/report/inspect/${vehicleId}`,
      },
      cache: "no-store",
    })
    if (!vehRes.ok) return empty
    const veh = await vehRes.json()
    const vehicleNo = String(veh?.vehicleNo || "").trim()
    if (!vehicleNo) return empty

    // Prefer /open — detailed accidents without auth when already unlocked on Encar
    let data: any = null
    const openRes = await fetch(
      `https://api.encar.com/v1/readside/record/vehicle/${vehicleId}/open?vehicleNo=${encodeURIComponent(vehicleNo)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
          Referer: `https://fem.encar.com/cars/report/inspect/${vehicleId}`,
          Origin: "https://fem.encar.com",
        },
        cache: "no-store",
      }
    )
    if (openRes.ok) {
      data = await openRes.json()
    } else {
      const sumRes = await fetch(
        `https://api.encar.com/v1/readside/record/vehicle/${vehicleId}/summary`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0",
            Referer: `https://fem.encar.com/cars/report/inspect/${vehicleId}`,
          },
          cache: "no-store",
        }
      )
      if (!sumRes.ok) return empty
      data = await sumRes.json()
    }

    const summary: InsuranceSummary = {
      myAccidentCnt: Number(data?.myAccidentCnt) || 0,
      otherAccidentCnt: Number(data?.otherAccidentCnt) || 0,
      ownerChangeCnt: Number(data?.ownerChangeCnt) || 0,
      myAccidentCost: Number(data?.myAccidentCost) || 0,
      otherAccidentCost: Number(data?.otherAccidentCost) || 0,
      robberCnt: Number(data?.robberCnt) || 0,
      totalLossCnt: Number(data?.totalLossCnt) || 0,
      floodTotalLossCnt: Number(data?.floodTotalLossCnt) || 0,
      vehicleNo,
    }

    const accidents: any[] = Array.isArray(data?.accidents) ? data.accidents : []
    const insuranceRecords: InsuranceRecordItem[] = accidents.map((a) => {
      const typeCode = String(a?.type ?? "")
      const type = ACCIDENT_TYPE_RU[typeCode] || "Страховой случай"
      const amount = Number(a?.insuranceBenefit) || 0
      const parts = [
        a?.partCost ? `Запчасти: ${formatKrw(Number(a.partCost))}` : null,
        a?.laborCost ? `Работа: ${formatKrw(Number(a.laborCost))}` : null,
        a?.paintingCost ? `Покраска: ${formatKrw(Number(a.paintingCost))}` : null,
      ].filter(Boolean)
      return {
        date: String(a?.date || "").slice(0, 10),
        type,
        amount,
        description: parts.join(" · "),
      }
    })

    // If open had no accident list but summary has counts, add summary rows
    if (!insuranceRecords.length && (summary.myAccidentCnt || summary.otherAccidentCnt)) {
      if (summary.myAccidentCnt) {
        insuranceRecords.push({
          date: "",
          type: "ДТП (своё авто)",
          amount: summary.myAccidentCost || 0,
          description: `Случаев: ${summary.myAccidentCnt}`,
        })
      }
      if (summary.otherAccidentCnt) {
        insuranceRecords.push({
          date: "",
          type: "ДТП (другая сторона)",
          amount: summary.otherAccidentCost || 0,
          description: `Случаев: ${summary.otherAccidentCnt}`,
        })
      }
    }

    return { insuranceRecords, insuranceSummary: summary }
  } catch {
    return empty
  }
}

