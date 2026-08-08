import translate from "google-translate-api-x"
import * as cheerio from "cheerio"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import fs from "fs"
import path from "path"
import { isHeyDealerUrl, parseHeyDealerUrl } from "@/lib/heydealer"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

/** Таможня ₸ = цена из таблицы ($) после износа × 520 */
const CUSTOMS_USD_TO_KZT = 520

function getCustomsPrice(
  title: string,
  engine: number,
  year: number
): {
  price: number
  excelYear?: number
  carYear?: number
  depreciationYears?: number
  originalUsd?: number
  finalUsd?: number
  foundModel?: string
} {
  const filePath =
    process.env.CUSTOMS_XLSX_PATH ||
    path.join(process.cwd(), "public", "customs.xlsx")

  if (!fs.existsSync(filePath)) {
    console.warn(
      "[customs] File not found:",
      filePath,
      "— set CUSTOMS_XLSX_PATH or add public/customs.xlsx (таможня = 0)."
    )
    return { price: 0 }
  }

  try {
    const buf = fs.readFileSync(filePath)
    const workbook = XLSX.read(buf, { type: "buffer" })

    // Листы легковых: основный + «с 2015г. и ранее»
    const carSheetNames = workbook.SheetNames.filter((name) => {
      const n = name.trim().toLowerCase()
      return n === "авто" || n.includes("2015")
    })
    const sheetsToUse =
      carSheetNames.length > 0
        ? carSheetNames
        : [workbook.SheetNames[0]]

    const data: any[] = []
    for (const sheetName of sheetsToUse) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue
      const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { header: "A" })
      data.push(...rawData.slice(1))
    }

    const parseRowYear = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value
      const text = String(value || "")
      const digits = text.match(/20\d{2}|\d{4}/)
      if (digits) return Number(digits[0])
      // «с 2015 года и ранее»
      if (/2015/i.test(text)) return 2015
      return NaN
    }

    const normalizedTitle = title
      .toUpperCase()
      .replace(/SELL MY CAR/gi, "")
      .replace(/BUY MY CAR/gi, "")
      .replace(/USED CAR/gi, "")
      .replace(/SEOUL/gi, "")
      .replace(/GYEONGGI/gi, "")
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const engineCC = Math.round(engine * 1000)

    // Определяем серию BMW по кузову
    const bmwSeriesMatch = normalizedTitle.match(/(\d+)\s+SERIES/i)
    const bmwChassisMatch = normalizedTitle.match(/\(([GEF]\d{2})\)/i)
    const bmwChassis = bmwChassisMatch ? bmwChassisMatch[1] : null

    const bmwChassisToSeries: Record<string, string> = {
      G30: "5",
      G31: "5",
      G38: "5",
      G20: "3",
      G21: "3",
      G28: "3",
      G11: "7",
      G12: "7",
      G01: "X3",
      G02: "X4",
      G05: "X5",
      G06: "X6",
      G07: "X7",
      F30: "3",
      F31: "3",
      F34: "3",
      F35: "3",
      F10: "5",
      F11: "5",
      F18: "5",
      E90: "3",
      E91: "3",
      E92: "3",
      E93: "3",
    }

    let expectedSeries = bmwSeriesMatch
      ? bmwSeriesMatch[1]
      : bmwChassis && bmwChassisToSeries[bmwChassis]
        ? bmwChassisToSeries[bmwChassis]
        : null

    if (
      bmwChassis &&
      expectedSeries &&
      bmwChassisToSeries[bmwChassis] !== expectedSeries
    ) {
      expectedSeries = bmwChassisToSeries[bmwChassis]
    }

    const commonWords = [
      "M",
      "SPORT",
      "COMPETITION",
      "XDRIVE",
      "SDRIVE",
      "PACKAGE",
      "EDITION",
      "LINE",
      "STYLE",
      "LUXURY",
    ]

    const titleWords =
      normalizedTitle
        .match(/[A-Z0-9]+/g)
        ?.filter((w) => !commonWords.includes(w) && w.length > 1) || []

    let bestRow: any = null
    let bestScore = 0

    // Ищем строку: бренд + название + объём + год
    for (const row of data) {
      const brand = String(row["B"] || "")
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, " ")
        .trim()
      const model = String(row["C"] || "")
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, " ")
        .trim()
      const rowEngine = Number(row["D"])
      const rowYear = parseRowYear(row["E"])

      const brandWords =
        brand.match(/[A-Z0-9]+/g)?.filter((w) => w.length > 1) || []
      const modelWords =
        model
          .match(/[A-Z0-9]+/g)
          ?.filter((w) => !commonWords.includes(w) && w.length > 1) || []

      let score = 0

      // Бренд
      for (const word of brandWords) {
        if (titleWords.some((t) => t === word || t.includes(word) || word.includes(t))) {
          score += 12
        }
      }

      // Название / модель
      for (const word of modelWords) {
        if (titleWords.some((t) => t.includes(word) || word.includes(t))) {
          score += 3
        }
      }

      // Объём
      if (rowEngine === engineCC) {
        score += 20
      } else if (Math.abs(rowEngine - engineCC) <= 100) {
        score += 5
      }

      // Год
      if (Number.isFinite(rowYear)) {
        if (rowYear === year) {
          score += 15
        } else if (rowYear > year) {
          // ближе к году авто — лучше (база для ×0.85)
          score += Math.max(0, 8 - (rowYear - year))
        } else if (rowYear === 2015 && year <= 2015) {
          // лист «с 2015 года и ранее»
          score += 12
        }
      }

      if (expectedSeries) {
        const modelSeriesMatch = model.match(/(\d+)-?SERIES/)
        if (modelSeriesMatch && modelSeriesMatch[1] === expectedSeries) {
          score += 15
        }
        if (
          expectedSeries.startsWith("X") &&
          (model.includes(expectedSeries) || brand.includes("BMW"))
        ) {
          if (model.includes(expectedSeries)) score += 15
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestRow = row
      }
    }

    const foundRow = bestScore >= 3 ? bestRow : null

    console.log({
      normalizedTitle,
      engineCC,
      year,
      bestScore,
      foundBrand: foundRow?.["B"],
      foundModel: foundRow?.["C"],
    })

    if (!foundRow) {
      console.log("NOT FOUND:", title)
      return { price: 0 }
    }

    const excelYear = parseRowYear(foundRow["E"])
    const carYear = year
    const originalUsd = Number(
      String(foundRow["F"] || "0").replace(/\s/g, "").replace(",", "")
    )

    // За каждый год старше базового в таблице: × 0.85
    let usd = originalUsd
    let depreciationYears = 0
    let currentYear = excelYear
    while (Number.isFinite(currentYear) && currentYear > carYear) {
      usd *= 0.85
      currentYear--
      depreciationYears++
    }

    const finalUsd = Math.round(usd * 100) / 100
    const price = Math.round(finalUsd * CUSTOMS_USD_TO_KZT)

    return {
      price,
      excelYear,
      carYear,
      depreciationYears,
      originalUsd,
      finalUsd,
      foundModel: [foundRow["B"], foundRow["C"]].filter(Boolean).join(" "),
    }
  } catch (e) {
    console.error("[customs] Failed to read or parse xlsx:", e)
    return { price: 0 }
  }
}

export async function POST(req: Request) {

  try {

    const body =
      await req.json()

    const url =
      body?.url

    const selectedEngine =
      Number(body?.engine || 2)

    if (!url) {
      return NextResponse.json(
        { error: "Нет ссылки" },
        { status: 400 }
      )
    }

    let title = ""
    let year = 2020
    let mileage = "Unknown"
    let krw = 0
    let finalImages: string[] = []
    let source: "encar" | "heydealer" = "encar"

    if (isHeyDealerUrl(url)) {
      const heydealer = await parseHeyDealerUrl(url)
      title = heydealer.title
      year = heydealer.year
      mileage = heydealer.mileage
      krw = heydealer.krw
      finalImages = heydealer.images
      source = "heydealer"
    } else {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      })

      const html = await response.text()
      const $ = cheerio.load(html)

      const rawTitle =
        $("meta[property='og:title']").attr("content") ||
        $("title").text()

      const translated = await translate(rawTitle, {
        from: "ko",
        to: "en",
      })

      title = translated.text
        .replace(/Gyeonggi Used Car.*/i, "")
        .replace(/Sell My Car/gi, "")
        .replace(/Buy My Car/gi, "")
        .replace(/Used Car/gi, "")
        .trim()

      const pageText = $("body").text()
      const priceMatch = pageText.match(/([\d,]+)\s*만원/)

      if (priceMatch) {
        krw =
          Number(priceMatch[1].replace(/,/g, "")) * 10000
      }

      const mileageMatch = pageText.match(/\b[\d,]+\s?km\b/i)
      mileage = mileageMatch ? mileageMatch[0] : "Unknown"

      const yearMatch = pageText.match(/\d{2}\/\d{2}식/)
      year = 2020

      if (yearMatch) {
        const shortYear = Number(yearMatch[0].split("/")[0])
        year = shortYear >= 30 ? 1900 + shortYear : 2000 + shortYear
      }

      const images = new Set<string>()

      $("img").each((_, el) => {
        const sources = [
          $(el).attr("src"),
          $(el).attr("data-src"),
          $(el).attr("data-original"),
          $(el).attr("data-lazy"),
        ]

        sources.forEach((src) => {
          if (!src) return

          const fullUrl = src.startsWith("http") ? src : `https:${src}`
          const valid =
            (fullUrl.includes(".jpg") ||
              fullUrl.includes(".jpeg") ||
              fullUrl.includes(".png") ||
              fullUrl.includes(".webp")) &&
            !fullUrl.includes("logo") &&
            !fullUrl.includes("icon") &&
            !fullUrl.includes("banner") &&
            !fullUrl.includes("blank")

          if (valid) images.add(fullUrl)
        })
      })

      const bgMatches =
        html.match(/https?:\/\/[^"' )]+\.(jpg|jpeg|png|webp)/gi) || []

      bgMatches.forEach((img) => {
        const valid =
          !img.includes("logo") &&
          !img.includes("icon") &&
          !img.includes("banner") &&
          !img.includes("blank")

        if (valid) images.add(img)
      })

      finalImages = Array.from(images)
        .sort((a, b) => {
          const numA = Number(a.match(/_(\d+)\.(jpg|jpeg|png|webp)/i)?.[1] || 0)
          const numB = Number(b.match(/_(\d+)\.(jpg|jpeg|png|webp)/i)?.[1] || 0)
          return numA - numB
        })
        .slice(0, 50)
    }

    const carPriceKzt = Math.round(krw * 0.36)
    const engine = selectedEngine

    const logistics =
      1150000

    let recycle = 324000

    if (engine > 1 && engine <= 2)
      recycle = 757000

    if (engine > 2 && engine <= 3)
      recycle = 1080000

    if (engine > 3)
      recycle = 2490000

    const currentYear = 2026

    const age =
      currentYear - year

    const primary =
      age <= 2
        ? 1081
        : 2162500

    let excise = 0

    if (engine >= 3) {
      excise =
        Math.round(engine * 100000)
    }

    const broker =
      500000

    const customs =
      getCustomsPrice(
        title,
        engine,
        year
      )
      console.log("CUSTOMS RESULT:", customs)
      
    const customsKzt = customs.price

    const total =
      carPriceKzt +
      logistics +
      customs.price +
      recycle +
      primary +
      excise +
      broker

    return NextResponse.json({
      source,
      title,
      year,
      engine: `${engine.toFixed(1)} л`,
      mileage,
      price: krw.toLocaleString() + " ₩",
      priceKzt: carPriceKzt.toLocaleString() + " ₸",
      logistics: logistics.toLocaleString() + " ₸",
      customs: customsKzt.toLocaleString() + " ₸",
      customsDetails:
        customs.price > 0
          ? {
              foundModel: customs.foundModel,
              excelYear: customs.excelYear,
              carYear: customs.carYear,
              originalPrice: customs.originalUsd,
              depreciationYears: customs.depreciationYears || 0,
              depreciationPercent:
                (customs.depreciationYears || 0) > 0
                  ? `${(Math.pow(0.85, customs.depreciationYears || 0) * 100).toFixed(1)}%`
                  : "100%",
              finalPriceUsd:
                customs.finalUsd ??
                Math.round(customs.price / CUSTOMS_USD_TO_KZT),
              rate: CUSTOMS_USD_TO_KZT,
            }
          : null,
      recycle: recycle.toLocaleString() + " ₸",
      primary: primary.toLocaleString() + " ₸",
      excise: excise.toLocaleString() + " ₸",
      broker: broker.toLocaleString() + " ₸",
      finalTotal: total.toLocaleString() + " ₸",
      images: finalImages,
    })
  } catch (error) {
    console.log(error)

    const message =
      error instanceof Error ? error.message : "Parse error"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}