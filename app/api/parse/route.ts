import translate from "google-translate-api-x"
import * as cheerio from "cheerio"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import fs from "fs"
import path from "path"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

function getCustomsPrice(
  title: string,
  engine: number,
  year: number
): number {


  const filePath =
    process.env.CUSTOMS_XLSX_PATH ||
    path.join(
      process.cwd(),
      "public",
      "customs.xlsx"
    )

  if (!fs.existsSync(filePath)) {
    console.warn(
      "[customs] File not found:",
      filePath,
      "— set CUSTOMS_XLSX_PATH or add public/customs.xlsx (таможня = 0)."
    )
    return 0
  }

  try {
    const buf = fs.readFileSync(filePath)
    const workbook = XLSX.read(buf, { type: "buffer" })

    const sheet =
      workbook.Sheets[workbook.SheetNames[0]]

      const rawData: any[] =
  XLSX.utils.sheet_to_json(sheet, {
    header: "A",
  })

const data = rawData.slice(1)
      console.log(data[0])

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


    const titleWords =
    normalizedTitle
    .toUpperCase()
    .match(/[A-Z0-9]+/g) || []

let bestRow = null
let bestScore = 0

for (const row of data) {

  const model =
  String(row["C"] || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")

    const rowWords =
    model.match(/[A-Z0-9]+/g) || []

  const rowEngine =
    Number(row["D"])

    let score = 0

    for (const word of rowWords) {
    
      if (
        word.length > 1 &&
        titleWords.some((t) => t.includes(word))
      ) {
        score += 3
      }
    }

  // бонус за объем
  if (rowEngine === engineCC) {
    score ++
  }
  
  const rowYear =
    Number(row["E"])
  
  if (rowYear === year) {
    score ++
  }

  if (score > bestScore) {
    bestScore = score
    bestRow = row
  }
}

const foundRow =
  bestScore >= 3
    ? bestRow
    : null

console.log({
  normalizedTitle,
  bestScore,
  foundModel: foundRow?.["C"],
})
    if (!foundRow) {
      console.log("NOT FOUND:", title)
      return 0
    }

    let excelYear = Number(foundRow["E"])

    let usd = Number(
      String(foundRow["F"] || "0")
        .replace(/\s/g, "")
        .replace(",", "")
    )
    
    console.log({
      excelPrice: foundRow["F"],
      usd,
    })
    while (excelYear > year) {
      usd *= 0.85
      excelYear--
    }

    return Math.round(usd * 460)
  } catch (e) {
    console.error("[customs] Failed to read or parse xlsx:", e)
    return 0
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

    const response =
      await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0",
        },
      })

    const html =
      await response.text()

    const $ =
      cheerio.load(html)

    const rawTitle =
      $("meta[property='og:title']")
        .attr("content") ||
      $("title").text()

    const translated =
      await translate(rawTitle, {
        from: "ko",
        to: "en",
      })

    const title =
      translated.text
        .replace(/Gyeonggi Used Car.*/i, "")
        .trim()

    const pageText =
      $("body").text()

    const priceMatch =
      pageText.match(
        /([\d,]+)\s*만원/
      )

    let krw = 0

    if (priceMatch) {

      krw =
        Number(
          priceMatch[1]
            .replace(/,/g, "")
        ) * 10000
    }

    const carPriceKzt =
      Math.round(krw * 0.36)

    const mileageMatch =
      pageText.match(
        /\b[\d,]+\s?km\b/i
      )

    const mileage =
      mileageMatch
        ? mileageMatch[0]
        : "Unknown"

    const yearMatch =
      pageText.match(
        /\d{2}\/\d{2}식/
      )

    let year = 2020

    if (yearMatch) {

      const shortYear =
        Number(
          yearMatch[0]
            .split("/")[0]
        )

      year =
        shortYear >= 30
          ? 1900 + shortYear
          : 2000 + shortYear
    }

    const engine =
      selectedEngine

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

    const total =
      carPriceKzt +
      logistics +
      customs +
      recycle +
      primary +
      excise +
      broker

      const images = new Set<string>()

// IMG tags
$("img").each((_, el) => {

  const sources = [
    $(el).attr("src"),
    $(el).attr("data-src"),
    $(el).attr("data-original"),
    $(el).attr("data-lazy"),
  ]

  sources.forEach((src) => {

    if (!src) return

    const fullUrl =
      src.startsWith("http")
        ? src
        : `https:${src}`

    const valid =
      (
        fullUrl.includes(".jpg") ||
        fullUrl.includes(".jpeg") ||
        fullUrl.includes(".png") ||
        fullUrl.includes(".webp")
      ) &&
      !fullUrl.includes("logo") &&
      !fullUrl.includes("icon") &&
      !fullUrl.includes("banner") &&
      !fullUrl.includes("blank")

    if (valid) {
      images.add(fullUrl)
    }
  })
})

// background-image urls
const bgMatches =
  html.match(
    /https?:\/\/[^"' )]+\.(jpg|jpeg|png|webp)/gi
  ) || []

bgMatches.forEach((img) => {

  const valid =
    !img.includes("logo") &&
    !img.includes("icon") &&
    !img.includes("banner") &&
    !img.includes("blank")

  if (valid) {
    images.add(img)
  }
})

const finalImages =
  Array.from(images).slice(0, 50)

    return NextResponse.json({

      title,

      year,

      engine:
        `${engine.toFixed(1)} л`,

      mileage,

      price:
        krw.toLocaleString() +
        " ₩",

      priceKzt:
        carPriceKzt.toLocaleString() +
        " ₸",

      logistics:
        logistics.toLocaleString() +
        " ₸",

      customs:
        customs.toLocaleString() +
        " ₸",

      recycle:
        recycle.toLocaleString() +
        " ₸",

      primary:
        primary.toLocaleString() +
        " ₸",

      excise:
        excise.toLocaleString() +
        " ₸",

      broker:
        broker.toLocaleString() +
        " ₸",

      finalTotal:
        total.toLocaleString() +
        " ₸",

        images: finalImages,
    })

  } catch (error) {

    console.log(error)

    return NextResponse.json(
      { error: "Parse error" },
      { status: 500 }
    )
  }
}