import translate from "google-translate-api-x"
import * as cheerio from "cheerio"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import fs from "fs"
import path from "path"
import { isHeyDealerUrl, parseHeyDealerUrl } from "@/lib/heydealer"
import { getPrimaryRegFee, getUtilFee } from "@/lib/fees"

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
      "EXCLUSIVE",
      "PREMIUM",
      "LPG",
      "HYBRID",
      "THE",
      "NEW",
    ]

    // Если в заголовке только модель без марки — подставляем бренд из таблицы
    const modelToBrand: Record<string, string> = {
      GRANDEUR: "HYUNDAI",
      AZERA: "HYUNDAI",
      SONATA: "HYUNDAI",
      TUCSON: "HYUNDAI",
      SANTAFE: "HYUNDAI",
      PALISADE: "HYUNDAI",
      KONA: "HYUNDAI",
      AVANTE: "HYUNDAI",
      ELANTRA: "HYUNDAI",
      STARIA: "HYUNDAI",
      CARNIVAL: "KIA",
      SORENTO: "KIA",
      SPORTAGE: "KIA",
      K5: "KIA",
      K8: "KIA",
      K9: "KIA",
      QM6: "RENAULT",
      SM6: "RENAULT",
      XM3: "RENAULT",
    }

    const titleWords =
      normalizedTitle
        .match(/[A-Z0-9]+/g)
        ?.filter((w) => !commonWords.includes(w) && w.length > 1) || []

    for (const [modelName, brandName] of Object.entries(modelToBrand)) {
      if (titleWords.includes(modelName) && !titleWords.includes(brandName)) {
        titleWords.push(brandName)
      }
    }

    // HG300 / 530i / 2000 и т.п. — точное совпадение токена; длинные имена — мягче
    const titleHas = (word: string) => {
      const w = word.toUpperCase()
      if (/^\d+$/.test(w) || w.length <= 2) {
        return titleWords.some((t) => t === w)
      }
      if (w.length <= 3) {
        return titleWords.some((t) => t === w)
      }
      return titleWords.some(
        (t) => t === w || t.includes(w) || (w.length >= 5 && w.includes(t) && t.length >= 4)
      )
    }

    type ScoredRow = {
      row: any
      score: number
      brandHit: boolean
      modelHits: number
      modelCoverage: number
      volumeExact: boolean
      volumeDiff: number
    }
    const scored: ScoredRow[] = []

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

      if (modelWords.length === 0 || !Number.isFinite(rowEngine)) continue

      const brandHit = brandWords.some((w) => titleHas(w))
      // Числовые куски модели (300, 530) не считаем совпадением модели сами по себе,
      // если в заголовке нет такого же отдельного токена.
      const meaningfulModelWords = modelWords.filter((w) => !/^\d+$/.test(w) || titleWords.includes(w))
      const modelHits = meaningfulModelWords.filter((w) => titleHas(w)).length
      const modelCoverage =
        meaningfulModelWords.length > 0
          ? modelHits / meaningfulModelWords.length
          : 0
      const volumeExact = rowEngine === engineCC
      const volumeDiff = Math.abs(rowEngine - engineCC)
      const volumeClose = volumeDiff <= 200

      // Нужно совпадение текстовой модели (не только цифр вроде 300)
      const hasTextModel = meaningfulModelWords.some(
        (w) => !/^\d+$/.test(w) && titleHas(w)
      )
      if (!hasTextModel) continue
      if (!volumeExact && !volumeClose && !(brandHit && modelCoverage >= 0.5)) continue

      let score = 0

      if (brandHit) score += 50
      else score -= 20

      score += Math.round(modelCoverage * 50)
      for (const word of meaningfulModelWords) {
        if (!titleHas(word)) continue
        // длинные имена модели (GRANDEUR) важнее коротких кодов
        score += Math.min(25, word.length * 2)
      }

      if (volumeExact) score += 40
      else if (volumeDiff <= 100) score += 15
      else if (volumeDiff <= 200) score += 5
      else score -= Math.min(30, Math.floor(volumeDiff / 100))

      if (Number.isFinite(rowYear)) {
        if (rowYear === year) {
          score += 25
        } else if (rowYear > year) {
          score += Math.max(0, 12 - (rowYear - year))
        } else if (rowYear === 2015 && year <= 2015) {
          score += 18
        } else {
          score -= Math.min(15, year - rowYear)
        }
      }

      if (expectedSeries) {
        const modelSeriesMatch = model.match(/(\d+)-?SERIES/)
        if (modelSeriesMatch && modelSeriesMatch[1] === expectedSeries) {
          score += 20
        }
        if (expectedSeries.startsWith("X") && model.includes(expectedSeries)) {
          score += 20
        }
      }

      scored.push({
        row,
        score,
        brandHit,
        modelHits,
        modelCoverage,
        volumeExact,
        volumeDiff,
      })
    }

    scored.sort((a, b) => {
      if (a.brandHit !== b.brandHit) return a.brandHit ? -1 : 1
      if (a.modelCoverage !== b.modelCoverage) return b.modelCoverage - a.modelCoverage
      if (a.volumeExact !== b.volumeExact) return a.volumeExact ? -1 : 1
      if (a.volumeDiff !== b.volumeDiff) return a.volumeDiff - b.volumeDiff
      return b.score - a.score
    })

    const best = scored[0]
    const foundRow = best && best.score >= 30 ? best.row : null
    const bestScore = best?.score ?? 0

    console.log({
      normalizedTitle,
      engineCC,
      year,
      bestScore,
      brandHit: best?.brandHit,
      modelHits: best?.modelHits,
      foundBrand: foundRow?.["B"],
      foundModel: foundRow?.["C"],
      candidates: scored.length,
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

    const inferEngineFromTitle = (raw: string, fallback: number) => {
      const t = raw.toUpperCase()
      // Korean codes: HG300 / IG300 → 3.0 л
      const code = t.match(/\b(?:HG|IG|TG|SG|QG)([1-6])00\b/)
      if (code) return Number(code[1])
      const liters = t.match(/\b([1-6](?:\.\d)?)\s*L\b/)
      if (liters) return Number(liters[1])
      return fallback
    }

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

      const imageByKey = new Map<string, string>()

      const normalizeImageUrl = (src: string) => {
        let fullUrl = src.startsWith("http") ? src : src.startsWith("//") ? `https:${src}` : src
        fullUrl = fullUrl.replace(/&amp;/g, "&").trim()
        return fullUrl
      }

      const photoKey = (url: string) => {
        const match = url.match(/(\d+_\d+)\.(jpg|jpeg|png|webp)/i)
        if (match) return match[1].toLowerCase()
        // fallback: path without query
        return url.split("?")[0].toLowerCase()
      }

      const qualityScore = (url: string) => {
        let score = 0
        const rh = Number(url.match(/[?&]rh=(\d+)/i)?.[1] || 0)
        const cw = Number(url.match(/[?&]cw=(\d+)/i)?.[1] || 0)
        score += rh + cw
        if (/[?&]t=\d+/i.test(url)) score += 50
        if (!url.includes("wtmk")) score += 10
        return score
      }

      const addImage = (src?: string | null) => {
        if (!src) return
        const fullUrl = normalizeImageUrl(src)
        const valid =
          (fullUrl.includes(".jpg") ||
            fullUrl.includes(".jpeg") ||
            fullUrl.includes(".png") ||
            fullUrl.includes(".webp")) &&
          fullUrl.includes("carpicture") &&
          !fullUrl.includes("logo") &&
          !fullUrl.includes("icon") &&
          !fullUrl.includes("banner") &&
          !fullUrl.includes("blank")

        if (!valid) return

        const key = photoKey(fullUrl)
        const prev = imageByKey.get(key)
        if (!prev || qualityScore(fullUrl) > qualityScore(prev)) {
          imageByKey.set(key, fullUrl)
        }
      }

      $("img").each((_, el) => {
        addImage($(el).attr("src"))
        addImage($(el).attr("data-src"))
        addImage($(el).attr("data-original"))
        addImage($(el).attr("data-lazy"))
      })

      const bgMatches =
        html.match(/https?:\/\/[^"' )\]]+\.(jpg|jpeg|png|webp)[^"' )\]]*/gi) || []

      bgMatches.forEach((img) => addImage(img))

      // Encar JSON blobs often list the full gallery
      const jsonMatches =
        html.match(/https?:\\\/\\\/ci\.encar\.com\\\/carpicture[^"'\\\s]+/gi) || []
      jsonMatches.forEach((raw) => {
        addImage(raw.replace(/\\\//g, "/").replace(/\\u0026/g, "&"))
      })

      finalImages = Array.from(imageByKey.values())
        .sort((a, b) => {
          const numA = Number(a.match(/_(\d+)\.(jpg|jpeg|png|webp)/i)?.[1] || 0)
          const numB = Number(b.match(/_(\d+)\.(jpg|jpeg|png|webp)/i)?.[1] || 0)
          return numA - numB
        })
        .slice(0, 20)
    }

    const carPriceKzt = Math.round(krw * 0.36)
    const engine = inferEngineFromTitle(title, selectedEngine)

    const logistics =
      1150000

    const recycle = getUtilFee(engine)
    const primary = getPrimaryRegFee(year)

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