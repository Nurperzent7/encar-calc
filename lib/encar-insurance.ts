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

export function extractEncarVehicleId(url: string): string | null {
  const m =
    url.match(/encar\.com\/cars\/detail\/(\d+)/i) ||
    url.match(/encar\.com\/cars\/report\/inspect\/(\d+)/i) ||
    url.match(/[?&]carid=(\d+)/i) ||
    url.match(/\/(\d{6,})(?:\?|$)/)
  return m?.[1] || null
}

/** Insurance history from Encar (보험이력). */
export async function fetchEncarInsuranceHistory(vehicleId: string): Promise<{
  insuranceRecords: InsuranceRecordItem[]
  insuranceSummary: InsuranceSummary
}> {
  const empty = {
    insuranceRecords: [] as InsuranceRecordItem[],
    insuranceSummary: {} as InsuranceSummary,
  }

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
